import axios from '../components/axios/axios.customize';

export const ACCEPT_BOOK_IMAGE = 'image/jpeg,image/png,image/webp,image/gif';
export const MAX_BOOK_IMAGE_BYTES = 8 * 1024 * 1024;

export function validateBookImageFile(file) {
  if (!file) return 'Chưa chọn file';
  if (!ACCEPT_BOOK_IMAGE.split(',').some((t) => file.type === t)) {
    return 'Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF';
  }
  if (file.size > MAX_BOOK_IMAGE_BYTES) {
    return 'Ảnh tối đa 8MB';
  }
  return null;
}

/** @param {File} file @param {string} bookName @param {'cover'|'1'|'2'|'3'|'4'} slot */
export async function uploadBookCoverFile(file, bookName, slot = 'cover') {
  const fd = new FormData();
  fd.append('cover', file);
  fd.append('bookName', bookName);
  fd.append('slot', slot);
  const res = await axios.post('/api/books/upload-cover', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res?.url || res?.fullUrl || '';
}
