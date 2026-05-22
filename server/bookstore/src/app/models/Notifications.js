const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Notification = new Schema({
    email: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['cart', 'order', 'order_status', 'payment', 'review', 'voucher'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    link: {
        type: String,
        default: null
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        default: null
    },
    bookImage: {
        type: String,
        default: null
    },
    bookTitle: {
        type: String,
        default: null
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: null
    },
    /** Tách luồng thông báo storefront (user) vs trang quản trị (admin), tránh trùng khi cùng email */
    audience: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
        index: true,
    },
}, {
    timestamps: true
});

Notification.index({ email: 1, createdAt: -1 });
Notification.index({ email: 1, isRead: 1 });
Notification.index({ email: 1, audience: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', Notification);
