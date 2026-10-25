import { useCallback, useEffect, useState } from 'react';

const VISIBLE_MS = 1500;

interface Notice {
  readonly text: string;
  readonly id: number;
}

/** A short message that hides itself; showing it again restarts the timer. */
export function useNotice(): [text: string | null, show: (text: string) => void] {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, VISIBLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);

  const show = useCallback((text: string) => {
    setNotice((previous) => ({ text, id: (previous?.id ?? 0) + 1 }));
  }, []);

  return [notice?.text ?? null, show];
}
