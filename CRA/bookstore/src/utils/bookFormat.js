/** Giá trị lưu DB — đồng bộ với validate `format` ở API */
export const BOOK_FORMAT_VALUES = [
  'paperback',
  'hardcover',
  'spiral',
  'flexibound',
  'box_set',
  'leather',
  'other',
];

export const BOOK_FORMAT_OPTIONS = [
  { value: '', label: '— Chưa chọn —' },
  { value: 'paperback', label: 'Bìa mềm' },
  { value: 'hardcover', label: 'Bìa cứng' },
  { value: 'spiral', label: 'Gáy xoắn' },
  { value: 'flexibound', label: 'Bìa dẻo' },
  { value: 'box_set', label: 'Bộ hộp' },
  { value: 'leather', label: 'Bìa da' },
  { value: 'other', label: 'Khác' },
];

export function bookFormatLabel(value) {
  if (value == null || value === '') return '—';
  const row = BOOK_FORMAT_OPTIONS.find((o) => o.value === value);
  return row ? row.label : String(value);
}
