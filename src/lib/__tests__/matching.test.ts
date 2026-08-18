import { describe, expect, it } from "vitest";
import { buildDraftedIndex, remainingNeeds, pickClock } from "../derive";
import { normalizeName, playerKey } from "../names";
import { parseRankings } from "../rankings";
import { snakeTeamId } from "../sleeper";
import type { DraftState } from "../types";

describe("name normalization", () => {
  it("strips suffixes, punctuation and case", () => {
    expect(normalizeName("Marvin Harrison Jr.")).toBe("marvin harrison");
    expect(normalizeName("D.J. Moore")).toBe("dj moore");
    expect(normalizeName("Kenneth Walker III")).toBe("kenneth walker");
    expect(normalizeName("Ja'Marr Chase")).toBe("jamarr chase");
    expect(normalizeName("Amon-Ra St. Brown")).toBe("amon ra st brown");
  });

  it("matches the same player across ranking and platform spellings", () => {
    expect(playerKey("Brian Robinson Jr.", "RB", "WAS")).toBe(
      playerKey("Brian Robinson", "RB", "WSH"),
    );
  });

  it("collapses team defenses to one key", () => {
    expect(playerKey("Ravens D/ST", "DST", null)).toBe("dst:BAL");
    expect(playerKey("Baltimore Ravens", "DST", null)).toBe("dst:BAL");
    expect(playerKey("BAL", "DEF", "BAL")).toBe("dst:BAL");
  });
});

describe("rankings parsing", () => {
  it("parses a FantasyPros-style CSV export", () => {
    const csv = [
      '"RK","TIERS","PLAYER NAME","TEAM","POS","BYE WEEK","SOS SEASON","ECR VS. ADP"',
      '"1","1","Ja\'Marr Chase","CIN","WR1","10","3 out of 5","0"',
      '"2","1","Bijan Robinson","ATL","RB1","5","4 out of 5","+1"',
      '"3","2","Justin Jefferson","MIN","WR2","6","3 out of 5","-2"',
    ].join("\n");
    const { players } = parseRankings(csv);
    expect(players).toHaveLength(3);
    expect(players[0]).toMatchObject({
      rank: 1,
      name: "Ja'Marr Chase",
      pos: "WR",
      team: "CIN",
      tier: 1,
      bye: 10,
    });
    expect(players[1].pos).toBe("RB");
  });

  it("parses a plain ranked list", () => {
    const { players } = parseRankings(
      "1. Ja'Marr Chase WR CIN\n2. Bijan Robinson RB ATL\nSaquon Barkley",
    );
    expect(players.map((p) => p.name)).toEqual([
      "Ja'Marr Chase",
      "Bijan Robinson",
      "Saquon Barkley",
    ]);
    expect(players[0].pos).toBe("WR");
  });

  it("dedupes repeated players", () => {
    const { players } = parseRankings("1. Bijan Robinson RB ATL\n2. Bijan Robinson RB ATL");
    expect(players).toHaveLength(1);
  });
});

describe("snake order", () => {
  it("reverses on even rounds", () => {
    const order = ["a", "b", "c"];
    expect(snakeTeamId(order, 1, 3)).toBe("a");
    expect(snakeTeamId(order, 3, 3)).toBe("c");
    expect(snakeTeamId(order, 4, 3)).toBe("c");
    expect(snakeTeamId(order, 6, 3)).toBe("a");
    expect(snakeTeamId(order, 7, 3)).toBe("a");
  });

  it("honors third-round reversal", () => {
    const order = ["a", "b", "c"];
    expect(snakeTeamId(order, 7, 3, 3)).toBe("c");
  });
});

function fakeState(): DraftState {
  return {
    platform: "sleeper",
    draftId: "1",
    leagueName: "Test",
    status: "drafting",
    rounds: 2,
    teamCount: 3,
    rosterSlots: ["QB", "RB", "WR", "FLEX"],
    teams: [
      { id: "1", name: "A", slot: 1 },
      { id: "2", name: "B", slot: 2 },
      { id: "3", name: "C", slot: 3 },
    ],
    order: ["1", "2", "3"],
    picks: [
      {
        pickNo: 1,
        round: 1,
        roundPick: 1,
        teamId: "1",
        player: { id: "p1", name: "Ja'Marr Chase", pos: "WR", team: "CIN" },
      },
      {
        pickNo: 2,
        round: 1,
        roundPick: 2,
        teamId: "2",
        player: { id: "p2", name: "Bijan Robinson", pos: "RB", team: "ATL" },
      },
    ],
    onClockPickNo: 3,
    onClockTeamId: "3",
    updatedAt: 0,
  };
}

describe("drafted index and clock", () => {
  it("crosses off live picks and manual entries", () => {
    const { players } = parseRankings(
      "1. Ja'Marr Chase WR CIN\n2. Bijan Robinson RB ATL\n3. Saquon Barkley RB PHI",
    );
    const index = buildDraftedIndex(fakeState(), { [players[2].key]: "2" }, players);
    expect(index.get(players[0].key)?.pickNo).toBe(1);
    expect(index.get(players[2].key)).toMatchObject({ manual: true, teamId: "2" });
  });

  it("counts picks until my next turn", () => {
    const clock = pickClock(fakeState(), "1");
    expect(clock.currentPickNo).toBe(3);
    expect(clock.myNextPickNo).toBe(6);
    expect(clock.picksUntilMe).toBe(3);
  });
});

describe("roster needs", () => {
  it("fills flex with leftover skill players", () => {
    expect(
      remainingNeeds(["QB", "RB", "WR", "FLEX"], [
        { pickNo: 1, round: 1, roundPick: 1, teamId: "1", player: { id: "1", name: "x", pos: "RB", team: null } },
        { pickNo: 2, round: 1, roundPick: 2, teamId: "1", player: { id: "2", name: "y", pos: "RB", team: null } },
      ]),
    ).toEqual(["QB", "WR"]);
  });
});

describe("rankings warnings and defenses", () => {
  it("keeps DST as the position for plain-list defense lines", () => {
    const { players } = parseRankings("1. Ravens D/ST\n2. 49ers DEF");
    expect(players.map((p) => p.pos)).toEqual(["DST", "DST"]);
    expect(players[0].name).toBe("Ravens");
    expect(players[0].key).toBe("dst:BAL");
  });

  it("warns about skipped blank and duplicate rows", () => {
    const { players, warnings } = parseRankings(
      [
        "RK,PLAYER NAME,TEAM,POS,BYE WEEK",
        "1,Ja'Marr Chase,CIN,WR1,10",
        "2,,ATL,RB1,5",
        "3,Ja'Marr Chase,CIN,WR1,10",
      ].join("\n"),
    );
    expect(players).toHaveLength(1);
    expect(warnings.join(" ")).toMatch(/1 row\(s\) with no player name/);
    expect(warnings.join(" ")).toMatch(/1 duplicate/);
  });
});
