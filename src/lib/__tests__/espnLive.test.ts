import { describe, expect, it } from "vitest";
import { applyLiveSelections } from "../espn";
import type { EspnSelection } from "../espnLive";
import type { DraftPick, PlayerRef } from "../types";

function board(teamOrder: string[], rounds: number): DraftPick[] {
  const picks: DraftPick[] = [];
  for (let round = 1; round <= rounds; round++) {
    const order = round % 2 === 1 ? teamOrder : [...teamOrder].reverse();
    order.forEach((teamId, idx) => {
      picks.push({
        pickNo: (round - 1) * teamOrder.length + idx + 1,
        round,
        roundPick: idx + 1,
        teamId,
        player: null,
      });
    });
  }
  return picks;
}

function selection(teamId: string, playerId: number): EspnSelection {
  return { teamId, playerId, slotId: 2, at: Date.now() };
}

const index = new Map<number, PlayerRef>([
  [100, { id: "100", name: "Ja'Marr Chase", pos: "WR", team: "CIN" }],
  [200, { id: "200", name: "Bijan Robinson", pos: "RB", team: "ATL" }],
]);

describe("applyLiveSelections", () => {
  it("fills each team's earliest empty pick in stream order", () => {
    const picks = board(["1", "2", "3"], 2);
    const filled = applyLiveSelections(
      picks,
      [selection("1", 100), selection("2", 200), selection("3", 300)],
      index,
    );

    expect(filled).toBe(3);
    expect(picks.slice(0, 3).map((p) => p.player?.name)).toEqual([
      "Ja'Marr Chase",
      "Bijan Robinson",
      "ESPN player 300",
    ]);
    expect(picks.slice(3).every((p) => p.player === null)).toBe(true);
  });

  it("keeps snake order when a team picks twice", () => {
    const picks = board(["1", "2"], 2);
    applyLiveSelections(picks, [selection("1", 100), selection("2", 200)], index);
    applyLiveSelections(picks, [selection("1", 100), selection("2", 200), selection("2", 300)], index);

    expect(picks.map((p) => [p.pickNo, p.teamId, p.player?.id ?? null])).toEqual([
      [1, "1", "100"],
      [2, "2", "200"],
      [3, "2", "300"],
      [4, "1", null],
    ]);
  });

  it("does not duplicate players the polled board already reported", () => {
    const picks = board(["1", "2"], 1);
    picks[0].player = index.get(100)!;

    const filled = applyLiveSelections(picks, [selection("1", 100), selection("2", 200)], index);

    expect(filled).toBe(1);
    expect(picks[1].player?.id).toBe("200");
  });

  it("ignores selections once the board is full", () => {
    const picks = board(["1"], 1);
    picks[0].player = index.get(100)!;

    expect(applyLiveSelections(picks, [selection("1", 200)], index)).toBe(0);
  });
});
