const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/**
 * quantity luôn > 0; stockDirection in/out xác định cộng hay trừ tồn (aggregate dễ).
 * import / return → in; sale → out; adjust → in hoặc out tùy stockDirection.
 */
const StockMovementSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    type: {
      type: String,
      enum: ['import', 'sale', 'return', 'adjust'],
      required: true,
    },
    stockDirection: {
      type: String,
      enum: ['in', 'out'],
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    balanceBefore: { type: Number, default: null },
    balanceAfter: { type: Number, default: null },
    /** Giá nhập đơn vị (đồng VNĐ) — chủ yếu ghi cho import/return */
    importPrice: { type: Number, default: null },
    /** Nhà cung cấp của đợt nhập (nếu có) */
    supplierName: { type: String, default: '', trim: true, maxlength: 200 },
    note: { type: String, default: '' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    /** Email hoặc id người thao tác (admin) */
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockMovement', StockMovementSchema, 'stock_movements');
