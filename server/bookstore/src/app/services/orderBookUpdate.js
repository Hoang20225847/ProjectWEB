const mongoose = require('mongoose');
const Book = require('../models/Books');
const StockMovement = require('../models/StockMovement');

function bookIdFromItem(item) {
  const raw = item?.bookId;
  if (!raw) return null;
  if (typeof raw === 'object' && raw._id) return raw._id;
  if (mongoose.Types.ObjectId.isValid(String(raw))) return new mongoose.Types.ObjectId(String(raw));
  return null;
}

/**
 * Sau khi đặt hàng: tăng sold, cập nhật lastSoldAt, trừ tồn (nếu đang quản lý), ghi stock_movements.
 * quantity movement luôn dương, stockDirection = out cho bán.
 */
async function afterOrderItemsSold(items, { orderId } = {}) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const bid = bookIdFromItem(item);
    if (!bid) continue;
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    try {
      const book = await Book.findById(bid);
      if (!book) continue;
      book.sold = (Number(book.sold) || 0) + qty;
      book.lastSoldAt = new Date();

      const unitCogs =
        item && item.unitImportCost != null && !Number.isNaN(Number(item.unitImportCost))
          ? Number(item.unitImportCost)
          : Number(book.costPrice) || 0;

      if (typeof book.stock === 'number' && !Number.isNaN(book.stock)) {
        const balanceBefore = book.stock;
        const next = Math.max(0, balanceBefore - qty);
        await StockMovement.create({
          bookId: bid,
          type: 'sale',
          stockDirection: 'out',
          quantity: qty,
          balanceBefore,
          balanceAfter: next,
          importPrice: unitCogs,
          note: 'Xuất kho theo đơn hàng',
          orderId: orderId || null,
          createdBy: '',
        });
        book.stock = next;
      }

      await book.save();
    } catch (e) {
      console.error('orderBookUpdate error', bid, e);
    }
  }
}

module.exports = { afterOrderItemsSold, bookIdFromItem };
