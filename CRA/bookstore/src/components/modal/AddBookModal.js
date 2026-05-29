import BookFormModal from './BookFormModal.js';

/** @deprecated Dùng BookFormModal — giữ export để tương thích import cũ */
export default function AddBookModal({ onClose, onAddSuccess }) {
  return <BookFormModal book={null} onClose={onClose} onSuccess={onAddSuccess} />;
}
