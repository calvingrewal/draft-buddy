import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCbsWaivers } from "../cbs";
import { playerKey } from "../names";
import type { LeagueRoster } from "../types";
import { isAvailableSomewhere, joinWaivers } from "../waivers";

const page = readFileSync(join(__dirname, "fixtures/cbs-waivers.html"), "utf8");

describe("CBS waiver column parsing", () => {
  const suggestions = parseCbsWaivers(page);

  it("reads each player card in priority order", () => {
    expect(suggestions.map((s) => [s.rank, s.name, s.pos, s.team])).toEqual([
      [1, "Jacoby Brissett", "QB", "ARI"],
      [2, "Bryce Young", "QB", "CAR"],
      [3, "Mike Gesicki", "TE", "CIN"],
    ]);
  });

  it("keeps the published rostered percentage", () => {
    expect(suggestions[0].rosteredPct).toBe(20);
    expect(suggestions[1].rosteredPct).toBe(23);
  });

  it("returns nothing rather than junk for a page without cards", () => {
    expect(parseCbsWaivers("<html><body><p>no players here</p></body></html>")).toEqual([]);
  });
});

describe("league availability join", () => {
  const suggestions = parseCbsWaivers(page);
  const espn: LeagueRoster = {
    platform: "espn",
    leagueId: "1",
    leagueName: "Show Me Your TDs",
    myTeamId: "9",
    ownerByKey: {
      [playerKey("Bryce Young", "QB", "CAR")]: "3",
      [playerKey("Mike Gesicki", "TE", "CIN")]: "9",
    },
    teams: [
      { id: "3", name: "Team Three", slot: null },
      { id: "9", name: "My Squad", slot: null },
    ],
  };
  const sleeper: LeagueRoster = {
    platform: "sleeper",
    leagueId: "2",
    leagueName: "Phi Tau Hedge Fund",
    myTeamId: "4",
    ownerByKey: {},
    teams: [{ id: "4", name: "Calvin", slot: null }],
  };

  const joined = joinWaivers(suggestions, [espn, sleeper]);

  it("marks a player free in one league and owned in the other", () => {
    const young = joined.find((p) => p.name === "Bryce Young")!;
    expect(young.leagues).toEqual([
      {
        platform: "espn",
        leagueName: "Show Me Your TDs",
        ownerTeamId: "3",
        ownerTeamName: "Team Three",
        mine: false,
      },
      {
        platform: "sleeper",
        leagueName: "Phi Tau Hedge Fund",
        ownerTeamId: null,
        ownerTeamName: null,
        mine: false,
      },
    ]);
    expect(isAvailableSomewhere(young)).toBe(true);
  });

  it("flags players already on my roster", () => {
    const gesicki = joined.find((p) => p.name === "Mike Gesicki")!;
    expect(gesicki.leagues[0]).toMatchObject({ mine: true, ownerTeamName: "My Squad" });
  });

  it("treats a player free everywhere as available", () => {
    const brissett = joined.find((p) => p.name === "Jacoby Brissett")!;
    expect(brissett.leagues.every((l) => l.ownerTeamId === null)).toBe(true);
    expect(isAvailableSomewhere(brissett)).toBe(true);
  });
});
