import styles from '../../components/Layout/AdminLayout/Admin.module.scss';
import classNames from 'classnames/bind';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../components/axios/axios.customize.js';
import { getBookList } from '../../app/api/siteApi.js';
import { toast } from 'react-toastify';
import '@fortawesome/fontawesome-free/css/all.min.css';

const cx = classNames.bind(styles);

function ManageAuthors() {
  const [rows, setRows] = useState(null);
  const [nameFilter, setNameFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [membersAuthor, setMembersAuthor] = useState(null);
  const [allBooks, setAllBooks] = useState([]);
  const [memberIds, setMemberIds] = useState(() => new Set());
  const [bookSearch, setBookSearch] = useState('');
  const [savingMembers, setSavingMembers] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/authors');
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error('Không tải được danh sách tác giả');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.slug || '').toLowerCase().includes(q)
    );
  }, [rows, nameFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name) {
      toast.error('Nhập tên tác giả');
      return;
    }
    try {
      await axios.post('/api/authors', { name, description: createDesc.trim() });
      toast.success('Đã tạo tác giả');
      setCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không tạo được tác giả');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    try {
      await axios.put(`/api/authors/${editRow._id}`, {
        name: editRow.name.trim(),
        slug: editRow.slug.trim().toLowerCase(),
        description: (editRow.description || '').trim(),
        sortOrder: Number(editRow.sortOrder) || 0,
      });
      toast.success('Đã cập nhật tác giả');
      setEditRow(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Lỗi cập nhật');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Xóa tác giả "${row.name}"? Sách liên kết sẽ được gỡ tác giả.`)) return;
    try {
      await axios.delete(`/api/authors/${row._id}`);
      toast.success('Đã xóa tác giả');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không xóa được');
    }
  };

  const openMembers = async (row) => {
    setMembersAuthor(row);
    setBookSearch('');
    try {
      const [byAuthor, all] = await Promise.all([
        axios.get(`/api/authors/${row._id}/books`),
        getBookList(),
      ]);
      const inArr = Array.isArray(byAuthor) ? byAuthor : [];
      const books = Array.isArray(all) ? all : [];
      setAllBooks(books);
      setMemberIds(new Set(inArr.map((b) => String(b._id))));
    } catch {
      toast.error('Không tải danh sách sách');
      setMembersAuthor(null);
    }
  };

  const toggleMember = (id) => {
    const s = String(id);
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const saveMembers = async () => {
    if (!membersAuthor) return;
    setSavingMembers(true);
    try {
      await axios.put(`/api/authors/${membersAuthor._id}/members`, {
        bookIds: [...memberIds],
      });
      toast.success('Đã cập nhật sách của tác giả');
      setMembersAuthor(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Lưu thất bại');
    }
    setSavingMembers(false);
  };

  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    if (!q) return allBooks;
    return allBooks.filter((b) => (b.name || '').toLowerCase().includes(q));
  }, [allBooks, bookSearch]);

  if (!rows) {
    return (
      <div className={cx('resourceCatalog')}>
        <div className={cx('resourceCatalogLoading')}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.2rem', color: '#14b8a6' }} />
          Đang tải tác giả…
        </div>
      </div>
    );
  }

  return (
    <div className={cx('resourceCatalog')}>
      <div className={cx('admin-nav')}>
        <div className={`${cx('logo-search')} admin-title`}>
          <div>
            <i className="fa-solid fa-pen-nib" />
            <span className="admin-title-name">Quản lý tác giả</span>
          </div>
        </div>
        <div className={cx('resourceCatalogToolbar')}>
          <input
            className={cx('input')}
            placeholder="Lọc theo tên / slug…"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
          <button type="button" className={cx('btn-controll')} onClick={() => setCreateOpen((o) => !o)}>
            <i className="fa-solid fa-plus" /> Tác giả mới
          </button>
        </div>
      </div>

      {createOpen && (
        <form onSubmit={handleCreate} className={cx('resourceCatalogCreate')}>
          <strong>Tạo tác giả mới</strong>
          <input
            className={cx('input')}
            placeholder="Tên tác giả *"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <textarea
            className={cx('input-big')}
            rows={3}
            placeholder="Tiểu sử / ghi chú (tùy chọn)"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn--primary">
              Tạo
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className={cx('resourceCatalogTable')}>
        <div className={cx('resourceCatalogTableHead')}>
          <span>Tên &amp; slug</span>
          <span>Số sách</span>
          <span>Thứ tự</span>
          <span>Thao tác</span>
        </div>
        {filtered.map((r) => (
          <div key={r._id} className={cx('resourceCatalogTableRow')}>
            <div>
              <div className={cx('resourceCatalogName')}>{r.name}</div>
              <div className={cx('resourceCatalogSlug')}>{r.slug}</div>
            </div>
            <span className={cx('resourceCatalogStat')}>{r.bookCount ?? 0}</span>
            <span className={cx('resourceCatalogStat')}>{r.sortOrder ?? 0}</span>
            <div className={cx('resourceCatalogActions')}>
              <button type="button" className={cx('btn-controll')} title="Sửa" onClick={() => setEditRow({ ...r })}>
                <i className="fa-solid fa-pen" />
              </button>
              <button type="button" className={cx('btn-controll')} title="Chọn sách" onClick={() => openMembers(r)}>
                <i className="fa-solid fa-book-bookmark" />
              </button>
              <button type="button" className={`${cx('btn-controll')} delete`} title="Xóa" onClick={() => handleDelete(r)}>
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className={cx('resourceCatalogEmpty')}>Chưa có tác giả nào. Thêm tác giả để gán cho sách.</p>
        )}
      </div>

      {editRow && (
        <div className={cx('modalOverlay')} onClick={() => setEditRow(null)}>
          <div className={cx('modalContent')} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className={cx('modalHeader')}>
              <h3>Sửa tác giả</h3>
              <button type="button" className={cx('modalClose')} onClick={() => setEditRow(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className={cx('modalBody')}>
              <div className={cx('formGroup')}>
                <label>Tên</label>
                <input
                  className={cx('input')}
                  value={editRow.name}
                  onChange={(e) => setEditRow((x) => ({ ...x, name: e.target.value }))}
                />
              </div>
              <div className={cx('formGroup')}>
                <label>Slug (URL)</label>
                <input
                  className={cx('input')}
                  value={editRow.slug}
                  onChange={(e) => setEditRow((x) => ({ ...x, slug: e.target.value }))}
                />
              </div>
              <div className={cx('formGroup')}>
                <label>Mô tả</label>
                <textarea
                  className={cx('input-big')}
                  rows={3}
                  value={editRow.description || ''}
                  onChange={(e) => setEditRow((x) => ({ ...x, description: e.target.value }))}
                />
              </div>
              <div className={cx('formGroup')}>
                <label>Thứ tự</label>
                <input
                  type="number"
                  className={cx('input')}
                  value={editRow.sortOrder ?? 0}
                  onChange={(e) => setEditRow((x) => ({ ...x, sortOrder: e.target.value }))}
                />
              </div>
              <div className={cx('modalFooter')}>
                <button type="button" className="btn btn--secondary" onClick={() => setEditRow(null)}>
                  Đóng
                </button>
                <button type="submit" className="btn btn--primary">
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {membersAuthor && (
        <div className={cx('modalOverlay')} onClick={() => !savingMembers && setMembersAuthor(null)}>
          <div
            className={`${cx('modalContent')} ${cx('resourceCatalogMemberModal')}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cx('modalHeader')}>
              <h3>Chọn sách — {membersAuthor.name}</h3>
              <button type="button" className={cx('modalClose')} disabled={savingMembers} onClick={() => setMembersAuthor(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className={`${cx('modalBody')} ${cx('resourceCatalogMemberBody')}`}>
              <input
                className={cx('input')}
                placeholder="Tìm theo tên sách…"
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
              />
              <div className={cx('resourceCatalogMemberList')}>
                {filteredBooks.map((b) => (
                  <label key={b._id} className={cx('resourceCatalogMemberRow')}>
                    <input
                      type="checkbox"
                      checked={memberIds.has(String(b._id))}
                      onChange={() => toggleMember(b._id)}
                    />
                    <span>{b.name}</span>
                  </label>
                ))}
              </div>
              <p className={cx('resourceCatalogMemberFooterNote')}>
                Đã chọn: <strong>{memberIds.size}</strong> cuốn
              </p>
            </div>
            <div className={cx('modalFooter')}>
              <button type="button" className="btn btn--secondary" disabled={savingMembers} onClick={() => setMembersAuthor(null)}>
                Đóng
              </button>
              <button type="button" className="btn btn--primary" disabled={savingMembers} onClick={saveMembers}>
                {savingMembers ? <i className="fa-solid fa-spinner fa-spin" /> : 'Lưu danh sách'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageAuthors;
