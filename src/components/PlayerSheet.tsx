"use client";

import type { BoardRow } from "@/lib/derive";
import { teamName } from "@/lib/derive";
import type { DraftState } from "@/lib/types";

export default function PlayerSheet({
  row,
  state,
  myTeamId,
  onClose,
  onMark,
  onUnmark,
}: {
  row: BoardRow | null;
  state: DraftState | null;
  myTeamId: string;
  onClose: () => void;
  onMark: (key: string, teamId: string) => void;
  onUnmark: (key: string) => void;
}) {
  if (!row) return null;
  const livePick = row.drafted && !row.drafted.manual;

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border-t border-neutral-800 bg-neutral-900 p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{row.name}</div>
            <div className="text-sm text-neutral-400">
              #{row.rank} · {row.pos || "?"}
              {row.team ? ` · ${row.team}` : ""}
              {row.bye ? ` · bye ${row.bye}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm">
            Close
          </button>
        </div>

        {row.notes ? <p className="pt-3 text-sm text-neutral-300">{row.notes}</p> : null}

        {livePick ? (
          <div className="mt-4 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-300">
            Drafted at pick {row.drafted?.pickNo} by {teamName(state, row.drafted?.teamId ?? null)}{" "}
            (from {state?.platform === "espn" ? "ESPN" : "Sleeper"}).
          </div>
        ) : row.drafted ? (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-neutral-400">
              Manually crossed off{" "}
              {row.drafted.teamId ? `(${teamName(state, row.drafted.teamId)})` : ""}
            </div>
            <button
              onClick={() => onUnmark(row.key)}
              className="w-full rounded-lg bg-neutral-700 py-3 font-medium"
            >
              Undo cross-off
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <button
              onClick={() => onMark(row.key, myTeamId)}
              disabled={!myTeamId}
              className="w-full rounded-lg bg-emerald-600 py-3 font-semibold disabled:opacity-40"
            >
              I drafted him
            </button>
            <div>
              <div className="pb-1 text-xs uppercase tracking-wide text-neutral-500">
                Drafted by another team
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onMark(row.key, "")}
                  className="rounded-lg bg-neutral-800 py-2.5 text-sm"
                >
                  Unknown team
                </button>
                {(state?.teams ?? [])
                  .filter((t) => t.id !== myTeamId)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onMark(row.key, t.id)}
                      className="truncate rounded-lg bg-neutral-800 px-2 py-2.5 text-sm"
                    >
                      {t.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
