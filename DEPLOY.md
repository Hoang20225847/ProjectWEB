# Deploy BookStore — Localhost (Production Mode)

Tài liệu này mô tả hai môi trường chạy của dự án:

| Môi trường | Mục đích | Lệnh chính |
|------------|----------|------------|
| **Dev** | Đang code, hot reload | `npm start` (cả hai phía) |
| **Production localhost** | Demo, bảo vệ đồ án | `start:local-prod` + build + `serve:local` |

---

## Kiến trúc hệ thống

```
Trình duyệt
    │
    ├── http://localhost:3000  ←  React (bản build tĩnh, serve bằng serve)
    │
    └── http://localhost:3001  ←  Express API (NODE_ENV=production)
                                       │
                                       ├── MongoDB local (book_store)
                                       ├── Qdrant Cloud (QDRANT_URL trong .env)
                                       └── API bên ngoài (LLM, SMTP, MoMo sandbox)
```

---

## 1. Môi trường Dev (hàng ngày, đang code)

**Terminal 1 — API:**

```bash
cd server/bookstore
npm start
```

**Terminal 2 — Frontend:**

```bash
cd CRA/bookstore
npm start
```

- Hot reload, nodemon — thay đổi code thấy ngay
- Không cần build
- `CRA/bookstore/.env.development` → `REACT_APP_API_URL=http://localhost:3001`
- MongoDB local: không set `MONGODB_URI` → dùng `mongodb://localhost:27017/book_store`

---

## 2. Môi trường Production Localhost (demo / bảo vệ đồ án)

### 2.1 Cài dependencies lần đầu

```bash
cd server/bookstore
npm install

cd ../../CRA/bookstore
npm install
```

### 2.2 Chuẩn bị dữ liệu demo (làm 1 lần)

Khi DB đã có đầy đủ sách, tài khoản, voucher, flash sale — export để dùng lại:

```bash
mongodump --db book_store --out ./dump-demo
```

Trước ngày bảo vệ, restore dữ liệu sạch:

```bash
mongorestore --drop --dir ./dump-demo/book_store --db book_store
```

### 2.3 Build frontend (làm 1 lần, hoặc khi sửa code)

```bash
cd CRA/bookstore
npm run build
```

- Đọc `CRA/bookstore/.env.production` → `REACT_APP_API_URL=http://localhost:3001`
- Output: folder `CRA/bookstore/build/`

### 2.4 Chạy hệ thống production

**Terminal 1 — API (production mode):**

```bash
cd server/bookstore
npm run start:local-prod
```

Log khởi động sẽ có:
```
Kết nối MongoDB thành công! (production)
API listening on port 3001
```

Kiểm tra: mở `http://localhost:3001/health` → `{"ok":true,"mongo":true}`

**Terminal 2 — Frontend (bản build):**

```bash
cd CRA/bookstore
npm run serve:local
```

Mở trình duyệt: `http://localhost:3000`

> **Lưu ý:** `serve:local` phục vụ bản build tối ưu hoá, không có hot reload.  
> Nếu sửa code, cần `npm run build` lại rồi `npm run serve:local` lại.

### 2.5 Khác biệt so với Dev

| | Dev (`npm start`) | Production localhost |
|---|---|---|
| Frontend | Dev server, hot reload | Bản build tĩnh |
| Backend | `nodemon`, auto restart | `node`, không restart tự động |
| `NODE_ENV` | không set (undefined) | `production` |
| CORS | Chấp nhận mọi origin | Chỉ `localhost:3000` |
| Debug overlay | Có | Không |

---

## 3. Cấu hình môi trường

### Backend — `server/bookstore/.env`

File này đã có sẵn trên máy phát triển (không commit lên Git). Với production localhost, các biến quan trọng:

```env
# Giữ localhost — không cần URL public
CLIENT_BASE_URL=http://localhost:3000

# MongoDB local (không cần MONGODB_URI → dùng mặc định)
# MONGODB_URI=mongodb://localhost:27017/book_store

# Chatbot, Qdrant, SMTP — giữ nguyên như dev
```

Không cần `MONGODB_URI` nếu dùng Mongo local mặc định.  
Không cần `API_PUBLIC_URL` nếu không cần callback MoMo từ ngoài (xem mục 4).

### Frontend — `CRA/bookstore/.env.production`

```env
REACT_APP_API_URL=http://localhost:3001
```

Biến này được nhúng vào bundle **lúc build**, không đổi sau khi serve.

---

## 4. MoMo Sandbox

**Lưu ý về IPN callback:** MoMo gọi callback về `ipnUrl` để xác nhận thanh toán. Khi chạy localhost, MoMo không thể gọi về `http://localhost:3001` từ server của họ.

Ảnh hưởng thực tế khi demo:

| Bước | Có hoạt động? |
|------|--------------|
| Tạo đơn + lấy link thanh toán MoMo | Có |
| Mở trang `test-payment.momo.vn`, thanh toán | Có |
| Redirect về `/profile/purchase?payment=success` | Có |
| IPN callback (xác nhận trạng thái đơn từ MoMo server) | **Không** (cần URL public) |

**Cách demo:** chọn COD cho demo chính; MoMo demo ở mức tạo link + redirect.  
Trong báo cáo ghi: *"MoMo sandbox được tích hợp; IPN callback hoạt động đầy đủ khi triển khai trên server có domain public."*

---

## 5. Checklist trước ngày bảo vệ

```
Môi trường
  [ ] MongoDB đang chạy (mongod service hoặc chạy tay)
  [ ] npm install hoàn tất cả hai phía
  [ ] npm run build đã chạy, folder build/ tồn tại

Dữ liệu
  [ ] Có sách với ảnh (uploads/ không trống)
  [ ] Có tài khoản user demo và admin demo
  [ ] Có voucher / flash sale để demo

Kiểm thử end-to-end
  [ ] http://localhost:3001/health → {"ok":true,"mongo":true}
  [ ] http://localhost:3000 load được trang chủ, ảnh hiện
  [ ] Đăng nhập / đăng ký
  [ ] Thêm giỏ → Checkout COD → Đơn hàng xuất hiện
  [ ] Chatbot phản hồi (cần internet tới Qdrant/LLM)
  [ ] F5 trên trang con (vd /details/...) không bị 404
  [ ] Admin đăng nhập → quản lý sách / thống kê
```

---

## 6. File cấu hình liên quan

| File | Mục đích |
|------|----------|
| `CRA/bookstore/.env.development` | API URL cho `npm start` (dev) |
| `CRA/bookstore/.env.production` | API URL cho `npm run build` (production localhost) |
| `server/bookstore/.env` | Tất cả biến backend (chatbot, SMTP, Qdrant…) |
| `server/bookstore/src/config/appConfig.js` | Đọc PORT, MONGODB\_URI, CORS, API\_PUBLIC\_URL |
| `CRA/bookstore/src/config/api.js` | Đọc `REACT_APP_API_URL`, giải quyết URL ảnh |
