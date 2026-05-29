import axios from '../../components/axios/axios.customize'
export async function getCategoryList() {
  try {
    const response = await fetch(`/api/categories`);
    if (!response.ok) {
      throw new Error(`Lỗi HTTP: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Lỗi khi lấy danh mục:', err);
    return [];
  }
}

/** Lọc sách theo query API /api/books/filter — chỉ gửi field có giá trị */
export async function getBooksFilter({
  categoryId,
  year,
  productionYear,
  author,
  authorId,
  publisher,
  format,
  pagesMin,
  pagesMax,
  weightMin,
  weightMax,
  memberOnly,
} = {}) {
  try {
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (year) params.set('year', String(year));
    if (productionYear) params.set('productionYear', String(productionYear));
    if (authorId) params.set('authorId', String(authorId).trim());
    if (author) params.set('author', author);
    if (publisher) params.set('publisher', publisher);
    if (format) params.set('format', format);
    if (pagesMin != null && pagesMin !== '') params.set('pagesMin', String(pagesMin));
    if (pagesMax != null && pagesMax !== '') params.set('pagesMax', String(pagesMax));
    if (weightMin != null && weightMin !== '') params.set('weightMin', String(weightMin));
    if (weightMax != null && weightMax !== '') params.set('weightMax', String(weightMax));
    if (memberOnly != null && memberOnly !== '') params.set('memberOnly', String(memberOnly));
    const response = await fetch(`/api/books/filter?${params.toString()}`);
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Lỗi lọc sách:', err);
    return [];
  }
}

/** Có JWT (admin) → mọi trạng thái; không token → chỉ published (+ legacy). */
export async function getBookList() {
  try {
    const data = await axios.get('/api/books');
    const arr = Array.isArray(data) ? data : [];
    arr.sort(
      (a, b) =>
        new Date(b.publishedAt || b.createAt || 0) - new Date(a.publishedAt || a.createAt || 0)
    );
    return arr;
  } catch (err) {
    console.error('Lỗi khi lấy dữ liệu:', err);
    return [];
  }
}
  export async function removeBook(id) {
  try {
    const response = await axios.delete(`/api/books/${id}`);
      console.log(response)

  } catch (err) {
    console.error('Lỗi .....:', err);
  }
}
