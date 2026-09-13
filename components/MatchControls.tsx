"use client";

import JoinMatchPrompt from "./JoinMatchPrompt";

type Match = {
  mode?: "pvp" | "solo";
  id: string;
  status: string;
  creator_id?: string;
  opponent_id?: string;
  bet_amount?: number;
};

type PendingJoin = {
  matchId: string;
  betAmount: number;
  mode: "pvp" | "solo";
  isParticipant: boolean;
};

type MatchControlsProps = {
  btn: React.CSSProperties;
  bounty: number;
  mode: "pvp" | "solo" | null;
  setMode: (mode: "pvp" | "solo" | null) => void;
  showModeSelect: boolean;
  betAmount: number;
  setBetAmount: (amount: number) => void;
  matchTitle: string;
  setMatchTitle: (title: string) => void;
  sessionUserId: string;
  showPopup: (message: string) => void;
  currentMatch: Match | null;
  setCurrentMatch: (match: Match | null) => void;
  matchId: string;
  setMatchId: (id: string) => void;
  setDidCreateMatch: (value: boolean) => void;
  pendingJoin: PendingJoin | null;
  setPendingJoin: (join: PendingJoin | null) => void;
  previewCost: number;
  previewCurrent: number;
  previewAfter: number;
  loadUser: (userId: string) => Promise<void>;
  onJoined: (match: Match) => void;
};

export default function MatchControls({
  btn,
  bounty,
  mode,
  setMode,
  showModeSelect,
  betAmount,
  setBetAmount,
  matchTitle,
  setMatchTitle,
  sessionUserId,
  showPopup,
  currentMatch,
  setCurrentMatch,
  matchId,
  setMatchId,
  setDidCreateMatch,
  pendingJoin,
  setPendingJoin,
  previewCost,
  previewCurrent,
  previewAfter,
  loadUser,
  onJoined,
}: MatchControlsProps) {
  const createMatch = async () => {
    if (mode === "pvp" && bounty < betAmount) {
      showPopup("💰 You don't have enough bounty to create this match");
      return;
    }

    const res = await fetch("/api/match/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: sessionUserId,
        mode,
        bet_amount: betAmount,
        title: matchTitle,
      }),
    });

    const result = await res.json();

    setMode(null);

    if (result.data) {
      const full = await fetch(`/api/match/get?id=${result.data.id}`)
        .then((r) => r.json());

      setCurrentMatch(full.data);
      setMatchId(full.data.id);
      setDidCreateMatch(true);
      setMatchTitle("");
    }
  };

  const lookupMatch = async () => {
    const res = await fetch(`/api/match/get?id=${matchId}`);
    const data = await res.json();

    const match = data.data;
    if (!match) {
      showPopup("Match not found");
      return;
    }

    const isCreator = sessionUserId === match.creator_id;
    const isOpponent = sessionUserId === match.opponent_id;
    const isParticipant = isCreator || isOpponent;
    const isPvPFull = match.mode === "pvp" && match.opponent_id;

    if (isParticipant || match.mode === "solo" || isPvPFull) {
      setCurrentMatch(match);
      setMatchId("");
      setPendingJoin(null);
      return;
    }

    setPendingJoin({
      matchId: match.id,
      betAmount: match.bet_amount ?? 0,
      mode: match.mode,
      isParticipant: false,
    });
  };

  const shouldShowJoinPrompt =
    !!pendingJoin &&
    (pendingJoin.mode === "pvp" || pendingJoin.mode === "solo");

  return (
    <>
      {mode && showModeSelect && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            marginTop: 10,
          }}
        >
          <button
            onClick={() => {
              setCurrentMatch(null);
              setMatchId("");
              setDidCreateMatch(false);
              setMode(null);
            }}
            style={{
              ...btn,
              background: "#333",
              color: "white",
              marginTop: 0,
            }}
          >
            ⬅ Back
          </button>

          <button
            style={{
              ...btn,
              background: "#444",
              color: "white",
              width: 200,
            }}
            onClick={createMatch}
          >
            🎮 Create Match
          </button>
        </div>
      )}

      {!mode && showModeSelect && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <h2>Choose Mode</h2>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 10,
            }}
          >
            <button
              onClick={() => setMode("pvp")}
              style={{
                ...btn,
                background: "#1e90ff",
                color: "white",
                minWidth: 140,
              }}
            >
              🆚 PvP
            </button>

            <button
              onClick={() => setMode("solo")}
              style={{
                ...btn,
                background: "#ff9800",
                color: "white",
                minWidth: 140,
              }}
            >
              🎲 Solo
            </button>
          </div>
        </div>
      )}

      {mode && showModeSelect && (
        <div
          style={{
            marginTop: 15,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <p style={{ marginBottom: 2 }}>Bounty title:</p>

          <input
            type="text"
            value={matchTitle}
            onChange={(e) => setMatchTitle(e.target.value)}
            placeholder="What is this bounty?"
            maxLength={100}
            style={{
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              width: 200,
              textAlign: "center",
            }}
          />

          <p style={{ marginBottom: 2 }}>Input bet:</p>

          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            placeholder="Enter bounty bet"
            style={{
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              width: 200,
              textAlign: "center",
            }}
          />
        </div>
      )}

      {currentMatch && !showModeSelect && (
        <p style={{ marginTop: 10 }}>
          Match ID: <b>{currentMatch.id}</b>
        </p>
      )}

      {!currentMatch && !pendingJoin && !mode && (
        <div style={{ marginTop: 10 }}>
          <input
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            placeholder="Enter Match ID"
            style={{
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          <button
            style={{ ...btn, background: "purple", color: "white" }}
            onClick={lookupMatch}
          >
            Join Match
          </button>
        </div>
      )}

      {shouldShowJoinPrompt && pendingJoin && (
        <JoinMatchPrompt
          previewCost={previewCost}
          previewCurrent={previewCurrent}
          previewAfter={previewAfter}
          onCancel={() => setPendingJoin(null)}
          pendingJoin={pendingJoin}
          sessionUserId={sessionUserId}
          onJoined={onJoined}
          showPopup={showPopup}
          loadUser={loadUser}
        />
      )}
    </>
  );
}
