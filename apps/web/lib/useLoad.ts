"use client";

import { useCallback, useEffect, useState } from "react";

/** Loads data once (and again on reload() or when deps change). Ignores responses from stale requests. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: boolean; loading: boolean }>({ data: null, error: false, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    load()
      .then((data) => !cancelled && setState({ data, error: false, loading: false }))
      .catch(() => !cancelled && setState({ data: null, error: true, loading: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
