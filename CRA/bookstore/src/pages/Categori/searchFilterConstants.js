/** Các query key gửi lên GET /api/books/filter */
export const SEARCH_FILTER_QUERY_KEYS = [
  'categoryId',
  'categorySlug',
  'year',
  'productionYear',
  'author',
  'authorId',
  'publisher',
  'format',
  'formats',
  'pagesMin',
  'pagesMax',
  'weightMin',
  'weightMax',
  'priceBands',
  'priceMinDong',
  'priceMaxDong',
  'genres',
  'languages',
  'brands',
  'suppliers',
  'ageRanges',
  'manufacturingOrigins',
  'brandOrigins',
  'coverColors',
  'memberOnly',
];

/** Khoảng giá (đồng) — đồng bộ với logic giá trong DB */
export const PRICE_BAND_OPTIONS = [
  { label: '0đ - 150.000đ', value: '0-150000' },
  { label: '150.000đ - 300.000đ', value: '150000-300000' },
  { label: '300.000đ - 500.000đ', value: '300000-500000' },
  { label: '500.000đ - 700.000đ', value: '500000-700000' },
  { label: '700.000đ trở lên', value: '700000-2000000000' },
];

export const GENRE_FILTER_OPTIONS = [
  { value: 'comedy', label: 'Comedy' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'shounen', label: 'Shounen' },
  { value: 'school_life', label: 'School Life' },
  { value: 'slice_of_life', label: 'Slice Of Life' },
  { value: 'drama', label: 'Drama' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'romance', label: 'Romance' },
  { value: 'sci_fi', label: 'Sci-Fi' },
];

export const LANGUAGE_FILTER_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'Tiếng Anh' },
  { value: 'zh', label: 'Tiếng Trung' },
];

export const SUPPLIER_FILTER_OPTIONS = [
  { value: 'NXB Trẻ', label: 'NXB Trẻ' },
  { value: 'Nhã Nam', label: 'Nhã Nam' },
  { value: 'Huy Hoàng Bookstore', label: 'Huy Hoàng Bookstore' },
  { value: 'NXB Tổng Hợp TP.HCM', label: 'NXB Tổng Hợp TP.HCM' },
  { value: 'NXB Kim Đồng', label: 'NXB Kim Đồng' },
  { value: 'Đông A', label: 'Đông A' },
  { value: 'Phụ Nữ', label: 'Phụ Nữ' },
  { value: 'Đinh Tị', label: 'Đinh Tị' },
  { value: 'Alpha Books', label: 'Alpha Books' },
];

export const BRAND_FILTER_OPTIONS = [{ value: 'OEM', label: 'OEM' }];

export const AGE_RANGE_OPTIONS = [
  { value: '18+', label: '18+' },
  { value: '16+', label: '16+' },
  { value: '15+', label: '15+' },
  { value: '14+', label: '14+' },
  { value: '10+', label: '10+' },
  { value: '8+', label: '8+' },
  { value: '15-18', label: '15 - 18' },
  { value: '11-15', label: '11 - 15' },
];

export const MANUFACTURING_ORIGIN_OPTIONS = [{ value: 'Trung Quốc', label: 'Trung Quốc' }];

export const BRAND_ORIGIN_OPTIONS = [{ value: 'Trung Quốc', label: 'Trung Quốc' }];

export const COVER_COLOR_OPTIONS = [{ value: 'Đen', label: 'Đen' }];
