"use client";

import { useEffect, useRef, useState } from "react";
import VoteBar from "../../../components/VoteBar";

export default function UserOverlay({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const [username, setUsername] = useState("");
    const [match, setMatch] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [voteCount, setVoteCount] = useState({ a: 0, b: 0 });
    const [winnerMessage, setWinnerMessage] = useState<string | null>(null);
    const finishedMatchRef = useRef<string | null>(null);
    useEffect(() => {
        let interval: NodeJS.Timeout;
        let hideTimer: NodeJS.Timeout;

        params.then(({ username }) => {
            setUsername(username);

            const loadMatch = async () => {
                try {
                    const response = await fetch(
                        `/api/profile/${username}/active-match`
                    );

                    const data = await response.json();
                    const latestMatch = data.match ?? null;

                    if (!latestMatch) {
                        setMatch(null);
                        setWinnerMessage(null);
                        finishedMatchRef.current = null;
                        return;
                    }

                    // Match finished
                    if (latestMatch.status === "finished") {
                        if (finishedMatchRef.current !== latestMatch.id) {
                            finishedMatchRef.current = latestMatch.id;
                            setMatch(latestMatch);

                            if (latestMatch.mode === "solo") {
                                const message =
                                    latestMatch.winner_id === latestMatch.creator_id
                                        ? "🏆 WIN!"
                                        : "💀 LOSE!";

                                setWinnerMessage(message);
                            } else {
                                let winnerName = "Winner";

                                if (
                                    latestMatch.winner_id ===
                                    latestMatch.creator_id
                                ) {
                                    const creator = latestMatch.creator;

                                    if (Array.isArray(creator)) {
                                        winnerName =
                                            creator[0]?.username || "Winner";
                                    } else {
                                        winnerName =
                                            creator?.username || "Winner";
                                    }
                                } else if (
                                    latestMatch.winner_id ===
                                    latestMatch.opponent_id
                                ) {
                                    const opponent = latestMatch.opponent;

                                    if (Array.isArray(opponent)) {
                                        winnerName =
                                            opponent[0]?.username || "Winner";
                                    } else {
                                        winnerName =
                                            opponent?.username || "Winner";
                                    }
                                }

                                setWinnerMessage(`🏆 ${winnerName} won!`);
                            }

                            clearTimeout(hideTimer);

                            hideTimer = setTimeout(() => {
                                setMatch(null);
                                setWinnerMessage(null);
                            }, 5000);
                        }

                        return;
                    }

                    // Normal active match
                    setMatch(latestMatch);
                    setWinnerMessage(null);
                    finishedMatchRef.current = null;
                }
                catch (error) {
                    console.error(
                        "Failed to load overlay match:",
                        error
                    );
                } finally {
                    setLoading(false);
                }
            };

            loadMatch();

            interval = setInterval(loadMatch, 1000);
        });

        return () => {
            clearInterval(interval);
            clearTimeout(hideTimer);
        };
    }, [params]);

    useEffect(() => {
        if (!match?.id) {
            setVoteCount({ a: 0, b: 0 });
            return;
        }

        const loadVotes = async () => {
            const res = await fetch(
                `/api/match/votes?match_id=${match.id}`
            );

            const json = await res.json();

            setVoteCount({
                a: json.a ?? 0,
                b: json.b ?? 0,
            });
        };

        loadVotes();

        const interval = setInterval(loadVotes, 1000);

        return () => clearInterval(interval);
    }, [match?.id]);

    if (loading) {
        return null;
    }

    if (!match) {
        return null;
    }

    const isSolo = match.mode === "solo";

    const sides = {
        A: {
            user: match.creator,
            userId: match.creator_id,
            votes: voteCount.a,
        },
        B: {
            user: match.opponent,
            userId: match.opponent_id,
            votes: voteCount.b,
        },
    };

    const getSideName = (side: "A" | "B") => {
        const user = sides[side].user;

        if (Array.isArray(user)) {
            return user[0]?.username || side;
        }

        return user?.username || side;
    };

    const getUserColor = (userId?: string) => {
        if (userId === match.creator_id) {
            return "blue";
        }

        if (userId === match.opponent_id) {
            return "red";
        }

        return "gray";
    };

    const totalVotes = Math.max(
        voteCount.a + voteCount.b,
        1
    );

    const fillPercent =
        50 +
        ((voteCount.b - voteCount.a) / totalVotes) * 50;

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                background: "transparent",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-end",
                paddingBottom: 50,
                fontFamily: "Arial",
                position: "relative",
            }}
        >
            <div
                style={{
                    width: 400,
                    background: "rgba(0,0,0,0.7)",
                    padding: 20,
                    borderRadius: 12,
                    color: "white",
                    textAlign: "center",
                }}
            >
                {winnerMessage ? (
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: "bold",
                            color: "gold",
                            padding: "20px 10px",
                        }}
                    >
                        {winnerMessage}
                    </div>
                ) : (
                    <>
                        <h3>
                            {isSolo ? "Solo" : "PvP"}: #{match.id}

                        </h3>

                        <p>{match.title}</p>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 18,
                                marginBottom: 8,
                                fontSize: 14,
                                color: "#aaa",
                            }}
                        >
                            <span>
                                🏆 Bounty pool: <b style={{ color: "white" }}>{match.bounty_pool ?? 0} bounty</b>
                            </span>
                            <span>
                                💰 Bet cost: <b style={{ color: "white" }}>{match.bet_amount ?? 0} bounty</b>
                            </span>
                        </div>

                        <VoteBar
                            isSolo={isSolo}
                            currentMatch={match}
                            voteCount={voteCount}
                            sides={sides}
                            totalVotes={totalVotes}
                            sideNames={{
                                A: getSideName("A"),
                                B: getSideName("B"),
                            }}
                            sideColors={{
                                A: getUserColor(match.creator_id),
                                B: getUserColor(match.opponent_id),
                            }}
                            myVote={null}
                            pendingVote={null}
                            canVote={true}
                            showVoteButtons={false}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
