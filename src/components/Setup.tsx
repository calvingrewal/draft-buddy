"use client";

import { useState } from "react";
import { parseRankings } from "@/lib/rankings";
import type { AppState, DraftConfig, RankingSet } from "@/lib/store";
import type { DraftPick, DraftState, Platform } from "@/lib/types";

export interface ServerConfig {
  season: string;
  espnLeagueId: string;
  espnTeamId: string;
  sleeperLeagueId: string;
  sleeperTeamSlot: string;
  espnConfigured: boolean;
}

const label = "text-xs uppercase tracking-wide text-neutral-500";
const input =
  "w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600";

export default function Setup({
  app,
  platform,
  draft,
  state,
  serverConfig,
  unranked,
  onUpdateDraft,
  onUpdateApp,
}: {
  app: AppState;
  platform: Platform;
  draft: DraftConfig;
  state: DraftState | null;
  serverConfig: ServerConfig | null;
  unranked: DraftPick[];
  onUpdateDraft: (fn: (prev: DraftConfig) => DraftConfig) => void;
  onUpdateApp: (fn: (prev: AppState) => AppState) => void;
}) {
  const [paste, setPaste] = useState("");
  const [setName, setSetName] = useState("");
  const [parseMsg, setParseMsg] = useState<string | null>(null);

  const saveRankings = () => {
    const { players, warnings } = parseRankings(paste);
    if (players.length === 0) {
      setParseMsg(warnings.join(" ") || "Nothing parsed — check the format.");
      return;
    }
    const set: RankingSet = {
      id: `rs_${Date.now()}`,
      name: setName.trim() || `Rankings ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      players,
    };
    onUpdateApp((prev) => ({ ...prev, rankingSets: [...prev.rankingSets, set] }));
    onUpdateDraft((prev) => ({ ...prev, rankingSetId: set.id }));
    setPaste("");
    setSetName("");
    setParseMsg(
      `Imported ${players.length} players${warnings.length ? ` (${warnings.join(" ")})` : ""}.`,
    );
  };

  const manualCount = Object.keys(draft.manualDrafted).length;
  const defaultId =
    platform === "espn" ? serverConfig?.espnLeagueId : serverConfig?.sleeperLeagueId;

  return (
    <div className="space-y-6 p-3 pb-10">
      <section className="space-y-2">
        <div className={label}>{platform === "espn" ? "ESPN league" : "Sleeper league"}</div>
        <input
          className={input}
          value={draft.id}
          onChange={(e) => onUpdateDraft((prev) => ({ ...prev, id: e.target.value }))}
          placeholder={
            platform === "espn" ? "league id or league URL" : "league id, draft id, or URL"
          }
        />
        {defaultId && draft.id !== defaultId ? (
          <button
            onClick={() => onUpdateDraft((prev) => ({ ...prev, id: defaultId }))}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs"
          >
            Use saved default ({defaultId})
          </button>
        ) : null}
        {platform === "espn" ? (
          <>
            <input
              className={input}
              value={draft.season}
              onChange={(e) => onUpdateDraft((prev) => ({ ...prev, season: e.target.value }))}
              placeholder="season, e.g. 2026"
            />
            {serverConfig && !serverConfig.espnConfigured ? (
              <p className="text-xs text-amber-400">
                Server is missing ESPN_S2 / ESPN_SWID — ESPN sync will fail until those env vars
                are set.
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className={label}>My team</div>
        <select
          className={input}
          value={draft.myTeamId}
          onChange={(e) => onUpdateDraft((prev) => ({ ...prev, myTeamId: e.target.value }))}
        >
          <option value="">Select your team…</option>
          {(state?.teams ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.slot ? ` (slot ${t.slot})` : ""}
            </option>
          ))}
        </select>
        {state ? (
          <p className="text-xs text-neutral-500">
            {state.teamCount} teams · {state.rounds} rounds · status {state.status}
            {state.notes?.length ? ` · ${state.notes.join(" ")}` : ""}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className={label}>Rankings</div>
        <select
          className={input}
          value={draft.rankingSetId}
          onChange={(e) => onUpdateDraft((prev) => ({ ...prev, rankingSetId: e.target.value }))}
        >
          <option value="">Select rankings…</option>
          {app.rankingSets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.players.length})
            </option>
          ))}
        </select>
        {draft.rankingSetId ? (
          <button
            onClick={() => {
              onUpdateApp((prev) => ({
                ...prev,
                rankingSets: prev.rankingSets.filter((s) => s.id !== draft.rankingSetId),
              }));
              onUpdateDraft((prev) => ({ ...prev, rankingSetId: "" }));
            }}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-red-300"
          >
            Delete selected rankings
          </button>
        ) : null}
        <input
          className={input}
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          placeholder="name for new rankings (optional)"
        />
        <textarea
          className={`${input} h-40 font-mono text-xs`}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={
            "Paste a FantasyPros CSV export, a TSV, or one player per line:\n1. Ja'Marr Chase WR CIN\n2. Bijan Robinson RB ATL"
          }
        />
        <div className="flex items-center gap-2">
          <button
            onClick={saveRankings}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold"
          >
            Import rankings
          </button>
          <label className="rounded-lg bg-neutral-800 px-4 py-2 text-sm">
            Upload file
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setPaste(await file.text());
              }}
            />
          </label>
        </div>
        {parseMsg ? <p className="text-xs text-neutral-400">{parseMsg}</p> : null}
      </section>

      <section className="space-y-2">
        <div className={label}>Sync</div>
        <label className="flex items-center justify-between text-sm">
          <span>Poll interval</span>
          <select
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm"
            value={app.pollSeconds}
            onChange={(e) =>
              onUpdateApp((prev) => ({ ...prev, pollSeconds: Number(e.target.value) }))
            }
          >
            {[3, 5, 10, 20].map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-neutral-500">
          Manual cross-offs on this draft: {manualCount}
        </p>
        {manualCount > 0 ? (
          <button
            onClick={() => onUpdateDraft((prev) => ({ ...prev, manualDrafted: {} }))}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-red-300"
          >
            Clear manual cross-offs
          </button>
        ) : null}
      </section>

      {unranked.length > 0 ? (
        <section className="space-y-1">
          <div className={label}>Picks not in your rankings ({unranked.length})</div>
          <p className="text-xs text-neutral-500">
            These were drafted but do not match a ranked player, so nothing was crossed off. Check
            for name mismatches.
          </p>
          <ul className="space-y-0.5 text-sm text-neutral-300">
            {unranked.slice(-15).map((p) => (
              <li key={p.pickNo}>
                #{p.pickNo} {p.player?.name} ({p.player?.pos})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
