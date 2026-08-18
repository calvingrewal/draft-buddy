"use client";

import { teamName } from "@/lib/derive";
import type { DraftState } from "@/lib/types";

export default function PickLog({
  state,
  myTeamId,
}: {
  state: DraftState | null;
  myTeamId: string;
}) {
  const made = (state?.picks ?? []).filter((p) => p.player).reverse();
  if (made.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-neutral-400">
        No picks yet. Picks appear here as they happen.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-neutral-900">
      {made.map((pick) => (
        <li
          key={pick.pickNo}
          className={`flex items-center gap-3 px-3 py-2.5 ${
            pick.teamId === myTeamId ? "bg-emerald-950/40" : ""
          }`}
        >
          <span className="w-12 shrink-0 text-xs text-neutral-500">
            {pick.round}.{String(pick.roundPick).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">
              {pick.player?.name}
              <span className="text-neutral-500">
                {" "}
                {pick.player?.pos}
                {pick.player?.team ? ` · ${pick.player.team}` : ""}
              </span>
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {teamName(state, pick.teamId)}
            </span>
          </span>
          <span className="shrink-0 text-xs text-neutral-600">#{pick.pickNo}</span>
        </li>
      ))}
    </ul>
  );
}
