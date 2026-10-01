import { useCallback, useEffect, useRef } from "react";

type AutoRefreshOptions = {
  enabled?: boolean;
  canRefresh?: () => boolean;
  intervalMs?: number;
};

type RefreshData = (isBackgroundRefresh: boolean) => void | Promise<void>;

export function useAutoRefresh(
  refreshData: RefreshData,
  options: AutoRefreshOptions = {},
): (isBackgroundRefresh?: boolean) => Promise<void> {
  const refreshDataRef = useRef(refreshData);
  const optionsRef = useRef(options);
  const inFlightRef = useRef(false);
  const lastBackgroundRefreshAtRef = useRef(0);
  refreshDataRef.current = refreshData;
  optionsRef.current = options;

  const runRefresh = useCallback(async (isBackgroundRefresh = false) => {
    if (inFlightRef.current) return;

    if (isBackgroundRefresh) {
      const currentOptions = optionsRef.current;
      if (currentOptions.enabled === false || document.visibilityState !== "visible") return;
      if (currentOptions.canRefresh && !currentOptions.canRefresh()) return;

      const now = Date.now();
      if (now - lastBackgroundRefreshAtRef.current < 1_000) return;
      lastBackgroundRefreshAtRef.current = now;
    }

    inFlightRef.current = true;
    try {
      await refreshDataRef.current(isBackgroundRefresh);
    } catch (error) {
      console.error("[auto-refresh] Data refresh failed.", error);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const intervalMs = options.intervalMs ?? 30_000;
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void runRefresh(true);
    };
    const interval = window.setInterval(refreshWhenVisible, intervalMs);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [intervalMs, runRefresh]);

  return runRefresh;
}