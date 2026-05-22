const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const USER_VOUCHER_STATUS = ['active', 'used', 'expired', 'disabled'];

const UserVoucherSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    voucher: { type: Schema.Types.ObjectId, ref: 'Voucher', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    status: { type: String, enum: USER_VOUCHER_STATUS, default: 'active', index: true },
    assignedBy: { type: String, default: 'system' },
    assignedAt: { type: Date, default: Date.now },
    usedAt: { type: Date, default: null },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true },
);

UserVoucherSchema.index({ email: 1, voucher: 1 }, { unique: true });

const UserVoucher = mongoose.model('UserVoucher', UserVoucherSchema);
UserVoucher.USER_VOUCHER_STATUS = USER_VOUCHER_STATUS;

module.exports = UserVoucher;
