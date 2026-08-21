"use client";

import { useState } from "react";
import type { DraftedEntry } from "@/lib/derive";
import { needsFromEntries } from "@/lib/derive";
import type { DraftState } from "@/lib/types";

const POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DST"];

function RosterList({ entries }: { entries: DraftedEntry[] }) {
  const groups = POS_ORDER.map((pos) => ({
    pos,
    players: entries.filter((e) => e.pos === pos),
  })).filter((g) => g.players.length > 0);
  const other = entries.filter((e) => !POS_ORDER.includes(e.pos));

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.pos} className="flex gap-2 text-sm">
          <span className="w-9 shrink-0 pt-0.5 text-xs font-semibold text-neutral-500">
            {g.pos}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            {g.players.map((p) => (
              <div key={`${p.name}-${p.pickNo}`} className="flex justify-between gap-2">
                <span className="truncate">
                  {p.name}
                  {p.team ? <span className="text-neutral-500"> {p.team}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {p.pickNo ? `#${p.pickNo}` : "manual"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {other.length > 0 ? (
        <div className="text-sm text-neutral-400">
          {other.map((p) => p.name).join(", ")}
        </div>
      ) : null}
      {entries.length === 0 ? (
        <div className="text-sm text-neutral-500">No picks yet.</div>
      ) : null}
    </div>
  );
}

export function MyTeam({
  state,
  entries,
}: {
  state: DraftState | null;
  entries: DraftedEntry[];
}) {
  const needs = needsFromEntries(state?.rosterSlots ?? [], entries);
  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-500">Still need</div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {needs.length === 0 ? (
            <span className="text-sm text-neutral-400">Starting lineup full</span>
          ) : (
            needs.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className="rounded-full bg-amber-900/60 px-2.5 py-1 text-xs font-medium text-amber-200"
              >
                {n}
              </span>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="pb-2 text-xs uppercase tracking-wide text-neutral-500">
          Roster ({entries.length})
        </div>
        <RosterList entries={entries} />
      </div>
    </div>
  );
}

export function OtherTeams({
  state,
  rosters,
  myTeamId,
}: {
  state: DraftState | null;
  rosters: Map<string, DraftedEntry[]>;
  myTeamId: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const teams = (state?.teams ?? []).filter((t) => t.id !== myTeamId);

  if (teams.length === 0) {
    return <div className="p-6 text-center text-sm text-neutral-400">No teams loaded.</div>;
  }

  return (
    <ul className="divide-y divide-neutral-900">
      {teams.map((team) => {
        const entries = rosters.get(team.id) ?? [];
        const needs = needsFromEntries(state?.rosterSlots ?? [], entries);
        const isOpen = open === team.id;
        return (
          <li key={team.id}>
            <button
              onClick={() => setOpen(isOpen ? null : team.id)}
              className="flex w-full items-center gap-2 px-3 py-3 text-left active:bg-neutral-900"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{team.name}</span>
                <span className="block truncate pt-0.5 text-xs text-neutral-500">
                  {entries.length} picks · needs {needs.slice(0, 4).join(", ") || "none"}
                </span>
              </span>
              <span className="text-neutral-500">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen ? (
              <div className="px-3 pb-4">
                <RosterList entries={entries} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
