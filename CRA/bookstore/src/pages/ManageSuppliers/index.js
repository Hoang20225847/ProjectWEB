import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { toast } from 'react-toastify';
import adminStyles from '../../components/Layout/AdminLayout/Admin.module.scss';
import styles from './ManageSuppliers.module.scss';
import axios from '../../components/axios/axios.customize.js';

const cx = classNames.bind({ ...adminStyles, ...styles });

function ManageSuppliers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formName, setFormName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await axios.get('/api/suppliers');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      toast.error('Không tải được nhà cung cấp');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi')), [rows]);

  const create = async (e) => {
    e.preventDefault();
    const name = String(formName || '').trim();
    if (!name) return toast.error('Nhập tên nhà cung cấp');
    try {
      await axios.post('/api/suppliers', { name });
      setFormName('');
      toast.success('Đã thêm nhà cung cấp');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Thêm thất bại (có thể bị trùng tên)');
    }
  };

  const startEdit = (row) => {
    setEditingId(String(row._id));
    setEditingName(String(row.name || ''));
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditingName('');
  };

  const saveEdit = async () => {
    const name = String(editingName || '').trim();
    if (!name) return toast.error('Tên không được rỗng');
    try {
      await axios.put(`/api/suppliers/${editingId}`, { name });
      toast.success('Đã cập nhật nhà cung cấp');
      cancelEdit();
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cập nhật thất bại');
    }
  };

  const remove = async (row) => {
    const ok = window.confirm(`Xóa nhà cung cấp "${row.name}"?`);
    if (!ok) return;
    try {
      await axios.delete(`/api/suppliers/${row._id}`);
      toast.success('Đã xóa');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Xóa thất bại');
    }
  };

  return (
    <div className={cx('page-content', 'supplierPage')}>
      <div className={cx('admin-nav')}>
        <div className={cx('admin-title')}>
          <i className="fa-solid fa-truck" />
          <span className={cx('admin-title-name')}>Quản lý nhà cung cấp</span>
        </div>
        <div />
      </div>

      <div className={cx('supplierPanel', 'cardAnim')}>
        <h3 className={cx('sectionTitle')}>Thêm mới</h3>
        <form onSubmit={create} className={cx('createForm')}>
          <input
            className={cx('input')}
            placeholder="VD: Nhã Nam, Tân Việt..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            <i className="fa-solid fa-plus" /> Thêm
          </button>
        </form>
      </div>

      <div className={cx('supplierPanel', 'cardAnim')}>
        <h3 className={cx('sectionTitle')}>Danh sách</h3>
        {loading ? (
          <p className={cx('loadingText')}>Đang tải...</p>
        ) : sorted.length === 0 ? (
          <p className={cx('emptyText')}>Chưa có nhà cung cấp.</p>
        ) : (
          <div className={cx('tableWrap')}>
            <table className={cx('table')}>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th style={{ width: 260 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const isEditing = String(r._id) === editingId;
                  return (
                    <tr key={String(r._id)}>
                      <td>
                        {isEditing ? (
                          <input className={cx('input')} value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                        ) : (
                          <span className={cx('nameText')}>{r.name}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className={cx('rowActions')}>
                            <button type="button" className="btn btn--primary" onClick={saveEdit}>
                              <i className="fa-solid fa-floppy-disk" /> Lưu
                            </button>
                            <button type="button" className="btn btn--secondary" onClick={cancelEdit}>
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className={cx('rowActions')}>
                            <button type="button" className="btn btn--secondary" onClick={() => startEdit(r)}>
                              <i className="fa-solid fa-pen" /> Sửa
                            </button>
                            <button type="button" className={cx('dangerBtn')} onClick={() => remove(r)}>
                              <i className="fa-solid fa-trash" /> Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageSuppliers;

