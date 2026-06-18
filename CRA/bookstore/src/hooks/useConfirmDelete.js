import { useCallback, useRef, useState } from 'react';
import ConfirmDeleteModal from '../components/modal/ConfirmDeleteModal.js';

/// <summary>
/// Hook thay thế window.confirm: trả Promise boolean và component ConfirmDeleteDialog.
/// </summary>
export function useConfirmDelete() {
  const resolverRef = useRef(null);
  const [options, setOptions] = useState(null);

  const confirmDelete = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions({
        title: 'Xác nhận xóa',
        confirmLabel: 'Xóa',
        cancelLabel: 'Hủy',
        ...opts,
      });
    });
  }, []);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const handleConfirm = useCallback(() => close(true), [close]);
  const handleCancel = useCallback(() => close(false), [close]);

  const ConfirmDeleteDialog = useCallback(
    () => (
      <ConfirmDeleteModal
        open={!!options}
        title={options?.title}
        message={options?.message}
        itemName={options?.itemName}
        warning={options?.warning}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [options, handleConfirm, handleCancel]
  );

  return { confirmDelete, ConfirmDeleteDialog };
}

export default useConfirmDelete;
