import { categoryIdStr } from '../../utils/categoryUtils.js';
import { formatDongAsVndLabel, listPriceVnd } from '../function/function.js';

export const EXTRA_IMAGE_SLOTS = [1, 2, 3, 4];

export function seriesIdFromBook(b) {
  if (!b?.series) return '';
  if (typeof b.series === 'object' && b.series._id) return String(b.series._id);
  return String(b.series);
}

export function authorRefIdFromBook(b) {
  if (!b?.authorRef) return '';
  if (typeof b.authorRef === 'object' && b.authorRef._id) return String(b.authorRef._id);
  return String(b.authorRef);
}

export function toNumOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number.parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

export function emptyExtraImageState(existing = {}) {
  return EXTRA_IMAGE_SLOTS.reduce((acc, slot) => {
    acc[slot] = { file: null, preview: '', existingUrl: existing[slot] || '' };
    return acc;
  }, {});
}

export function buildFormStateFromBook(book) {
  if (!book) {
    return {
      name: '',
      price: '',
      category: '',
      description: '',
      publisher: '',
      pages: '',
      weight: '',
      format: '',
      productionYear: '',
      publishedYear: '',
      brand: '',
      supplier: '',
      language: 'vi',
      genres: '',
      ageRange: '',
      manufacturingOrigin: '',
      brandOrigin: '',
      coverColor: '',
      series: '',
      seriesNewName: '',
      authorRef: '',
      authorNewName: '',
      isMemberOnly: 'true',
      status: 'draft',
      discount: '0',
      isFavourite: 'true',
    };
  }
  return {
    name: book.name || '',
    price: formatDongAsVndLabel(listPriceVnd(book.price)) || String(book.price ?? ''),
    category: categoryIdStr(book.category),
    description: book.description || '',
    publisher: book.publisher ?? '',
    pages: book.pages != null ? String(book.pages) : '',
    weight: book.weight != null ? String(book.weight) : '',
    format: book.format || '',
    productionYear: book.productionYear != null ? String(book.productionYear) : '',
    publishedYear: book.publishedYear != null ? String(book.publishedYear) : '',
    brand: book.brand ?? '',
    supplier: book.supplier ?? '',
    language: book.language || 'vi',
    genres: Array.isArray(book.genres) ? book.genres.join(', ') : '',
    ageRange: book.ageRange ?? '',
    manufacturingOrigin: book.manufacturingOrigin ?? '',
    brandOrigin: book.brandOrigin ?? '',
    coverColor: book.coverColor ?? '',
    series: seriesIdFromBook(book),
    seriesNewName: '',
    authorRef: authorRefIdFromBook(book),
    authorNewName: '',
    isMemberOnly: book.isMemberOnly ? 'true' : 'false',
    status: book.status || 'draft',
    discount: book.discount != null ? String(book.discount) : '0',
    isFavourite: book.isFavourite ? 'true' : 'false',
  };
}

export function coverStateFromBook(book) {
  return { file: null, preview: '', existingUrl: book?.img || '' };
}

export function extraImagesFromBook(book) {
  const existing = {};
  for (const slot of EXTRA_IMAGE_SLOTS) {
    existing[slot] = book?.[`img${slot}`] || '';
  }
  return emptyExtraImageState(existing);
}
