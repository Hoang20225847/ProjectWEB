const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/**
 * Cache key-value dùng cho flash sale, voucher hot, member benefit.
 * MongoDB TTL: document sẽ tự xoá khi vượt expireAt.
 */
const ChatbotCacheSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    data: { type: Schema.Types.Mixed, default: null },
    expireAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

const ChatbotCache = mongoose.model('ChatbotCache', ChatbotCacheSchema);

ChatbotCache.getValue = async function getValue(key) {
  const doc = await ChatbotCache.findOne({ key, expireAt: { $gt: new Date() } }).lean();
  return doc ? doc.data : null;
};

ChatbotCache.setValue = async function setValue(key, data, ttlSec) {
  const expireAt = new Date(Date.now() + Math.max(1, Number(ttlSec) || 60) * 1000);
  await ChatbotCache.updateOne(
    { key },
    { $set: { data, expireAt } },
    { upsert: true },
  );
};

ChatbotCache.invalidate = async function invalidate(key) {
  await ChatbotCache.deleteOne({ key });
};

module.exports = ChatbotCache;
