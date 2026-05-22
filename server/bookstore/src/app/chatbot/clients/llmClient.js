const axios = require('axios');
const config = require('../config');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isHttp429(err) {
  return err?.response?.status === 429;
}

/** Trích thời gian chờ từ body Google ("Please retry in 43.12s") hoặc Retry-After */
function extractRetryDelayMs(err) {
  const msg = String(
    err?.response?.data?.error?.message ||
      err?.response?.data?.error ||
      err?.message ||
      '',
  );
  const m = msg.match(/retry in ([\d.]+)\s*s/i);
  if (m) {
    const sec = parseFloat(m[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(120000, Math.max(1000, Math.ceil(sec * 1000)));
    }
  }
  const ra = err?.response?.headers?.['retry-after'];
  if (ra) {
    const sec = parseInt(String(ra).trim(), 10);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(120000, sec * 1000);
    }
  }
  return null;
}

function formatLlmFailure(err) {
  if (isHttp429(err)) {
    const provider = config.llm.provider;
    if (provider === 'gemini') {
      return 'API Gemini đang giới hạn (quá nhiều câu/phút trên gói miễn phí). Đợi khoảng 1 phút rồi thử lại, hoặc nâng quota tại Google AI Studio.';
    }
    if (provider === 'deepseek') {
      return 'API DeepSeek đang giới hạn tốc độ (rate limit). Đợi một lát rồi thử lại, hoặc kiểm tra số dư/credit trên DeepSeek Platform.';
    }
    return 'LLM provider đang giới hạn tốc độ (rate limit). Vui lòng thử lại sau ít phút.';
  }
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.error ||
    err?.message ||
    'llm_error'
  );
}

/**
 * Mutex Gemini: chỉ một gọi tại một thời điểm.
 * cooldownMs (>0): nghỉ sau khi **nhả lock** — CHỈ bật cho stream để không phạt rewriter/tool-router.
 */
let _geminiLocked = false;
const _geminiWait = [];

async function acquireGeminiExclusive() {
  if (config.llm.provider !== 'gemini') return;
  if (!_geminiLocked) {
    _geminiLocked = true;
    return;
  }
  await new Promise((res) => _geminiWait.push(res));
}

async function releaseGeminiExclusive({ cooldownMs = null } = {}) {
  if (config.llm.provider !== 'gemini') return;
  const gap =
    cooldownMs !== null ? Number(cooldownMs) || 0 : Number(config.llm.geminiMinIntervalMs || 0);
  try {
    if (gap > 0) await sleep(gap);
  } finally {
    const next = _geminiWait.shift();
    if (next) next();
    else _geminiLocked = false;
  }
}

async function axiosPostWith429Retry(postFn) {
  const maxRetries = Math.max(0, Number(config.llm.max429Retries || 0));
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await postFn();
    } catch (err) {
      lastErr = err;
      if (!isHttp429(err) || attempt >= maxRetries) throw err;
      const fromApi = extractRetryDelayMs(err);
      const backoff = fromApi ?? Math.min(90000, 2000 * 2 ** attempt);
      console.warn(
        `[chatbot.llm] 429 rate limit — thử lại ${attempt + 1}/${maxRetries} sau ${Math.round(backoff / 1000)}s`,
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}

/**
 * Client LLM hỗ trợ:
 *  - provider = 'gemini'    -> Google Generative Language API (gemini-2.5-flash)
 *  - provider = 'anthropic' -> Anthropic Messages
 *  - provider = 'openai'    -> OpenAI-compatible /chat/completions (mặc định cho mọi gateway khác)
 *
 * Tất cả nhận messages dạng OpenAI ([{role:'system'|'user'|'assistant', content}])
 * và TOOL_DEFINITIONS dạng OpenAI function-calling. Bên trong tự convert nếu cần.
 */

function hasKey() {
  return Boolean(config.llm.apiKey);
}

function authHeaders() {
  const provider = config.llm.provider;
  if (provider === 'anthropic') {
    return {
      'x-api-key': config.llm.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
  }
  // gemini gắn key qua query string, vẫn cần content-type
  if (provider === 'gemini') {
    return { 'content-type': 'application/json' };
  }
  return {
    Authorization: `Bearer ${config.llm.apiKey}`,
    'content-type': 'application/json',
  };
}

/**
 * Convert messages OpenAI -> Gemini.
 * - system messages gộp thành systemInstruction.
 * - assistant -> 'model', còn lại -> 'user'.
 * - Tools (OpenAI function-calling) -> functionDeclarations.
 */
function toGeminiBody(messages, { temperature, maxTokens, tools, toolChoice, jsonMode } = {}) {
  const systemTexts = [];
  const contents = [];

  for (const m of messages || []) {
    if (!m || m.content == null) continue;
    if (m.role === 'system') {
      systemTexts.push(String(m.content));
      continue;
    }
    const role = m.role === 'assistant' ? 'model' : 'user';
    const text = String(m.content);
    if (!text) continue;
    contents.push({ role, parts: [{ text }] });
  }

  const body = {
    contents,
    generationConfig: {
      temperature: temperature ?? config.llm.temperature,
      maxOutputTokens: maxTokens ?? config.llm.maxTokens,
    },
  };
  if (jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
  }
  if (systemTexts.length) {
    body.systemInstruction = { parts: [{ text: systemTexts.join('\n\n') }] };
  }
  if (Array.isArray(tools) && tools.length) {
    body.tools = [
      {
        functionDeclarations: tools.map((t) => {
          const fn = t.function || t;
          return {
            name: fn.name,
            description: fn.description || '',
            parameters: fn.parameters || { type: 'object', properties: {} },
          };
        }),
      },
    ];
    let mode = 'AUTO';
    if (toolChoice === 'none') mode = 'NONE';
    else if (toolChoice === 'required' || toolChoice === 'any') mode = 'ANY';
    body.toolConfig = { functionCallingConfig: { mode } };
  }
  return body;
}

/**
 * Parse 1 response generateContent của Gemini -> shape OpenAI-like để controller dùng nguyên.
 */
function parseGeminiResponse(data) {
  const cand = data?.candidates?.[0];
  const parts = cand?.content?.parts || [];
  let textOut = '';
  const toolCalls = [];
  for (const p of parts) {
    if (typeof p?.text === 'string') textOut += p.text;
    if (p?.functionCall) {
      const args = p.functionCall.args || {};
      toolCalls.push({
        id: `call_${toolCalls.length + 1}`,
        type: 'function',
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(args),
        },
      });
    }
  }
  return {
    content: textOut.trim(),
    toolCalls,
    finishReason: cand?.finishReason || 'stop',
    raw: data,
  };
}

/**
 * Gọi LLM chính (sync, không stream). Dùng cho rewriter, sessionNamer, tool decision.
 */
async function complete({
  messages,
  model,
  temperature,
  tools,
  toolChoice,
  maxTokens,
  jsonMode = false,
  geminiCooldownMs = null,
} = {}) {
  if (!hasKey()) {
    return { content: '', toolCalls: [], finishReason: 'no_key' };
  }
  const provider = config.llm.provider;
  const useModel = model || config.llm.model;
  const geminiCooldown =
    geminiCooldownMs !== null && geminiCooldownMs !== undefined
      ? Number(geminiCooldownMs) || 0
      : 0;

  try {
    if (provider === 'gemini') {
      const url =
        `${config.llm.baseUrl.replace(/\/$/, '')}` +
        `/models/${encodeURIComponent(useModel)}:generateContent` +
        `?key=${encodeURIComponent(config.llm.apiKey)}`;
      const body = toGeminiBody(messages, { temperature, maxTokens, tools, toolChoice, jsonMode });
      await acquireGeminiExclusive();
      try {
        const { data } = await axiosPostWith429Retry(() =>
          axios.post(url, body, {
            headers: authHeaders(),
            timeout: config.llm.timeoutMs,
          }),
        );
        return parseGeminiResponse(data);
      } finally {
        await releaseGeminiExclusive({ cooldownMs: geminiCooldown });
      }
    }

    if (provider === 'anthropic') {
      const url = `${config.llm.baseUrl.replace(/\/$/, '')}/messages`;
      const sys = (messages || []).find((m) => m.role === 'system')?.content || '';
      const body = {
        model: useModel,
        max_tokens: maxTokens ?? config.llm.maxTokens,
        temperature: temperature ?? config.llm.temperature,
        system: sys,
        messages: (messages || [])
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      };
      const { data } = await axios.post(url, body, {
        headers: authHeaders(),
        timeout: config.llm.timeoutMs,
      });
      const text = (data?.content || []).map((c) => c.text || '').join('').trim();
      return { content: text, toolCalls: [], finishReason: data?.stop_reason || 'stop' };
    }

    const url = `${config.llm.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const body = {
      model: useModel,
      messages,
      temperature: temperature ?? config.llm.temperature,
      max_tokens: maxTokens ?? config.llm.maxTokens,
    };
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }
    if (Array.isArray(tools) && tools.length) {
      body.tools = tools;
      if (toolChoice) body.tool_choice = toolChoice;
    }
    const { data } = await axios.post(url, body, {
      headers: authHeaders(),
      timeout: config.llm.timeoutMs,
    });
    const choice = data?.choices?.[0];
    const msg = choice?.message || {};
    return {
      content: (msg.content || '').trim(),
      toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
      finishReason: choice?.finish_reason || 'stop',
      raw: data,
    };
  } catch (err) {
    const reason = formatLlmFailure(err);
    console.error('[chatbot.llm] complete failed:', reason);
    return { content: '', toolCalls: [], finishReason: 'error', error: reason };
  }
}

/**
 * Stream LLM. Trả async iterator của { delta, done, error }.
 *  - gemini    : SSE qua :streamGenerateContent?alt=sse
 *  - openai    : SSE qua /chat/completions (stream:true)
 *  - anthropic : fallback gọi complete() rồi yield 1 lần (đơn giản, đủ dùng)
 */
async function* stream({ messages, model, temperature, maxTokens } = {}) {
  if (!hasKey()) {
    yield {
      delta:
        'Xin lỗi, hệ thống chatbot chưa được cấu hình API key LLM. Vui lòng liên hệ quản trị viên.',
      done: false,
    };
    yield { done: true };
    return;
  }
  const provider = config.llm.provider;

  if (provider === 'anthropic') {
    const res = await complete({ messages, model, temperature, maxTokens });
    if (res.content) yield { delta: res.content, done: false };
    yield { done: true };
    return;
  }

  if (provider === 'gemini') {
    const useModel = model || config.llm.model;
    const url =
      `${config.llm.baseUrl.replace(/\/$/, '')}` +
      `/models/${encodeURIComponent(useModel)}:streamGenerateContent` +
      `?alt=sse&key=${encodeURIComponent(config.llm.apiKey)}`;
    const body = toGeminiBody(messages, { temperature, maxTokens });

    let response;
    await acquireGeminiExclusive();
    let streamSucceeded = false;
    try {
      try {
        response = await axiosPostWith429Retry(() =>
          axios.post(url, body, {
            headers: authHeaders(),
            timeout: config.llm.timeoutMs,
            responseType: 'stream',
          }),
        );
      } catch (err) {
        const reason = formatLlmFailure(err);
        console.error('[chatbot.llm] stream failed:', reason);
        yield {
          delta:
            'Xin lỗi, hệ thống tạm thời không gọi được AI. ' +
            (isHttp429(err)
              ? reason
              : 'Vui lòng thử lại sau.'),
          done: false,
          error: reason,
        };
        yield { done: true, error: reason };
        return;
      }

      const responseStream = response.data;
      let buffer = '';
      for await (const chunk of responseStream) {
        buffer += chunk.toString('utf8');
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line || !line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const parts = json?.candidates?.[0]?.content?.parts || [];
            for (const p of parts) {
              if (typeof p?.text === 'string' && p.text) {
                yield { delta: p.text, done: false };
              }
            }
          } catch (_e) {
            // ignore malformed lines
          }
        }
      }
      streamSucceeded = true;
      yield { done: true };
    } finally {
      await releaseGeminiExclusive({
        cooldownMs: streamSucceeded ? config.llm.geminiMinIntervalMs : 0,
      });
    }
    return;
  }

  // OpenAI-compatible SSE
  const url = `${config.llm.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: model || config.llm.model,
    messages,
    temperature: temperature ?? config.llm.temperature,
    max_tokens: maxTokens ?? config.llm.maxTokens,
    stream: true,
  };
  let response;
  try {
    response = await axios.post(url, body, {
      headers: authHeaders(),
      timeout: config.llm.timeoutMs,
      responseType: 'stream',
    });
  } catch (err) {
    const reason = formatLlmFailure(err);
    console.error('[chatbot.llm] stream failed:', reason);
    yield { delta: `Xin lỗi, hiện không thể kết nối tới LLM (${reason}).`, done: false, error: reason };
    yield { done: true, error: reason };
    return;
  }

  const responseStream = response.data;
  let buffer = '';
  for await (const chunk of responseStream) {
    buffer += chunk.toString('utf8');
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        yield { done: true };
        return;
      }
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content || '';
        if (delta) yield { delta, done: false };
      } catch (_e) {
        // ignore malformed lines
      }
    }
  }
  yield { done: true };
}

module.exports = { complete, stream, hasKey };
