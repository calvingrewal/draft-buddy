"use client";

import type { PickClock } from "@/lib/derive";
import { teamName } from "@/lib/derive";
import type { DraftState, Platform } from "@/lib/types";

const PLATFORM_LABEL: Record<Platform, string> = { espn: "ESPN", sleeper: "Sleeper" };

function ago(ts: number | null, now: number): string {
  if (!ts) return "never";
  const secs = Math.max(0, Math.round((now - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

export default function TopBar({
  platform,
  onPlatformChange,
  state,
  clock,
  myTeamId,
  fetchedAt,
  now,
  error,
  loading,
  onRefresh,
}: {
  platform: Platform;
  onPlatformChange: (p: Platform) => void;
  state: DraftState | null;
  clock: PickClock;
  myTeamId: string;
  fetchedAt: number | null;
  now: number;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const stale = fetchedAt != null && now - fetchedAt > 20000;
  const isMyTurn = Boolean(myTeamId) && clock.onClockTeamId === myTeamId;
  const round =
    state && clock.currentPickNo
      ? Math.ceil(clock.currentPickNo / state.teamCount)
      : null;

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="flex rounded-lg bg-neutral-900 p-0.5 text-sm">
          {(["espn", "sleeper"] as Platform[]).map((p) => (
            <button
              key={p}
              onClick={() => onPlatformChange(p)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                platform === p ? "bg-neutral-700 text-white" : "text-neutral-400"
              }`}
            >
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 truncate text-sm text-neutral-400">
          {state?.leagueName ?? "No draft loaded"}
        </div>
        <button
          onClick={onRefresh}
          className={`rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs ${
            stale ? "border-amber-500 text-amber-400" : "text-neutral-300"
          }`}
        >
          {loading ? "…" : ago(fetchedAt, now)}
        </button>
      </div>

      <div className="px-3 pb-3 pt-2">
        {isMyTurn ? (
          <div className="rounded-lg bg-emerald-600 px-3 py-2 text-center text-base font-semibold">
            You&apos;re on the clock — pick {clock.currentPickNo}
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <div className="min-w-0 truncate">
              <span className="text-neutral-500">Pick </span>
              <span className="font-semibold">{clock.currentPickNo ?? "—"}</span>
              {round ? <span className="text-neutral-500"> (R{round})</span> : null}
              <span className="text-neutral-500"> · </span>
              <span className="truncate">{teamName(state, clock.onClockTeamId)}</span>
            </div>
            <div className="shrink-0 text-right">
              {clock.picksUntilMe != null ? (
                <span
                  className={
                    clock.picksUntilMe <= 3 ? "font-semibold text-amber-400" : "text-neutral-300"
                  }
                >
                  {clock.picksUntilMe === 0
                    ? "your pick"
                    : `${clock.picksUntilMe} until you`}
                </span>
              ) : (
                <span className="text-neutral-500">set your team</span>
              )}
            </div>
          </div>
        )}
        {clock.myUpcoming.length > 1 ? (
          <div className="pt-1 text-xs text-neutral-500">
            Your picks: {clock.myUpcoming.join(", ")}
          </div>
        ) : null}
        {error ? (
          <div className="mt-2 rounded-lg bg-red-950 px-3 py-1.5 text-xs text-red-300">
            Sync error: {error} — manual cross-off still works.
          </div>
        ) : null}
        {state?.status === "pre_draft" ? (
          <div className="pt-1 text-xs text-neutral-500">Draft has not started yet.</div>
        ) : null}
        {state?.liveFeed && state.liveFeed.status !== "off" ? (
          <div
            className={`pt-1 text-xs ${
              state.liveFeed.status === "live" ? "text-emerald-400" : "text-neutral-500"
            }`}
          >
            {state.liveFeed.status === "live"
              ? `Live draft room connected${
                  state.liveFeed.filledPicks ? ` · ${state.liveFeed.filledPicks} live picks` : ""
                }`
              : `Live draft room: ${state.liveFeed.error ?? state.liveFeed.status}`}
          </div>
        ) : null}
      </div>
    </header>
  );
}
