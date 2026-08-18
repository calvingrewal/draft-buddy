"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftState, Platform } from "./types";

export interface Feed {
  state: DraftState | null;
  error: string | null;
  fetchedAt: number | null;
  loading: boolean;
  refresh: () => void;
}

/** Polls the server draft snapshot, keeping the last good state on failure. */
export function useDraftFeed(
  platform: Platform,
  id: string,
  season: string,
  pollSeconds: number,
): Feed {
  const [state, setState] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const target = useRef({ platform, id, season });
  target.current = { platform, id, season };

  const fetchOnce = useCallback(async () => {
    const { platform: p, id: i, season: s } = target.current;
    if (!i || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/draft?platform=${p}&id=${encodeURIComponent(i)}&season=${s}&t=${Date.now()}`,
        { cache: "no-store" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setState(body as DraftState);
      setFetchedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setState(null);
    setFetchedAt(null);
    setError(null);
  }, [platform, id, season]);

  useEffect(() => {
    if (!id) return;
    // Debounced so typing a league id doesn't fire (and fail) a request per keystroke.
    const first = window.setTimeout(() => void fetchOnce(), 600);
    const ms = Math.max(2, pollSeconds) * 1000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchOnce();
    }, ms);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchOnce();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchOnce, id, platform, season, pollSeconds]);

  return { state, error, fetchedAt, loading, refresh: () => void fetchOnce() };
}
