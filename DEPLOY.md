# Deploy BookStore — Vercel + Render + MongoDB Atlas (miễn phí)

## Kiến trúc

| Thành phần | Nền tảng | Dev local |
|------------|----------|-----------|
| React (`CRA/bookstore`) | **Vercel** | `npm start` → :3000 |
| API (`server/bookstore`) | **Render** | `npm start` → :3001 |
| MongoDB | **Atlas M0** | `mongodb://localhost:27017/book_store` |

---

## 1. MongoDB Atlas (M0 free)

1. Tạo cluster **M0** tại [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Database Access → user + password.
3. Network Access → **Allow access from anywhere** (`0.0.0.0/0`) hoặc IP Render khi biết.
4. Connect → lấy connection string, thay `<password>`:
   ```
   mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/book_store?retryWrites=true&w=majority
   ```

**Import dữ liệu local (tuỳ chọn):**

```bash
mongodump --db book_store --out ./dump
mongorestore --uri "mongodb+srv://..." ./dump/book_store
```

---

## 2. Render — API backend

1. [render.com](https://render.com) → **New +** → **Web Service** → connect GitHub repo.
2. Cấu hình:

   | Field | Value |
   |-------|--------|
   | Root Directory | `server/bookstore` |
   | Build Command | `npm install` |
   | Start Command | `npm run start:prod` |
   | Health Check Path | `/health` |

3. **Environment Variables** (bắt buộc):

   | Biến | Ví dụ |
   |------|--------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | chuỗi Atlas ở trên |
   | `CLIENT_BASE_URL` | `https://your-app.vercel.app` |
   | `API_PUBLIC_URL` | `https://bookstore-api.onrender.com` (URL Render sau deploy) |
   | `CORS_ORIGINS` | `https://your-app.vercel.app` |

4. Copy toàn bộ biến chatbot/Qdrant/SMTP từ `.env` local (không commit `.env` lên Git).

5. Deploy → mở `https://xxx.onrender.com/health` → `{"ok":true,"mongo":true}`.

**Lưu ý free tier:** server ngủ sau ~15 phút; lần đầu wake ~30–60s.  
**Upload ảnh:** mỗi redeploy có thể mất file trong `uploads` — backup hoặc dùng Cloudinary sau.

---

## 3. Vercel — Frontend

1. [vercel.com](https://vercel.com) → Import Git repo.
2. Cấu hình:

   | Field | Value |
   |-------|--------|
   | Root Directory | `CRA/bookstore` |
   | Framework | Create React App |
   | Build Command | `npm run build` |
   | Output Directory | `build` |

3. **Environment Variables:**

   | Biến | Value |
   |------|--------|
   | `REACT_APP_API_URL` | URL Render API (không slash cuối), vd `https://bookstore-api.onrender.com` |

4. Deploy. File `public/vercel.json` đã cấu hình SPA rewrite (React Router).

5. Quay lại Render → cập nhật `CLIENT_BASE_URL` và `CORS_ORIGINS` đúng URL Vercel → Redeploy API.

---

## 4. Dev local (không đổi thói quen)

**Terminal 1 — API:**

```bash
cd server/bookstore
npm start
```

**Terminal 2 — Web:**

```bash
cd CRA/bookstore
npm start
```

- `CRA/bookstore/.env.development` → `REACT_APP_API_URL=http://localhost:3001`
- Mongo local: không set `MONGODB_URI` → dùng `mongodb://localhost:27017/book_store`

---

## 5. VNPay (sandbox demo)

**Local:** Return URL = `http://localhost:3001/payapi/check-payment-vnpay` (tự dùng khi `API_PUBLIC_URL` trống).

**Deploy:**

- `API_PUBLIC_URL` = URL Render (API).
- `CLIENT_BASE_URL` = URL Vercel (frontend).
- Cổng VNPay sandbox — IPN/Return: `https://<api-host>/payapi/check-payment-vnpay`
- Tuỳ chọn env: `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_HOST`

**Test sandbox:** Checkout → chọn **VNPay** → thanh toán trên `sandbox.vnpayment.vn` → quay về `/profile/purchase?payment=success&method=vnpay`.

Thẻ demo (tham khảo tài liệu VNPay): Ngân hàng NCB, số thẻ `9704198526191432198`, tên `NGUYEN VAN A`, OTP `123456`.

---

## 6. Checklist sau deploy

- [ ] Đăng nhập / đăng ký
- [ ] Ảnh sách / hero (URL trỏ Render `/uploads/...`)
- [ ] Chatbot (DeepSeek + Qdrant env trên Render)
- [ ] VNPay sandbox
- [ ] Không commit `.env` — dùng Vercel/Render Dashboard

---

## File đã chuẩn bị trong repo

- `CRA/bookstore/src/config/api.js` — `REACT_APP_API_URL`
- `CRA/bookstore/.env.development` — dev local
- `CRA/bookstore/public/vercel.json` — SPA routing
- `server/bookstore/src/config/appConfig.js` — Mongo, CORS, public API URL
- `server/bookstore/render.yaml` — blueprint Render (tuỳ chọn)
- `server/bookstore` — `GET /health`, `npm run start:prod`
