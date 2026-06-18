import { useState, useRef, useEffect, useContext, useCallback, Fragment } from 'react';
import styles from './Chatbot.module.scss';
import { AuthContext } from '../context/auth.context';
import API_BASE from '../../config/api';

function renderInline(text) {
  const out = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push(<Fragment key={key++}>{text.slice(lastIdx, m.index)}</Fragment>);
    }
    out.push(<strong key={key++}>{m[1]}</strong>);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    out.push(<Fragment key={key++}>{text.slice(lastIdx)}</Fragment>);
  }
  return out;
}

function renderMarkdown(text) {
  if (!text) return null;
  const paragraphs = String(text).split(/\n\s*\n+/);
  const nodes = [];
  paragraphs.forEach((para, pi) => {
    const lines = para.split('\n').map((l) => l.replace(/\r$/, ''));
    lines.forEach((line, li) => {
      const trimmed = line.replace(/^\s*[-*]\s+/, '');
      const isBullet = trimmed !== line;
      const display = isBullet ? `• ${trimmed}` : line;
      nodes.push(
        <Fragment key={`${pi}-${li}`}>
          {renderInline(display)}
          {li < lines.length - 1 && <br />}
        </Fragment>,
      );
    });
    if (pi < paragraphs.length - 1) {
      nodes.push(<br key={`gap-a-${pi}`} />);
      nodes.push(<br key={`gap-b-${pi}`} />);
    }
  });
  return nodes;
}

const CHAT_STORAGE_KEY = 'bookstore_chatbot_state';

/// <summary>
/// Header Authorization từ localStorage; khách không đăng nhập → không gửi token.
/// </summary>
function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/// <summary>
/// Khôi phục sessionId và uiPhase từ sessionStorage.
/// </summary>
function loadPersistedState() {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

function persistChatState(state) {
  try {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
  } catch (_e) {
    /* ignore quota errors */
  }
}

function clearPersistedState() {
  try {
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
  } catch (_e) {
    /* ignore */
  }
}

async function createSession() {
  const res = await fetch(`${API_BASE}/api/chatbot/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('cannot_create_session');
  return res.json();
}

async function fetchSessionState(sessionId) {
  const res = await fetch(`${API_BASE}/api/chatbot/session/${sessionId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchSessionMessages(sessionId) {
  const res = await fetch(`${API_BASE}/api/chatbot/session/${sessionId}/messages`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.items || [];
}

async function postContinue(sessionId, wantMore) {
  const res = await fetch(`${API_BASE}/api/chatbot/session/${sessionId}/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ wantMore }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'continue_failed');
  }
  return res.json();
}

async function postIssueResolved(sessionId, issueResolved) {
  const res = await fetch(`${API_BASE}/api/chatbot/session/${sessionId}/issue-resolved`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ issueResolved }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'issue_resolved_failed');
  }
  return res.json();
}

async function postRate(sessionId, { rating, feedback, skip }) {
  const res = await fetch(`${API_BASE}/api/chatbot/session/${sessionId}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ rating, feedback, skip }),
  });
  if (!res.ok) throw new Error('rate_failed');
  return res.json();
}

/// <summary>
/// Parse một block SSE (event + data JSON) từ stream phản hồi chatbot.
/// </summary>
function parseSseBlock(block) {
  let event = 'message';
  const dataLines = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  const raw = dataLines.join('\n');
  let data = raw;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (_e) {
      data = raw;
    }
  }
  return { event, data };
}

/// <summary>
/// Widget chatbot: session lifecycle (chat → continue → feedback → ended) và SSE streaming.
/// </summary>
function Chatbot() {
  const { auth } = useContext(AuthContext);
  const isLoggedIn = !!auth?.isAuthenticated;

  const greeting = isLoggedIn
    ? `Xin chào${auth?.user?.name ? ` ${auth.user.name}` : ''}! Tôi có thể tư vấn sách, voucher, hoặc đơn hàng của bạn — bạn muốn hỏi gì?`
    : 'Xin chào! Tôi có thể tư vấn sách, voucher hoặc flash sale. Đăng nhập để mình tra cứu đơn hàng của bạn nhé.';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ text: greeting, sender: 'bot' }]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  /** uiPhase: chat | continue | resolved | feedback | ended */
  const [uiPhase, setUiPhase] = useState('chat');
  const [sessionMeta, setSessionMeta] = useState(null);
  const [issueResolved, setIssueResolved] = useState('');
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSkipLeft, setFeedbackSkipLeft] = useState(null);

  const sessionIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  const feedbackSkipTimerRef = useRef(null);
  const hydratedRef = useRef(false);
  const pollTimerRef = useRef(null);

  const resetChat = useCallback(() => {
    sessionIdRef.current = null;
    clearPersistedState();
    setSessionMeta(null);
    setUiPhase('chat');
    setIssueResolved('');
    setRating(0);
    setFeedbackText('');
    setMessages([{ text: greeting, sender: 'bot' }]);
  }, [greeting]);

  /// <summary>
  /// Đồng bộ uiPhase từ server state (awaiting_continue, needsFeedback, closed…).
  /// </summary>
  const applySessionState = useCallback((state) => {
    if (!state) return;
    setSessionMeta(state);
    if (state.phase === 'awaiting_continue') {
      setUiPhase('continue');
      return;
    }
    if (state.needsIssueResolved || state.phase === 'awaiting_resolved') {
      setUiPhase('resolved');
      return;
    }
    if (state.needsFeedback) {
      setUiPhase('feedback');
      return;
    }
    if (state.status === 'closed' && (state.rating || state.feedbackSkipped)) {
      setUiPhase('ended');
      return;
    }
    setUiPhase('chat');
  }, []);

  const mapApiMessages = useCallback(
    (items) => {
      const msgs = [{ text: greeting, sender: 'bot' }];
      (items || []).forEach((item) => {
        msgs.push({
          text: item.content,
          sender: item.role === 'user' ? 'user' : 'bot',
        });
      });
      return msgs;
    },
    [greeting],
  );

  useEffect(() => {
    if (hydratedRef.current) return undefined;
    hydratedRef.current = true;

    let cancelled = false;

    async function hydrate() {
      const saved = loadPersistedState();
      if (!saved) return;

      if (Array.isArray(saved.messages) && saved.messages.length > 0) {
        setMessages(saved.messages);
      }
      if (typeof saved.uiPhase === 'string') {
        setUiPhase(saved.uiPhase);
      }
      if (typeof saved.isOpen === 'boolean') {
        setIsOpen(saved.isOpen);
      }
      if (saved.sessionMeta) {
        setSessionMeta(saved.sessionMeta);
      }

      if (!saved.sessionId) return;

      const state = await fetchSessionState(saved.sessionId);
      if (cancelled) return;

      if (!state) {
        clearPersistedState();
        return;
      }

      sessionIdRef.current = saved.sessionId;
      setSessionMeta(state);
      applySessionState(state);

      const items = await fetchSessionMessages(saved.sessionId);
      if (cancelled) return;

      if (items?.length) {
        setMessages(mapApiMessages(items));
      }
    }

    hydrate().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applySessionState, mapApiMessages]);

  /// <summary>
  /// Tạo session mới nếu chưa có; đồng bộ state từ server khi panel đang mở.
  /// </summary>
  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const data = await createSession();
    sessionIdRef.current = data.sessionId;
    setSessionMeta(data);
    setUiPhase('chat');
    if (isOpen) {
      fetchSessionState(data.sessionId).then(applySessionState).catch(() => {});
    }
    return data.sessionId;
  }, [applySessionState, isOpen]);

  const pollSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || !isOpen) return;
    const state = await fetchSessionState(sid);
    if (!state) return;
    applySessionState(state);
    if (state.needsIssueResolved && uiPhase === 'chat') {
      setMessages((prev) => [
        ...prev,
        {
          text:
            'Phiên trò chuyện đã kết thúc (5 phút không hoạt động). Vấn đề của bạn đã được giải quyết chưa?',
          sender: 'bot',
        },
      ]);
    } else if (state.needsFeedback && uiPhase === 'chat') {
      setMessages((prev) => [
        ...prev,
        {
          text: 'Vui lòng đánh giá trải nghiệm chatbot bên dưới nhé.',
          sender: 'bot',
        },
      ]);
    }
  }, [isOpen, applySessionState, uiPhase]);

  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (!isOpen || !sessionIdRef.current) return undefined;
    pollSession().catch(() => {});
    pollTimerRef.current = setInterval(() => {
      pollSession().catch(() => {});
    }, 20000);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, sessionMeta?.sessionId, pollSession]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onFocus = () => {
      pollSession().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [isOpen, pollSession]);

  useEffect(() => {
    const sid = sessionIdRef.current || sessionMeta?.sessionId;
    if (!sid && messages.length <= 1 && uiPhase === 'chat') return;
    persistChatState({
      sessionId: sid || null,
      messages,
      uiPhase,
      sessionMeta,
      isOpen,
    });
  }, [messages, uiPhase, sessionMeta, isOpen]);

  const handleSkipFeedback = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) {
      resetChat();
      return;
    }
    try {
      await postRate(sid, { skip: true });
    } catch (_e) {
      /* ignore */
    }
    sessionIdRef.current = null;
    clearPersistedState();
    setUiPhase('ended');
    setMessages((prev) => [
      ...prev,
      { text: 'Cảm ơn bạn! Khi cần hỗ trợ, hãy nhắn tin để bắt đầu phiên mới.', sender: 'bot' },
    ]);
  }, [resetChat]);

  useEffect(() => {
    if (uiPhase !== 'feedback' || !sessionMeta?.feedbackSkipSec) return undefined;
    setFeedbackSkipLeft(sessionMeta.feedbackSkipSec);
    if (feedbackSkipTimerRef.current) clearInterval(feedbackSkipTimerRef.current);
    feedbackSkipTimerRef.current = setInterval(() => {
      setFeedbackSkipLeft((s) => {
        if (s == null || s <= 1) {
          clearInterval(feedbackSkipTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    const autoSkip = setTimeout(() => {
      handleSkipFeedback();
    }, (sessionMeta.feedbackSkipSec || 30) * 1000);
    return () => {
      clearTimeout(autoSkip);
      if (feedbackSkipTimerRef.current) clearInterval(feedbackSkipTimerRef.current);
    };
  }, [uiPhase, sessionMeta?.sessionId, sessionMeta?.feedbackSkipSec, handleSkipFeedback]);

  const handleSubmitFeedback = async () => {
    const sid = sessionIdRef.current;
    if (!sid || rating < 1) return;
    try {
      await postRate(sid, { rating, feedback: feedbackText, issueResolved: issueResolved || undefined });
      sessionIdRef.current = null;
      clearPersistedState();
      setUiPhase('ended');
      setMessages((prev) => [
        ...prev,
        { text: 'Cảm ơn bạn đã đánh giá! Hẹn gặp lại.', sender: 'bot' },
      ]);
    } catch (_e) {
      setMessages((prev) => [
        ...prev,
        { text: 'Không gửi được đánh giá. Bạn có thể thử lại hoặc bỏ qua.', sender: 'bot' },
      ]);
    }
  };

  const handleContinueChoice = async (wantMore) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    setSending(true);
    try {
      const data = await postContinue(sid, wantMore);
      applySessionState(data);
      if (wantMore) {
        setSessionMeta((prev) =>
          prev
            ? {
                ...prev,
                phase: 'active',
                status: 'active',
                totalTokensUsed: data.totalTokensUsed ?? 0,
              }
            : prev,
        );
        setMessages((prev) => [
          ...prev,
          { text: 'Được rồi, mình tiếp tục hỗ trợ bạn. Bạn cần gì thêm?', sender: 'bot' },
        ]);
      } else {
        setUiPhase('resolved');
        setMessages((prev) => [
          ...prev,
          {
            text: 'Vấn đề bạn nhờ hỗ trợ đã được giải quyết chưa? Chọn một đáp án bên dưới.',
            sender: 'bot',
          },
        ]);
      }
    } catch (_e) {
      setMessages((prev) => [
        ...prev,
        { text: 'Không cập nhật được phiên. Vui lòng thử lại.', sender: 'bot' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleIssueResolvedChoice = async (value) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    setSending(true);
    try {
      const data = await postIssueResolved(sid, value);
      setIssueResolved(value);
      applySessionState(data);
      setMessages((prev) => [
        ...prev,
        { text: 'Cảm ơn bạn! Vui lòng đánh giá trải nghiệm (sao + nhận xét) bên dưới.', sender: 'bot' },
      ]);
    } catch (_e) {
      setMessages((prev) => [
        ...prev,
        { text: 'Không gửi được phản hồi. Vui lòng thử lại.', sender: 'bot' },
      ]);
    } finally {
      setSending(false);
    }
  };

  /// <summary>
  /// Gửi tin nhắn và đọc phản hồi SSE; xử lý 409 (phase continue) và tạo session mới khi 404.
  /// </summary>
  const streamReply = useCallback(
    async (content) => {
      const send = async (sid) => {
        const res = await fetch(`${API_BASE}/api/chatbot/session/${sid}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ content }),
        });
        return res;
      };

      let sid = await ensureSession();
      let res = await send(sid);

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        applySessionState(body);
        if (body.phase === 'awaiting_continue') {
          setUiPhase('continue');
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.sender === 'bot' && last?.streaming) next.pop();
            return [
              ...next,
              {
                text: 'Bạn cần hỗ trợ thêm không? Chọn Có hoặc Không bên dưới.',
                sender: 'bot',
              },
            ];
          });
          return;
        }
        if (body.needsIssueResolved) {
          setUiPhase('resolved');
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.sender === 'bot' && last?.streaming) next.pop();
            return [
              ...next,
              {
                text: 'Vấn đề bạn nhờ hỗ trợ đã được giải quyết chưa?',
                sender: 'bot',
              },
            ];
          });
          return;
        }
        if (body.needsFeedback) {
          setUiPhase('feedback');
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.sender === 'bot' && last?.streaming) next.pop();
            return [
              ...next,
              {
                text: body.message || 'Phiên đã kết thúc. Vui lòng đánh giá bên dưới.',
                sender: 'bot',
              },
            ];
          });
          return;
        }
        if (body.status === 'closed' && body.endReason === 'rated') {
          setUiPhase('ended');
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.sender === 'bot' && last?.streaming) next.pop();
            return [
              ...next,
              {
                text: 'Phiên trước đã kết thúc sau khi bạn đánh giá. Mình tạo phiên mới để tiếp tục hỗ trợ nhé.',
                sender: 'bot',
              },
            ];
          });
          sessionIdRef.current = null;
          sid = await ensureSession();
          res = await send(sid);
        }
      }

      if (res.status === 404 || res.status === 409) {
        sessionIdRef.current = null;
        sid = await ensureSession();
        res = await send(sid);
      }

      if (!res.ok || !res.body) {
        throw new Error(`chat_failed_${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let lastEvent = 'message';

      const appendDelta = (text) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          last.text = (last.text || '') + text;
          next[next.length - 1] = last;
          return next;
        });
      };

      const finishBot = (fallback) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          if (!last.text) last.text = fallback || '(không có phản hồi)';
          delete last.streaming;
          next[next.length - 1] = last;
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!block.trim()) continue;
          const { event, data } = parseSseBlock(block);
          lastEvent = event;
          if (event === 'delta' && data?.delta) {
            appendDelta(data.delta);
          } else if (event === 'error') {
            finishBot(data?.error ? `Lỗi: ${data.error}` : 'Xin lỗi, đã có lỗi xảy ra.');
            return;
          } else if (event === 'session' && data?.action === 'ask_continue') {
            setUiPhase('continue');
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.streaming) {
                delete last.streaming;
              }
              next.push({
                text:
                  data.message ||
                  'Bạn cần hỗ trợ thêm không? Chọn Có hoặc Không bên dưới.',
                sender: 'bot',
              });
              return next;
            });
          } else if (event === 'done') {
            finishBot();
            if (sessionIdRef.current) {
              fetchSessionState(sessionIdRef.current).then(applySessionState).catch(() => {});
            }
            return;
          }
        }
      }
      finishBot(lastEvent === 'error' ? 'Xin lỗi, đã có lỗi xảy ra.' : '');
    },
    [ensureSession, applySessionState],
  );

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || sending || uiPhase !== 'chat') return;
    setInputValue('');
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { text, sender: 'user' },
      { text: '', sender: 'bot', streaming: true },
    ]);

    try {
      await streamReply(text);
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.sender === 'bot') {
          next[next.length - 1] = {
            ...last,
            text: 'Xin lỗi, không kết nối được tới trợ lý. Vui lòng thử lại sau.',
            streaming: false,
          };
        }
        return next;
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChat = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next && sessionIdRef.current) {
        pollSession().catch(() => {});
      }
      return next;
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, uiPhase]);

  const inputDisabled = sending || uiPhase !== 'chat';
  const tokenHint =
    sessionMeta?.totalTokensUsed != null && sessionMeta?.tokenThreshold
      ? ``
      : null;

  return (
    <div className={styles.chatbotWidget}>
      {!isOpen && (
        <button className={styles.chatToggle} onClick={toggleChat} aria-label="Mở chatbot">
          <i className="fa-solid fa-comment-dots" />
          <span className={styles.chatBadge}>Chat</span>
        </button>
      )}

      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderInfo}>
              <i className="fa-solid fa-robot" />
              <div>
                <h4>Trợ lý BookStore</h4>
                <span>
                  {uiPhase === 'feedback'
                    ? 'Đánh giá phiên'
                    : uiPhase === 'resolved'
                    ? 'Xác nhận giải quyết'
                    : uiPhase === 'continue'
                    ? 'Xác nhận tiếp tục'
                    : isLoggedIn
                    ? 'Trực tuyến'
                    : 'Trực tuyến · Khách'}
                </span>
              </div>
            </div>
            <button className={styles.chatClose} onClick={toggleChat} type="button" aria-label="Đóng chatbot">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {tokenHint && uiPhase === 'chat' && (
            <div className={styles.chatMetaBar}>{tokenHint}</div>
          )}

          <div className={styles.chatBody}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`${styles.chatMessage} ${styles[msg.sender]}`}>
                {msg.sender === 'bot' && <i className="fa-solid fa-robot" />}
                <p>
                  {msg.text
                    ? renderMarkdown(msg.text)
                    : msg.streaming
                    ? '…'
                    : ''}
                </p>
                {msg.sender === 'user' && <i className="fa-solid fa-user" />}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {uiPhase === 'resolved' && (
            <div className={styles.chatPanel}>
              <p className={styles.chatPanelTitle}>Vấn đề của bạn đã được giải quyết chưa?</p>
              <div className={styles.chatPanelActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={sending}
                  onClick={() => handleIssueResolvedChoice('yes')}
                >
                  Đã giải quyết
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={sending}
                  onClick={() => handleIssueResolvedChoice('partial')}
                >
                  Một phần
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={sending}
                  onClick={() => handleIssueResolvedChoice('no')}
                >
                  Chưa
                </button>
              </div>
            </div>
          )}

          {uiPhase === 'continue' && (
            <div className={styles.chatPanel}>
              <p className={styles.chatPanelTitle}>Bạn cần hỗ trợ thêm không?</p>
              <div className={styles.chatPanelActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={sending}
                  onClick={() => handleContinueChoice(true)}
                >
                  Có
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={sending}
                  onClick={() => handleContinueChoice(false)}
                >
                  Không
                </button>
              </div>
            </div>
          )}

          {uiPhase === 'feedback' && (
            <div className={styles.chatPanel}>
              <p className={styles.chatPanelTitle}>Đánh giá trải nghiệm</p>
              <div className={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles.starBtn} ${rating >= n ? styles.starOn : ''}`}
                    onClick={() => setRating(n)}
                    aria-label={`${n} sao`}
                  >
                    <i className="fa-solid fa-star" />
                  </button>
                ))}
              </div>
              <textarea
                className={styles.feedbackInput}
                placeholder="Nhận xét (tuỳ chọn)..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={3}
              />
              <div className={styles.chatPanelActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={rating < 1}
                  onClick={handleSubmitFeedback}
                >
                  Gửi đánh giá
                </button>
                <button type="button" className={styles.btnGhost} onClick={handleSkipFeedback}>
                  Bỏ qua
                  {feedbackSkipLeft != null && feedbackSkipLeft > 0
                    ? ` (${feedbackSkipLeft}s)`
                    : ''}
                </button>
              </div>
            </div>
          )}

          {uiPhase === 'chat' && (
            <div className={styles.chatFooter}>
              <input
                type="text"
                className={styles.chatInput}
                placeholder={sending ? 'Đang trả lời…' : 'Nhập câu hỏi...'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={inputDisabled}
              />
              <button
                className={styles.chatSend}
                onClick={handleSend}
                aria-label="Gửi"
                type="button"
                disabled={inputDisabled || !inputValue.trim()}
              >
                <i className="fa-solid fa-paper-plane" />
              </button>
            </div>
          )}

          {uiPhase === 'ended' && (
            <div className={styles.chatPanel}>
              <button type="button" className={styles.btnPrimary} onClick={resetChat}>
                Bắt đầu phiên mới
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Chatbot;
