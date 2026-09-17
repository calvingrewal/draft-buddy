"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppState } from "@/lib/store";
import type { WaiverPlayer, WaiverReport } from "@/lib/types";
import { isAvailableSomewhere } from "@/lib/waivers";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

const POS_COLOR: Record<string, string> = {
  QB: "bg-rose-900 text-rose-200",
  RB: "bg-emerald-900 text-emerald-200",
  WR: "bg-sky-900 text-sky-200",
  TE: "bg-amber-900 text-amber-200",
  K: "bg-violet-900 text-violet-200",
  DST: "bg-neutral-800 text-neutral-300",
};

const PLATFORM_LABEL: Record<string, string> = { espn: "ESPN", sleeper: "Sleeper" };

export default function Waivers({ app }: { app: AppState }) {
  const [report, setReport] = useState<WaiverReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState("ALL");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [week, setWeek] = useState("");
  const [urlOverride, setUrlOverride] = useState("");

  const espn = app.drafts.espn;
  const sleeper = app.drafts.sleeper;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        espnId: espn.id,
        espnTeamId: espn.myTeamId,
        espnSeason: espn.season,
        sleeperId: sleeper.id,
        sleeperTeamId: sleeper.myTeamId,
      });
      if (week.trim()) params.set("week", week.trim());
      if (urlOverride.trim()) params.set("url", urlOverride.trim());
      const res = await fetch(`/api/waivers?${params}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setReport(body as WaiverReport);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [espn.id, espn.myTeamId, espn.season, sleeper.id, sleeper.myTeamId, week, urlOverride]);

  useEffect(() => {
    void load();
    // Re-running on every keystroke of the week/url overrides would spam CBS; those use the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espn.id, espn.myTeamId, sleeper.id, sleeper.myTeamId]);

  const players = useMemo(() => {
    const all = report?.players ?? [];
    return all.filter(
      (p) =>
        (pos === "ALL" || p.pos === pos) && (!availableOnly || isAvailableSomewhere(p)),
    );
  }, [report, pos, availableOnly]);

  return (
    <div>
      <div className="space-y-2 border-b border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-neutral-400">
            {report ? (
              <a href={report.source.url} target="_blank" rel="noreferrer" className="underline">
                Week {report.source.week} · CBS waiver wire
              </a>
            ) : (
              "Loading CBS waiver wire…"
            )}
          </span>
          <button
            onClick={() => void load()}
            className="shrink-0 rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                pos === p ? "bg-neutral-200 text-neutral-900" : "bg-neutral-900 text-neutral-400"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setAvailableOnly((v) => !v)}
            className={`ml-1 shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              availableOnly ? "bg-emerald-900 text-emerald-200" : "bg-neutral-900 text-neutral-400"
            }`}
          >
            {availableOnly ? "Available only" : "All players"}
          </button>
        </div>
        {report?.leagues.some((l) => l.error) ? (
          <div className="text-xs text-amber-400">
            {report.leagues
              .filter((l) => l.error)
              .map((l) => `${PLATFORM_LABEL[l.platform]}: ${l.error}`)
              .join(" · ")}
          </div>
        ) : null}
        {error ? <div className="text-xs text-rose-400">{error}</div> : null}
      </div>

      {!espn.id && !sleeper.id ? (
        <div className="p-6 text-center text-sm text-neutral-400">
          Add your league ids in <span className="font-semibold">Setup</span> to see who is
          available in each league.
        </div>
      ) : null}

      <ul className="divide-y divide-neutral-900">
        {players.map((p) => (
          <li key={p.key} className="px-3 py-2.5">
            <div className="flex items-baseline gap-3">
              <span className="w-6 shrink-0 text-right text-sm text-neutral-500">{p.rank}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{p.name}</div>
                <div className="flex items-center gap-1.5 pt-0.5 text-xs text-neutral-500">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      POS_COLOR[p.pos] ?? "bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    {p.pos || "?"}
                  </span>
                  {p.team ? <span>{p.team}</span> : null}
                  {p.rosteredPct != null ? <span>{p.rosteredPct}% rostered</span> : null}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {p.leagues.map((l) => (
                    <LeagueBadge key={l.platform} league={l} />
                  ))}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {report ? (
        <div className="space-y-3 px-3 py-6 text-xs text-neutral-600">
          <div>
            {players.length} of {report.players.length} suggested players
          </div>
          <div className="flex gap-2">
            <input
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              inputMode="numeric"
              placeholder={`Week (${report.source.week})`}
              className="w-24 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
            />
            <input
              value={urlOverride}
              onChange={(e) => setUrlOverride(e.target.value)}
              placeholder="Paste a CBS article URL"
              className="min-w-0 flex-1 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
            />
            <button
              onClick={() => void load()}
              className="shrink-0 rounded-lg border border-neutral-700 px-3 text-xs text-neutral-300"
            >
              Load
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LeagueBadge({ league }: { league: WaiverPlayer["leagues"][number] }) {
  const label = PLATFORM_LABEL[league.platform] ?? league.platform;
  if (!league.ownerTeamId) {
    return (
      <span className="rounded bg-emerald-900 px-1.5 py-0.5 text-xs font-medium text-emerald-200">
        {label}: available
      </span>
    );
  }
  if (league.mine) {
    return (
      <span className="rounded bg-sky-900 px-1.5 py-0.5 text-xs font-medium text-sky-200">
        {label}: on my team
      </span>
    );
  }
  return (
    <span className="max-w-full truncate rounded bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-500">
      {label}: {league.ownerTeamName}
    </span>
  );
}
