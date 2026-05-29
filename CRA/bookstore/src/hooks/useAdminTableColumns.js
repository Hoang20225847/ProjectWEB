import { useCallback, useEffect, useMemo, useState } from 'react';

function parseStored(raw) {
  try {
    const o = JSON.parse(raw);
    return {
      hidden: new Set(Array.isArray(o.hidden) ? o.hidden : []),
      purged: new Set(Array.isArray(o.purged) ? o.purged : []),
    };
  } catch {
    return { hidden: new Set(), purged: new Set() };
  }
}

function serialize(hidden, purged) {
  return JSON.stringify({
    hidden: [...hidden],
    purged: [...purged],
  });
}

/**
 * @param {string} storageKey
 * @param {{ id: string, label: string, required?: boolean, width: string }[]} columnSpec
 */
export function useAdminTableColumns(storageKey, columnSpec) {
  const [hidden, setHidden] = useState(() => new Set());
  const [purged, setPurged] = useState(() => new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const { hidden: h, purged: p } = parseStored(raw);
      setHidden(h);
      setPurged(p);
    } else {
      setHidden(new Set());
      setPurged(new Set());
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, serialize(hidden, purged));
  }, [storageKey, hidden, purged, ready]);

  const isActive = useCallback(
    (id) => {
      const col = columnSpec.find((c) => c.id === id);
      if (!col) return true;
      if (col.required) return true;
      return !purged.has(id) && !hidden.has(id);
    },
    [columnSpec, hidden, purged]
  );

  const activeColumns = useMemo(
    () => columnSpec.filter((c) => c.required || (!purged.has(c.id) && !hidden.has(c.id))),
    [columnSpec, hidden, purged]
  );

  const gridTemplateColumns = useMemo(
    () => activeColumns.map((c) => c.width).join(' '),
    [activeColumns]
  );

  const toggleVisible = useCallback((id) => {
    const col = columnSpec.find((c) => c.id === id);
    if (!col || col.required || purged.has(id)) return;
    setHidden((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, [columnSpec, purged]);

  const purgeColumn = useCallback((id) => {
    const col = columnSpec.find((c) => c.id === id);
    if (!col || col.required) return;
    setPurged((p) => new Set(p).add(id));
    setHidden((h) => new Set(h).add(id));
  }, [columnSpec]);

  const restorePurged = useCallback((id) => {
    setPurged((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
    setHidden((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    setHidden(new Set());
    setPurged(new Set());
  }, []);

  const optionalColumns = useMemo(
    () => columnSpec.filter((c) => !c.required),
    [columnSpec]
  );

  const purgedColumns = useMemo(
    () => optionalColumns.filter((c) => purged.has(c.id)),
    [optionalColumns, purged]
  );

  return {
    ready,
    isActive,
    activeColumns,
    gridTemplateColumns,
    hidden,
    purged,
    optionalColumns,
    purgedColumns,
    toggleVisible,
    purgeColumn,
    restorePurged,
    resetDefaults,
  };
}
