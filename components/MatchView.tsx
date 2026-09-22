"use client";

import { useEffect, useState } from "react";
import VoteBar from "./VoteBar";

type MatchStatus =
  | "open"
  | "active"
  | "lobby"
  | "waiting"
  | "finished"
  | "expired"
  | "cancelled";

type Match = {
  mode?: "pvp" | "solo";
  id: string;
  status: MatchStatus;
  title?: string;
  creator_id?: string;
  opponent_id?: string;
  creator?: any;
  opponent?: any;
  created_at?: string;
  bounty_pool?: number;
  bet_amount?: number;
};

type Props = {
  currentMatch: Match | null;
  isMatchVisible: boolean;
  canViewVotes: boolean;
  myVote: "A" | "B" | null;
  voteCount: {
    a: number;
    b: number;
  };
  isSolo: boolean;
  sideColors: {
    A: string;
    B: string;
  };
  sideNames: {
    A: string;
    B: string;
  };
  totalVotes: number;
  canVote: boolean;
  isCoolingDown: boolean;
  pendingVote: "A" | "B" | null;
  sides: {
    A: {
      user: any;
      userId?: string;
      votes: number;
    };
    B: {
      user: any;
      userId?: string;
      votes: number;
    };
  };
};

export default function MatchView({
  currentMatch,
  isMatchVisible,
  canViewVotes,
  myVote,
  voteCount,
  isSolo,
  totalVotes,
  canVote,
  sideNames,
  sideColors,
  isCoolingDown,
  pendingVote,
  sides,
}: Props) {
  const [voterCounts, setVoterCounts] = useState({
    bounty: 0,
    free: 0,
  });

  useEffect(() => {
    if (!currentMatch?.id) {
      setVoterCounts({ bounty: 0, free: 0 });
      return;
    }

    const loadVoterCounts = async () => {
      const res = await fetch(`/api/match/votes?match_id=${currentMatch.id}`);
      if (!res.ok) return;

      const data = await res.json();
      setVoterCounts({
        bounty: data.bountyVoters ?? 0,
        free: data.freeVoters ?? 0,
      });
    };

    loadVoterCounts();
    const interval = setInterval(loadVoterCounts, 1000);

    return () => clearInterval(interval);
  }, [currentMatch?.id]);

  if (!currentMatch || !isMatchVisible) {
    return null;
  }

  const getUsername = (user: any) => {
    if (!user) return null;

    if (Array.isArray(user)) {
      return user[0]?.username || null;
    }

    return user.username || null;
  };

  const creatorName =
    getUsername(currentMatch.creator) || "Creator";

  const opponentName =
    getUsername(currentMatch.opponent) || "Opponent";

  const showOpponent =
    currentMatch.mode === "pvp" &&
    !!currentMatch.opponent_id;

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 700,
        marginTop: 25,
        padding: 20,
        border: "1px solid #333",
        borderRadius: 12,
        background: "#111",
        color: "white",
        textAlign: "center",
      }}
    >
      <h2>
        {isSolo ? "🎲 Solo Match" : "🆚 PvP Match"}
      </h2>

      {currentMatch.title && (
        <h3
          style={{
            marginTop: 5,
            marginBottom: 15,
            fontSize: 22,
          }}
        >
          {currentMatch.title}
        </h3>
      )}

      <p style={{ color: "#aaa" }}>
        Match ID: <b>{currentMatch.id}</b>
      </p>

      <p>
        Status: <b>{currentMatch.status}</b>
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
          marginTop: 25,
        }}
      >
        <div
          style={{
            padding: 15,
            borderRadius: 10,
            border: `2px solid ${sideColors.A}`,
            minWidth: 180,
          }}
        >
          <h3>{creatorName}</h3>

          {!isSolo && (
            <p>
              Votes: <b>{voteCount.a}</b>
            </p>
          )}
        </div>

        {showOpponent && (
          <>
            <div
              style={{
                fontWeight: "bold",
                fontSize: 20,
              }}
            >
              VS
            </div>

            <div
              style={{
                padding: 15,
                borderRadius: 10,
                border: `2px solid ${sideColors.B}`,
                minWidth: 180,
              }}
            >
              <h3>{opponentName}</h3>

              <p>
                Votes: <b>{voteCount.b}</b>
              </p>
            </div>
          </>
        )}
      </div>

      {canViewVotes && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 18,
            marginTop: 12,
            fontSize: 12,
            color: "#aaa",
          }}
        >
          <span>🟣 Free votes: <b>{voterCounts.free}</b></span>
          <span>💰 Bounty voters: <b>{voterCounts.bounty}</b></span>
        </div>
      )}

      {canViewVotes && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 18,
              marginTop: 14,
              marginBottom: 4,
              fontSize: 14,
              color: "#aaa",
            }}
          >
            <span>
              🏆 Bounty pool: <b style={{ color: "white" }}>{currentMatch.bounty_pool ?? 0} bounty</b>
            </span>
            <span>
              💰 Entry fee: <b style={{ color: "white" }}>{currentMatch.bet_amount ?? 0} bounty</b>
            </span>
          </div>

          <VoteBar
            isSolo={isSolo}
            currentMatch={currentMatch}
            voteCount={voteCount}
            sides={sides}
            totalVotes={totalVotes}
            sideNames={sideNames}
            sideColors={sideColors}
            myVote={myVote}
            pendingVote={pendingVote}
            canVote={canVote}
            isCoolingDown={isCoolingDown}
          />
        </>
      )}
    </section>
  );
}
