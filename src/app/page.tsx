"use client";

import { useEffect, useMemo, useState } from "react";
import Board from "@/components/Board";
import PickLog from "@/components/PickLog";
import PlayerSheet from "@/components/PlayerSheet";
import { MyTeam, OtherTeams } from "@/components/Rosters";
import Setup, { type ServerConfig } from "@/components/Setup";
import TopBar from "@/components/TopBar";
import type { BoardRow } from "@/lib/derive";
import {
  buildDraftedIndex,
  pickClock,
  rostersByTeam,
  unrankedPicks,
} from "@/lib/derive";
import { useAppState } from "@/lib/store";
import type { Platform } from "@/lib/types";
import { useDraftFeed } from "@/lib/useDraftFeed";

const TABS = ["Board", "My team", "Teams", "Log", "Setup"] as const;
type Tab = (typeof TABS)[number];

export default function Home() {
  const { state: app, loaded, update, updateDraft } = useAppState();
  const [tab, setTab] = useState<Tab>("Board");
  const [selected, setSelected] = useState<BoardRow | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);

  const platform = app.active;
  const draft = app.drafts[platform];
  const feed = useDraftFeed(platform, draft.id, draft.season, app.pollSeconds);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: ServerConfig) => setServerConfig(cfg))
      .catch(() => setServerConfig(null));
  }, []);

  // Prefill league ids from the server defaults the first time the app is opened.
  useEffect(() => {
    if (!loaded || !serverConfig) return;
    update((prev) => {
      const next = { ...prev, drafts: { ...prev.drafts } };
      if (!next.drafts.espn.id && serverConfig.espnLeagueId) {
        next.drafts.espn = {
          ...next.drafts.espn,
          id: serverConfig.espnLeagueId,
          season: serverConfig.season,
          myTeamId: next.drafts.espn.myTeamId || serverConfig.espnTeamId,
        };
      }
      if (!next.drafts.sleeper.id && serverConfig.sleeperLeagueId) {
        next.drafts.sleeper = {
          ...next.drafts.sleeper,
          id: serverConfig.sleeperLeagueId,
          myTeamId: next.drafts.sleeper.myTeamId || serverConfig.sleeperTeamSlot,
        };
      }
      return next;
    });
  }, [loaded, serverConfig, update]);

  const rankings = useMemo(
    () => app.rankingSets.find((s) => s.id === draft.rankingSetId)?.players ?? [],
    [app.rankingSets, draft.rankingSetId],
  );
  const drafted = useMemo(
    () => buildDraftedIndex(feed.state, draft.manualDrafted, rankings),
    [feed.state, draft.manualDrafted, rankings],
  );
  const rosters = useMemo(() => rostersByTeam(drafted), [drafted]);
  const clock = useMemo(() => pickClock(feed.state, draft.myTeamId), [feed.state, draft.myTeamId]);
  const unranked = useMemo(() => unrankedPicks(feed.state, rankings), [feed.state, rankings]);

  const mark = (key: string, teamId: string) => {
    updateDraft(platform, (prev) => ({
      ...prev,
      manualDrafted: { ...prev.manualDrafted, [key]: teamId },
    }));
    setSelected(null);
  };
  const unmark = (key: string) => {
    updateDraft(platform, (prev) => {
      const next = { ...prev.manualDrafted };
      delete next[key];
      return { ...prev, manualDrafted: next };
    });
    setSelected(null);
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl pb-16">
      <TopBar
        platform={platform}
        onPlatformChange={(p: Platform) => update((prev) => ({ ...prev, active: p }))}
        state={feed.state}
        clock={clock}
        myTeamId={draft.myTeamId}
        fetchedAt={feed.fetchedAt}
        now={now}
        error={feed.error}
        loading={feed.loading}
        onRefresh={feed.refresh}
      />

      {tab === "Board" ? (
        <Board
          rankings={rankings}
          drafted={drafted}
          state={feed.state}
          hideDrafted={app.hideDrafted}
          onToggleHideDrafted={() =>
            update((prev) => ({ ...prev, hideDrafted: !prev.hideDrafted }))
          }
          onSelect={setSelected}
        />
      ) : null}
      {tab === "My team" ? (
        <MyTeam state={feed.state} entries={rosters.get(draft.myTeamId) ?? []} />
      ) : null}
      {tab === "Teams" ? (
        <OtherTeams state={feed.state} rosters={rosters} myTeamId={draft.myTeamId} />
      ) : null}
      {tab === "Log" ? <PickLog state={feed.state} myTeamId={draft.myTeamId} /> : null}
      {tab === "Setup" ? (
        <Setup
          app={app}
          platform={platform}
          draft={draft}
          state={feed.state}
          serverConfig={serverConfig}
          unranked={unranked}
          onUpdateDraft={(fn) => updateDraft(platform, fn)}
          onUpdateApp={(fn) => update(fn)}
        />
      ) : null}

      <PlayerSheet
        row={selected}
        state={feed.state}
        myTeamId={draft.myTeamId}
        onClose={() => setSelected(null)}
        onMark={mark}
        onUnmark={unmark}
      />

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-medium ${
                tab === t ? "text-white" : "text-neutral-500"
              }`}
            >
              {t}
              {tab === t ? <span className="mx-auto mt-1 block h-0.5 w-6 bg-white" /> : null}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
