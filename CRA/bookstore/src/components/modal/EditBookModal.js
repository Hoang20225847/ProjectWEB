import BookFormModal from './BookFormModal.js';

/** @deprecated Dùng BookFormModal — giữ export để tương thích import cũ */
export default function EditBookModal({ book, onClose, onSave }) {
  return <BookFormModal book={book} onClose={onClose} onSuccess={onSave} />;
}
