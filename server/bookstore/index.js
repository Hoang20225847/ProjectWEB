require('dotenv').config();

const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const route = require('./src/routes');
const { initChatbot } = require('./src/app/chatbot');
const {
  getPort,
  getMongoUri,
  getCorsOrigins,
  getPublicApiUrl,
  isProduction,
} = require('./src/config/appConfig');

const app = express();
app.set('trust proxy', 1);
const port = getPort();
const mongoURI = getMongoUri();
const uploadsDir = path.join(__dirname, 'src/public/uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const corsOrigins = getCorsOrigins();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      if (!isProduction()) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    mongo: mongoose.connection.readyState === 1,
  });
});

route(app);

async function bootstrap() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Kết nối MongoDB thành công!', isProduction() ? '(production)' : '(dev)');

    try {
      initChatbot(app);
    } catch (err) {
      console.error('[chatbot] initChatbot failed:', err);
    }

    app.listen(port, () => {
      console.log(`API listening on port ${port}`);
      console.log(`Public API URL (uploads/VNPay): ${getPublicApiUrl()}`);
      console.log(`CORS origins: ${corsOrigins.join(', ')}`);
    });
  } catch (err) {
    console.error('Kết nối MongoDB thất bại!', err);
    process.exit(1);
  }
}

bootstrap();
