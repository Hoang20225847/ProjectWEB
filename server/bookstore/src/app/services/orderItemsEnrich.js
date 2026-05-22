const mongoose = require('mongoose');
const Book = require('../models/Books');

/**
 * Chuẩn hóa items đơn hàng: bookId ObjectId, gắn unitImportCost = costPrice sách tại thời điểm đặt (đồng VNĐ).
 * Dùng cho COGS thống kê theo đúng giá vốn lúc bán, không phụ thuộc costPrice sau này.
 */
async function enrichOrderItemsWithUnitImportCost(items) {
  if (!Array.isArray(items)) return items;
  const out = [];
  for (const it of items) {
    const rawId = it?.bookId?._id || it?.bookId;
    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) continue;
    const b = await Book.findById(rawId).select('costPrice').lean();
    const unitImportCost = Number(b?.costPrice) || 0;
    out.push({
      bookId: new mongoose.Types.ObjectId(String(rawId)),
      quantity: Math.floor(Number(it.quantity)) || 0,
      price: Number(it.price) || 0,
      totalPrice: Number(it.totalPrice) || 0,
      unitImportCost,
    });
  }
  return out;
}

module.exports = { enrichOrderItemsWithUnitImportCost };
