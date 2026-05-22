# Chatbot module

Module RAG chatbot tách biệt khỏi logic ứng dụng chính. Có "Data Access Layer" riêng,
truy cập DB qua tools với projection whitelist và filter cố định.

## Cấu trúc

```
chatbot/
├── config.js                  Đọc env, tập trung tham số
├── clients/
│   ├── llmClient.js           OpenAI-compatible (cũng hỗ trợ Anthropic)
│   ├── embeddingClient.js     /embeddings — fallback vector 0 khi thiếu key
│   └── qdrantClient.js        Vector DB REST (Qdrant)
├── models/
│   ├── ChatSession.js         sessionId, status, lastActivityAt, rating, feedback
│   ├── ChatMessage.js         role, content, retrievedBookIds, toolsUsed
│   └── ChatbotCache.js        Key-value TTL bằng MongoDB
├── sync/
│   ├── embedder.js            Re-export embedText
│   ├── vectorSync.js          Book -> text chunk -> upsert Qdrant (whitelist field)
│   └── bookWatcher.js         Change Stream Books -> vectorSync; fallback polling
├── tools/
│   ├── searchBooks.js         Filter status+stock, projection whitelist
│   ├── getFlashSale.js        Cache TTL 60s
│   ├── checkVoucher.js        Validate endsAt + usageLimit + minOrder
│   ├── getMemberBenefits.js   Public fields only
│   └── index.js               TOOL_DEFINITIONS + TOOLS + runTool
├── chat/
│   ├── contextBuilder.js      6 tin gần nhất
│   ├── queryRewriter.js       LLM nhỏ viết lại câu hỏi (bỏ qua nếu phiên mới)
│   ├── ragSearch.js           Embed -> Qdrant top-K, fallback keyword
│   ├── promptBuilder.js       System + context + tool results + RAG books
│   └── sessionNamer.js        Async đặt tên phiên sau tin đầu tiên
├── services/
│   ├── sessionLifecycle.js    touch / autoEndIfIdle / sweeper / markRated
│   └── analyticsService.js    Overview / daily / topTools / feedbacks
├── controllers/
│   ├── ChatbotController.js   Endpoint user: session + message (SSE) + rate
│   └── ChatbotAdminController.js  Endpoint admin analytics
├── routes.js                  Mount router
└── index.js                   initChatbot(app) — gọi từ server entry
```

## Vòng đời phiên

- Phiên `active` khi vừa tạo. Mỗi tin nhắn cập nhật `lastActivityAt = now`.
- **Sweeper** chạy nền (mỗi `CHATBOT_SESSION_SWEEP_SEC` giây, mặc định 30s) quét và đóng
  mọi phiên có `lastActivityAt < now - CHATBOT_SESSION_IDLE_MINUTES * 60s` (mặc định 5 phút),
  set `status=closed`, `endReason=timeout`, `endedAt=now`.
- Lazy check: mọi request đọc 1 phiên (`getSession`, `sendMessage`) đều kiểm tra idle
  trước, đảm bảo client luôn thấy trạng thái mới nhất kể cả khi sweeper chưa chạy tới.
- Khi `sendMessage` gọi vào phiên đã đóng -> 409 Conflict + payload yêu cầu user đánh giá
  hoặc tạo phiên mới.

## Đánh giá / Feedback

- `POST /api/chatbot/session/:id/rate` với `{ rating: 1-5, feedback: string }`
- Cho phép gọi cả khi phiên đang `active` (sẽ tự đóng + set `endReason=rated`).
- Admin xem tổng hợp tại `GET /admin/analytics/overview` và danh sách góp ý gần nhất tại
  `GET /admin/feedbacks`.

## Admin analytics

| Endpoint | Mô tả |
|----------|------|
| `GET /api/chatbot/admin/analytics/overview` | Tổng phiên, tỉ lệ rating, avg sao, phân bố 1-5, lý do kết thúc, số tin nhắn |
| `GET /api/chatbot/admin/analytics/daily` | Số phiên + avg rating theo ngày (mặc định 30 ngày) |
| `GET /api/chatbot/admin/analytics/top-tools` | Tool nào được gọi nhiều, tỉ lệ thành công |
| `GET /api/chatbot/admin/feedbacks` | Danh sách góp ý gần nhất |
| `GET /api/chatbot/admin/sessions` | Danh sách phiên (lọc theo `status`, `minRating`, `hasFeedback`) |
| `GET /api/chatbot/admin/sessions/:id/messages` | Xem full transcript |

Cả 6 endpoint yêu cầu `req.user.role === 'admin'` (đã có sẵn từ middleware auth chung).

## API người dùng

| Endpoint | Mô tả |
|----------|------|
| `POST /api/chatbot/session` | Tạo phiên mới (trả `sessionId`) |
| `GET /api/chatbot/sessions` | Danh sách phiên của user đăng nhập |
| `GET /api/chatbot/session/:id` | Trạng thái phiên (đã kèm auto-end lazy check) |
| `GET /api/chatbot/session/:id/messages` | Load history cho UI |
| `POST /api/chatbot/session/:id/message` | Gửi tin nhắn — **SSE stream** trả về |
| `POST /api/chatbot/session/:id/close` | User đóng phiên thủ công |
| `POST /api/chatbot/session/:id/rate` | Gửi rating + feedback |

### SSE event

- `event: ready` — đã nhận tin user, trả `{ sessionId, userMessageId }`
- `event: tool` — `{ name, ok }` mỗi khi 1 tool chạy xong
- `event: rag` — `{ count, source }` sau khi RAG xong
- `event: delta` — `{ delta }` từng chunk text từ LLM
- `event: error` — `{ error }` nếu có lỗi
- `event: done` — `{ assistantMessageId, retrievedBookIds, latencyMs }` khi xong

## Triển khai dev

1. Copy `.env.example` -> `.env`, điền `CHATBOT_LLM_API_KEY` và `CHATBOT_EMBED_API_KEY`
   (cùng key OpenAI là đủ).
2. Bật Qdrant (docker): `docker run -p 6333:6333 qdrant/qdrant` — hoặc set `QDRANT_ENABLED=false`
   để chạy mà không có vector DB (sẽ fallback sang keyword search).
3. Bật MongoDB ở chế độ replica set nếu muốn dùng Change Stream (đồng bộ realtime sách
   sang vector). Không có replica set, bookWatcher tự chuyển sang polling mỗi 60s theo
   `updateAt`.
4. `npm start` — sweeper + watcher tự khởi động sau khi MongoDB connect.

## Trade-off / hạn chế hiện tại

- **Tool loop 1 round**: LLM chỉ được chọn tool 1 lần (không đệ quy). Đủ cho >90% truy
  vấn chatbot. Nếu cần multi-step reasoning, có thể nâng lên 2-3 round trong `sendMessage`.
- **Vector ID**: Qdrant nhận UUID, ta chuyển ObjectId 24-hex -> UUID-like. Tránh được va
  chạm vì hex là deterministic.
- **Tin nhắn khách**: Cho phép guest chat nhưng `listSessions` chỉ trả nếu có
  `userId` — guest có thể tự lưu sessionId ở localStorage để quay lại phiên.
- **Auth**: `/api/chatbot/*` được whitelist toàn bộ ở middleware auth chung — admin
  endpoint tự kiểm tra `role` trong controller (trả 403 nếu không phải admin).
