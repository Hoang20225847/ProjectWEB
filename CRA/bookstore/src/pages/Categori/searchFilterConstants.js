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
  'minRating',
  'onSaleOnly',
];

/** Lọc đánh giá tối thiểu (1–5 sao) */
export const RATING_FILTER_OPTIONS = [
  { value: '5', label: '5 sao trở lên' },
  { value: '4', label: '4 sao trở lên' },
  { value: '3', label: '3 sao trở lên' },
  { value: '2', label: '2 sao trở lên' },
  { value: '1', label: '1 sao trở lên' },
];
