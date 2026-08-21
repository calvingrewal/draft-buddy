"use client";

import { useMemo, useState } from "react";
import type { BoardRow, DraftedEntry } from "@/lib/derive";
import { buildBoard, teamName } from "@/lib/derive";
import type { DraftState, RankedPlayer } from "@/lib/types";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];
const PAGE = 100;

const POS_COLOR: Record<string, string> = {
  QB: "bg-rose-900 text-rose-200",
  RB: "bg-emerald-900 text-emerald-200",
  WR: "bg-sky-900 text-sky-200",
  TE: "bg-amber-900 text-amber-200",
  K: "bg-violet-900 text-violet-200",
  DST: "bg-neutral-800 text-neutral-300",
};

export default function Board({
  rankings,
  drafted,
  state,
  hideDrafted,
  onToggleHideDrafted,
  onSelect,
}: {
  rankings: RankedPlayer[];
  drafted: Map<string, DraftedEntry>;
  state: DraftState | null;
  hideDrafted: boolean;
  onToggleHideDrafted: () => void;
  onSelect: (row: BoardRow) => void;
}) {
  const [pos, setPos] = useState("ALL");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(
    () => buildBoard(rankings, drafted, { pos, query, hideDrafted }),
    [rankings, drafted, pos, query, hideDrafted],
  );
  const shown = rows.slice(0, limit);

  if (rankings.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-neutral-400">
        No rankings loaded yet. Go to <span className="font-semibold">Setup</span> and paste your
        rankings (FantasyPros CSV export works as-is).
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-[104px] z-10 space-y-2 border-b border-neutral-800 bg-neutral-950/95 px-3 py-2 backdrop-blur">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search player"
            className="min-w-0 flex-1 rounded-lg bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600"
          />
          <button
            onClick={onToggleHideDrafted}
            className={`shrink-0 rounded-lg border px-2.5 text-xs ${
              hideDrafted
                ? "border-neutral-700 text-neutral-400"
                : "border-amber-600 text-amber-400"
            }`}
          >
            {hideDrafted ? "Hide taken" : "Show taken"}
          </button>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPos(p);
                setLimit(PAGE);
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                pos === p ? "bg-neutral-200 text-neutral-900" : "bg-neutral-900 text-neutral-400"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-neutral-900">
        {shown.map((row) => {
          const takenBy = row.drafted
            ? row.drafted.teamId
              ? teamName(state, row.drafted.teamId)
              : "unknown team"
            : null;
          return (
            <li key={row.key}>
              <button
                onClick={() => onSelect(row)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-neutral-900"
              >
                <span className="w-7 shrink-0 text-right text-sm text-neutral-500">{row.rank}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[15px] font-medium ${
                      row.drafted ? "text-neutral-600 line-through" : ""
                    }`}
                  >
                    {row.name}
                  </span>
                  <span className="flex items-center gap-1.5 pt-0.5 text-xs text-neutral-500">
                    <span
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        POS_COLOR[row.pos] ?? "bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      {row.pos || "?"}
                    </span>
                    {row.team ? <span>{row.team}</span> : null}
                    {row.bye ? <span>bye {row.bye}</span> : null}
                    {row.tier ? <span>T{row.tier}</span> : null}
                    {row.adp != null ? <span>adp {row.adp}</span> : null}
                    {takenBy ? (
                      <span className="truncate text-neutral-600">· {takenBy}</span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {rows.length > shown.length ? (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="w-full py-4 text-sm text-neutral-400"
        >
          Show more ({rows.length - shown.length} left)
        </button>
      ) : (
        <div className="py-6 text-center text-xs text-neutral-600">
          {rows.length} player{rows.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
