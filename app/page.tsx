"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { VoteContext } from "../components/VoteContext";
import MatchView from "../components/MatchView";
import MatchControls from "../components/MatchControls";
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
};
type MatchResult = {
  winner_id: string | null;
  status: "open" | "active" | "finished" | "expired" | "cancelled";
};

export default function Home() {
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const isCoolingDown =
    cooldownUntil !== null && Date.now() < cooldownUntil;

  const cooldownRemaining =
    cooldownUntil ? Math.max(0, cooldownUntil - Date.now()) : 0;
  const [pendingVote, setPendingVote] = useState<"A" | "B" | null>(null);
  const canVoteNow = !isCoolingDown;
  const { data: session, status } = useSession();
  const [bounty, setBounty] = useState<number>(0);
  const [input, setInput] = useState<string>("");
  const [points, setPoints] = useState(0);
  const [displayPoints, setDisplayPoints] = useState(0);
  const safePoints = Number(displayPoints) || 0;
  const level = Math.floor(safePoints / 100) + 1;
  const xpIntoLevel = safePoints % 100;
  const [popup, setPopup] = useState<string | null>(null);
  const showPopup = (msg: string, duration = 1500) => {
    setPopup(msg);

    setTimeout(() => {
      setPopup(null);
    }, duration);
  };
  const [betAmount, setBetAmount] = useState<number>(0);
  const [matchTitle, setMatchTitle] = useState<string>("");
  const [pendingJoin, setPendingJoin] = useState<{
    matchId: string;
    betAmount: number;
    mode: "pvp" | "solo";
    isParticipant: boolean;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const xpNeeded = 100;
  const prevLevel = useRef(level);
  const [matchId, setMatchId] = useState("");
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [search, setSearch] = useState("");
  const [didCreateMatch, setDidCreateMatch] = useState(false);
  const isMatchVisible =
    currentMatch &&
    currentMatch.status !== "finished" &&
    currentMatch.status !== "expired" &&
    currentMatch.status !== "cancelled";
  const voteRef = useRef<"A" | "B" | null>(null);
  const getUsername = (user: any) => {
    if (!user) return null; // 👈 CHANGE THIS
    if (Array.isArray(user)) return user[0]?.username || null;
    return user.username || null;
  };

  const [voteCount, setVoteCount] = useState({
    a: 0,
    b: 0,
  });
  const getVoteLabel = (side: "A" | "B") => {
    if (isSolo) {
      return side === "A" ? "Lose" : "Win";
    }
    return getSideName(side);
  };
  const sides = {
    A: {
      user: currentMatch?.creator,
      userId: currentMatch?.creator_id,
      votes: voteCount.a,
    },
    B: {
      user: currentMatch?.opponent,
      userId: currentMatch?.opponent_id,
      votes: voteCount.b,
    },
  };
  const getSideName = (side: "A" | "B") => {
    return getUsername(sides[side].user) || side;
  };
  const totalVotes = sides.A.votes + sides.B.votes;
  const isParticipant =
    session?.user?.id === currentMatch?.creator_id ||
    session?.user?.id === currentMatch?.opponent_id;

  const getUserColor = (userId?: string) => {
    if (!currentMatch) return "gray";
    if (userId === currentMatch.creator_id) return "blue";
    if (userId === currentMatch.opponent_id) return "red";
    return "gray";
  };
  const [myVote, setMyVote] = useState<"A" | "B" | null>(null);
  const [myVoteResolved, setMyVoteResolved] = useState<"WIN" | "LOSE" | null>(null);
  const [mode, setMode] = useState<"pvp" | "solo" | null>(null);
  const isSolo = currentMatch?.mode === "solo";
  const userId = session?.user?.id;
  useEffect(() => {
    setMyVote(null);
    setPendingVote(null);
    voteRef.current = null;
    setCooldownUntil(null);
  }, [currentMatch?.id]);
  const isCreator = userId === currentMatch?.creator_id;
  const isOpponent = userId === currentMatch?.opponent_id;

  const canFinishMatch =
    currentMatch &&
    (
      currentMatch.mode === "solo"
        ? isCreator
        : isCreator || isOpponent
    );

  const handleCancelMatch = async () => {
    if (!currentMatch?.id || !session?.user?.id) {
      console.warn("❌ Missing match_id or user");
      return;
    }

    const res = await fetch("/api/match/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: currentMatch.id,
        user_id: session.user.id,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showPopup(data.error || "Failed to cancel match");
      return;
    }

    showPopup("❌ Match cancelled");

    setCurrentMatch(null);
    setMatchId("");
    setDidCreateMatch(false);
    setMode(null);
  };

  const animateXP = (target: number) => {
    let start = displayPoints;
    let diff = target - start;

    if (diff === 0) return;

    const duration = 600; // ms
    const steps = 30;
    const increment = diff / steps;

    let current = start;
    let i = 0;


    const interval = setInterval(() => {
      i++;
      current += increment;

      if (i >= steps) {
        current = target;
        clearInterval(interval);
      }

      setDisplayPoints(Math.floor(current));
    }, duration / steps);
  };
  const loadUser = async (userId: string) => {
    const res = await fetch(`/api/bounty?user_id=${userId}`);
    const result = await res.json();

    if (result.data) {
      setBounty(result.data.bounty ?? 0);
      const newPoints = Number(result.data.points ?? 0);
      setPoints(newPoints);
      animateXP(newPoints);
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    loadUser(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const claimDailyReward = async () => {
      try {
        const res = await fetch("/api/daily", {
          method: "POST",
        });

        if (!res.ok) return;

        const data = await res.json();

        if (data.bountyAdded > 0) {
          showPopup(`🎁 +${data.bountyAdded} Bounty!`);
          await loadUser(session.user.id);
        }
      } catch (err) {
        console.warn("Daily reward failed:", err);
      }
    };

    claimDailyReward();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || currentMatch) return;

    const restoreMatch = async () => {
      const res = await fetch("/api/match/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session.user.id,
        }),
      });

      if (!res.ok) return;

      const data = await res.json();

      if (data.match) {
        setCurrentMatch(data.match);
        setMatchId(data.match.id);
        setMode(data.match.mode ?? null);
        setDidCreateMatch(
          data.match.creator_id === session.user.id
        );
      }
    };

    restoreMatch();
  }, [session?.user?.id, currentMatch]);

  useEffect(() => {
    if (!currentMatch?.id) return;

    const loadVotes = async () => {
      const res = await fetch(`/api/match/votes?match_id=${currentMatch.id}`);
      const json = await res.json();

      setVoteCount({
        a: json.a ?? 0,
        b: json.b ?? 0,
      });
    };

    const interval = setInterval(loadVotes, 1000); // faster = more “live”
    loadVotes(); // initial fetch

    return () => clearInterval(interval);
  }, [currentMatch?.id]);

  useEffect(() => {
    if (!currentMatch?.id || !session?.user?.id) return;

    const interval = setInterval(async () => {
      const updatedMatch = await fetch(`/api/match/get?id=${currentMatch.id}`)
        .then(r => r.json());

      const match = updatedMatch.data;

      if (!match) return;

      if (match.status !== "active" && match.status !== "open") return;

      // prevent instant false triggers after creation
      if (!currentMatch.created_at) return;
      const createdAt = new Date(currentMatch.created_at).getTime();
      if (Date.now() - createdAt < 5000) return;

      const creatorLeft =
        currentMatch.creator_id !== null && match.creator_id === null;

      const opponentLeft =
        currentMatch.opponent_id !== null && match.opponent_id === null;

      if (creatorLeft && opponentLeft) {
        await fetch("/api/match/refund-on-abandon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_id: currentMatch.id,
          }),
        });

        setCurrentMatch(null);
        setMatchId("");
        setDidCreateMatch(false);

        showPopup("⚠️ Match cancelled + refunds issued");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentMatch, session?.user?.id]);


  useEffect(() => {
    if (!currentMatch?.id || currentMatch.status === "finished") return;
    if (!session?.user?.id) return;

    let active = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/match/get?id=${currentMatch.id}`);
        if (!res.ok) return;

        const data = await res.json();
        if (!active || !data.data) return;

        const match = data.data;
        setCurrentMatch(match);

        if (
          match.status === "finished" ||
          match.status === "expired" ||
          match.status === "cancelled"
        ) {
          clearInterval(interval);
          active = false;

          // 🔥 refresh user + leaderboard ONCE
          await loadUser(session.user.id);

          const updatedLeaderboard = await fetch("/api/leaderboard");
          const lb = await updatedLeaderboard.json();
          setLeaderboard(lb.data || []);
          const vote = voteRef.current;
          setCurrentMatch(null);
          setMatchId("");
          setDidCreateMatch(false);
          if (vote) {
            const userId = session.user.id;

            if (match.mode === "solo") {
              const creatorWon = match.winner_id === match.creator_id;

              const correctVote = creatorWon ? "B" : "A";

              const didVoteCorrectly = vote === correctVote;

              showPopup(
                didVoteCorrectly
                  ? "🎉 You voted correctly!"
                  : "❌ You voted wrong!"
              );

              return;
            } else {
              // PvP MODE
              const userId = session.user.id;

              if (!isParticipant) {
                if (!match.winner_id) {
                  showPopup("⏳ Match ended with no result");
                  return;
                }

                const didVoteForWinner =
                  (vote === "A" && match.winner_id === match.creator_id) ||
                  (vote === "B" && match.winner_id === match.opponent_id);

                showPopup(
                  didVoteForWinner
                    ? "🎉 You voted correctly!"
                    : "❌ Your vote was wrong"
                );

                return;
              }

              if (!match.winner_id) {
                if (match.mode === "solo") {
                  // solo loss is valid outcome
                  const didLose = voteRef.current === "A";
                  showPopup(didLose ? "💀 You lost" : "🎉 You won");
                  return;
                }

                showPopup("⏳ Match ended with no result");
                return;
              }

              const didWin = userId === match.winner_id;
              showPopup(didWin ? "🏆 You won!" : "💀 You lost");
            }
          }
        }
      } catch (err) {
        console.warn("Polling failed:", err);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentMatch?.id, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const loadLeaderboard = async () => {
      const res = await fetch("/api/leaderboard");
      const data = await res.json();
      setLeaderboard(data.data || []);
    };

    loadLeaderboard();

    const interval = setInterval(loadLeaderboard, 10000);

    return () => clearInterval(interval);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!prevLevel.current) {
      prevLevel.current = level;
      return;
    }

    if (level > prevLevel.current) {
      showPopup("🎉 LEVEL UP!");
    }

    prevLevel.current = level;
  }, [level]);

  if (!session) {
    return (
      <main style={{
        display: "flex",
        minHeight: "100vh",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        fontFamily: "Arial",
        textAlign: "center",
      }}>
        <iframe
          width="560"
          height="315"
          src="https://www.youtube.com/embed/auRTPmI1PBc"
          title="bounty.town demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

        <h1>Bounty Town</h1>

        <p style={{
          marginTop: 10,
          marginBottom: 20,
          color: "#ccc",
          fontSize: 14,
          maxWidth: 320,
          lineHeight: 1.4,
        }}>
          Create matches, battle live, and let your community decide who wins.
          Earn XP, climb the leaderboard, and build your bounty with every match.
        </p>

        <button
          onClick={() => signIn("twitch")}
          style={{
            padding: "12px 20px",
            background: "#9146FF",
            color: "white",
            border: "none",
            borderRadius: "8px"
          }}
        >
          Continue with Twitch
        </button>

        <p style={{
          marginTop: 10,
          color: "#999",
          fontSize: 12,
        }}>
          Use your Twitch account to create matches, vote, and earn bounty.
        </p>

        <div style={{
          marginTop: 20,
          display: "flex",
          gap: 16,
          fontSize: 13,
        }}>
          <a
            href="/rules"
            style={{ color: "#9146FF", textDecoration: "none" }}
          >
            How Bounty Works
          </a>

          <a
            href="https://github.com/Justsojaded/Bounty.town"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#9146FF", textDecoration: "none" }}
          >
            View Source on GitHub
          </a>
        </div>
      </main>
    );
  }
  // simple reusable button style (so they STOP looking like text)
  const btn = {
    marginTop: "10px",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  };

  const myUser = leaderboard.find(
    (u) => u.user_id === session?.user?.id
  );

  const myRank = leaderboard.findIndex(
    (u) => u.user_id === session?.user?.id
  ) + 1;

  const participantCount =
    (currentMatch?.creator_id ? 1 : 0) +
    (currentMatch?.opponent_id ? 1 : 0);

  const votingUnlocked =
    !!currentMatch &&
    ["active", "open", "lobby", "waiting"].includes(currentMatch.status) &&
    (
      isSolo
        ? true
        : participantCount >= 2
    );

  const hasTwoPlayers =
    currentMatch?.creator_id && currentMatch?.opponent_id;

  const canViewVotes =
    !!currentMatch &&
    (
      isSolo
        ? ["open", "active", "lobby", "waiting"].includes(
          currentMatch.status
        )
        : !!currentMatch.opponent_id
    );
  const showOpponent =
    currentMatch?.mode === "pvp" &&
    (currentMatch?.opponent_id !== null && currentMatch?.opponent_id !== undefined);
  const canVote =
    !!currentMatch &&
    votingUnlocked &&
    (
      isSolo
        ? session.user.id !== currentMatch.creator_id // 👈 creator cannot vote in solo
        : session.user.id !== currentMatch.creator_id &&
        session.user.id !== currentMatch.opponent_id
    );
  const isSoloCreator = isSolo && isCreator;
  const filteredLeaderboard = leaderboard
    .map((user, index) => ({ ...user, realRank: index + 1 }))
    .filter((user) =>
      user.username?.toLowerCase().includes(search.toLowerCase())
    );

  const soloWinnerId =
    isSolo && currentMatch
      ? voteCount.a >= voteCount.b
        ? currentMatch.creator_id // WIN
        : null // LOSE (no winner)
      : null;
  const handleVote = async (voteKey: "A" | "B") => {
    if (!currentMatch || !session?.user?.id) return;
    // 🚫 client-side block
    if (isCoolingDown) {
      showPopup(`⏳ Wait ${Math.ceil(cooldownRemaining / 1000)}s`);
      return;
    }
    setPendingVote(voteKey);
    voteRef.current = voteKey;
    const res = await fetch("/api/match/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: currentMatch.id,
        user_id: session.user.id,
        vote: voteKey,
        cost: currentMatch.bounty_pool,
      }),
    });

    const result = await res.json();

    // ❌ cooldown from server
    if (res.status === 429) {
      if (result.cooldown_end) {
        setCooldownUntil(result.cooldown_end);
      }

      showPopup(
        `⏳ Cooldown: ${Math.ceil(
          (result.cooldown_end - Date.now()) / 1000

        )}s`
      );

      return;
    }

    if (!res.ok) {
      if (res.status === 409 && result.current_vote) {
        const lockedVote = result.current_vote as "A" | "B";

        setMyVote(lockedVote);
        voteRef.current = lockedVote;
        setPendingVote(null);

        showPopup(`You already voted ${lockedVote}`);
        return;
      }
      if (
        result.error?.toLowerCase().includes("bounty") ||
        result.error?.toLowerCase().includes("balance")
      ) {
        setPendingVote(null);
        voteRef.current = null;
        showPopup("💰 You don't have enough bounty to bet");
        return;
      }

      setPendingVote(null);
      voteRef.current = null;
      showPopup(result.error || "Unable to vote");
      return;
    }

    setMyVote(voteKey);
    voteRef.current = voteKey;
    setPendingVote(null);
    // refresh votes
    const data = await fetch(
      `/api/match/votes?match_id=${currentMatch.id}`
    ).then(r => r.json());

    setVoteCount({
      a: data.a ?? 0,
      b: data.b ?? 0,
    });

    // refresh the voter's bounty immediately after a successful vote
    await loadUser(session.user.id);

    showPopup(`Voted ${voteKey === "A" ? "A" : "B"}`);
  };

  const canCancelMatch =
    currentMatch &&
    session?.user?.id === currentMatch.creator_id &&
    !currentMatch.opponent_id &&
    ["open", "lobby", "waiting"].includes(currentMatch.status);

  const showModeSelect =
    !currentMatch ||
    currentMatch.status === "finished" ||
    currentMatch.status === "expired" ||
    currentMatch.status === "cancelled";
  const previewCost = pendingJoin?.betAmount ?? 0;
  const previewCurrent = bounty ?? 0;
  const previewAfter = Math.max(0, previewCurrent - previewCost);
  const hasVoted = myVote !== null;
  return (
    <main style={{
      display: "flex",
      minHeight: "100vh",
      justifyContent: "flex-start",
      alignItems: "center",
      flexDirection: "column",
      paddingTop: 40,
      paddingBottom: 80,
      fontFamily: "Arial",
    }}>
      <h1>Welcome {session.user?.name}</h1>
      <h2>Level {level}</h2>
      <p>{displayPoints} XP</p>

      <div style={{ width: 300, height: 12, background: "#333", borderRadius: 6, overflow: "hidden", marginTop: 10 }}>
        <div
          style={{
            width: `${((xpIntoLevel || 0) / xpNeeded) * 100}%`,
            height: "100%",
            background: "limegreen",
            transition: "width 0.3s ease"
          }}
        />
      </div>

      <p>
        {xpIntoLevel} / {xpNeeded} XP
      </p>

      <p>Current bounty: ${bounty}</p>

      <a
        href={`/${session.user?.name}`}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          color: "#555",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        Profile
      </a>

      <a
        href="/about"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          color: "#555",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        About
      </a>
      <MatchControls
        btn={btn}
        bounty={bounty ?? 0}
        mode={mode}
        setMode={setMode}
        showModeSelect={showModeSelect}
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        matchTitle={matchTitle}
        setMatchTitle={setMatchTitle}
        sessionUserId={session.user.id}
        showPopup={showPopup}
        setBounty={setBounty}
        currentMatch={currentMatch}
        setCurrentMatch={setCurrentMatch}
        matchId={matchId}
        setMatchId={setMatchId}
        setDidCreateMatch={setDidCreateMatch}
        pendingJoin={pendingJoin}
        setPendingJoin={setPendingJoin}
        previewCost={previewCost}
        previewCurrent={previewCurrent}
        previewAfter={previewAfter}
        loadUser={loadUser}
        onJoined={(match) => {
          setCurrentMatch(match);
          setMatchId("");
          setPendingJoin(null);
        }}
        onMatchFinished={() => {
          setCurrentMatch(null);
          setMatchId("");
          setDidCreateMatch(false);
        }}
        onMatchCancelled={() => {
          setCurrentMatch(null);
          setMatchId("");
          setDidCreateMatch(false);
        }}
        setLeaderboard={setLeaderboard}
      />
      {
        isMatchVisible && (
          <VoteContext.Provider value={handleVote}>
            <MatchView
              currentMatch={currentMatch}
              isMatchVisible={isMatchVisible}
              canViewVotes={canViewVotes}
              myVote={myVote}
              voteCount={voteCount}
              isSolo={isSolo}
              totalVotes={totalVotes}
              canVote={canVote}
              sideNames={{
                A: getSideName("A"),
                B: getSideName("B"),
              }}
              sideColors={{
                A: getUserColor(currentMatch?.creator_id),
                B: getUserColor(currentMatch?.opponent_id),
              }}
              isCoolingDown={isCoolingDown}
              pendingVote={pendingVote}
              sides={sides}
            />
          </VoteContext.Provider>
        )
      }

      {
        popup && (
          <div
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              background: "#222",
              color: "white",
              padding: "12px 16px",
              borderRadius: 8,
              zIndex: 999,
            }}
          >
            {popup}
          </div>
        )
      }
      <button
        onClick={async () => {
          const overlayUrl = `${window.location.origin}/${session.user?.name}/overlay`;

          await navigator.clipboard.writeText(overlayUrl);

          showPopup("📺 Overlay link copied!");
        }}
        style={{
          marginTop: 10,
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        📺 Copy OBS Overlay Link
      </button>

      <div style={{ marginTop: 30, textAlign: "center" }}>
        <h2>🏆 Leaderboard</h2>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user..."
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            marginTop: 20,
            width: 300,
          }}
        />

        {search && myRank > 0 && (
          <p style={{ marginTop: 10, fontWeight: "bold" }}>
            Your rank #{myRank}
          </p>
        )}

        {filteredLeaderboard.map((user, index) => (
          <div
            key={user.user_id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: 300,
              marginTop: 8,
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          >
            <span>
              #{user.realRank}{" "}
              <a
                href={`/${user.username}`}
                style={{
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {user.username}
              </a>
            </span>
            <span>{user.points} pts</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => signOut()}
        style={{
          marginTop: "20px",
          padding: "10px 16px"
        }}
      >
        Logout
      </button>
    </main>
  );
}