import styles from '../Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import { useState } from 'react';
import { formatVndDisplay } from '../function/function.js';
const cx = classNames.bind(styles);

const STATUS_OPTIONS = [
  { value: 'Chờ xử lý', label: 'Chờ xử lý', typeKey: 'Pending' },
  { value: 'Đang giao', label: 'Đang giao hàng', typeKey: 'Shipping' },
  { value: 'Hoàn thành', label: 'Hoàn thành', typeKey: 'Completed' },
  { value: 'Đã hủy', label: 'Đã hủy', typeKey: 'Cancelled' },
];

function EditOrderModal({ order: Order, onClose, onSave }) {
  const [formData, setFormData] = useState({
    ...Order,
    address: {
      phone: Order.address?.phone || '',
      details: Order.address?.details || '',
      province: Order.address?.province || '',
    },
    status: Order.status || 'Chờ xử lý',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (['phone', 'details', 'province'].includes(name)) {
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [name]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) onSave(formData);
    onClose();
  };

  return (
    <div className={cx('modalOverlay')} onClick={onClose}>
      <div className={cx('modalContent')} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={cx('modalHeader')} style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
          <h3>
            <i className="fa-solid fa-truck-fast" style={{ marginRight: 8 }} />
            Sửa Đơn Hàng
          </h3>
          <button type="button" className={cx('modalClose')} onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className={cx('modalBody')}>
          {/* Order Info Summary */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 20,
            border: '1px solid rgba(148,163,184,0.15)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.3rem', color: '#94a3b8' }}>Mã đơn hàng</span>
                <span
                  style={{
                    fontSize: '1.3rem',
                    color: '#475569',
                    fontFamily: 'ui-monospace, monospace',
                    fontWeight: 600,
                    textAlign: 'right',
                    wordBreak: 'break-all',
                    maxWidth: '68%',
                  }}
                >
                  {Order._id ? String(Order._id) : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.3rem', color: '#94a3b8' }}>Email</span>
                <span style={{ fontSize: '1.3rem', color: '#475569' }}>{Order.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.3rem', color: '#94a3b8' }}>Tổng tiền</span>
                <span style={{ fontSize: '1.5rem', color: '#2dd4bf', fontWeight: 700 }}>
                  {formatVndDisplay(Order.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className={cx('formGroup')}>
            <label>Số điện thoại</label>
            <input
              name="phone"
              className={cx('input')}
              type="tel"
              value={formData.address.phone}
              onChange={handleChange}
              placeholder="Số điện thoại..."
            />
          </div>

          <div className={cx('formGroup')}>
            <label>Địa chỉ giao hàng</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                name="details"
                className={cx('input')}
                type="text"
                value={formData.address.details}
                onChange={handleChange}
                placeholder="Số nhà, đường..."
                style={{ flex: 2 }}
              />
              <input
                name="province"
                className={cx('input')}
                type="text"
                value={formData.address.province}
                onChange={handleChange}
                placeholder="Tỉnh / Thành phố..."
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className={cx('formGroup')}>
            <label>Tình trạng đơn hàng</label>
            <div className={cx('orderStatusChips')}>
              {STATUS_OPTIONS.map((opt) => {
                const selected = formData.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, status: opt.value }))}
                    className={cx(
                      'orderStatusChip',
                      `orderStatusChipType${opt.typeKey}`,
                      { orderStatusChipIsSelected: selected }
                    )}
                  >
                    {selected && <i className="fa-solid fa-check" style={{ fontSize: '1.1rem' }} />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className={cx('modalFooter')}>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
              Trở lại
            </button>
            <button type="submit" className="btn btn--primary">
              <i className="fa-solid fa-check" style={{ marginRight: 6 }} />
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditOrderModal;
