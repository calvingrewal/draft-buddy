"use client";

import { useCallback, useEffect, useState } from "react";
import type { Platform, RankedPlayer } from "./types";

export interface RankingSet {
  id: string;
  name: string;
  createdAt: number;
  players: RankedPlayer[];
}

export interface DraftConfig {
  /** league id, draft id, or pasted platform URL */
  id: string;
  season: string;
  myTeamId: string;
  rankingSetId: string;
  /** player keys crossed off by hand when live sync is unavailable */
  manualDrafted: Record<string, string>;
}

export interface AppState {
  version: 1;
  active: Platform;
  drafts: Record<Platform, DraftConfig>;
  rankingSets: RankingSet[];
  pollSeconds: number;
  hideDrafted: boolean;
}

const STORAGE_KEY = "draft-buddy:state";

function emptyDraft(): DraftConfig {
  return { id: "", season: "2026", myTeamId: "", rankingSetId: "", manualDrafted: {} };
}

export function defaultState(): AppState {
  return {
    version: 1,
    active: "espn",
    drafts: { espn: emptyDraft(), sleeper: emptyDraft() },
    rankingSets: [],
    pollSeconds: 5,
    hideDrafted: true,
  };
}

function load(): AppState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      drafts: {
        espn: { ...base.drafts.espn, ...parsed.drafts?.espn },
        sleeper: { ...base.drafts.sleeper, ...parsed.drafts?.sleeper },
      },
      rankingSets: parsed.rankingSets ?? [],
    };
  } catch {
    return defaultState();
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable; in-memory state still works for this session
    }
  }, [state, loaded]);

  const update = useCallback((fn: (prev: AppState) => AppState) => {
    setState((prev) => fn(prev));
  }, []);

  const updateDraft = useCallback(
    (platform: Platform, fn: (prev: DraftConfig) => DraftConfig) => {
      setState((prev) => ({
        ...prev,
        drafts: { ...prev.drafts, [platform]: fn(prev.drafts[platform]) },
      }));
    },
    [],
  );

  return { state, loaded, update, updateDraft };
}
