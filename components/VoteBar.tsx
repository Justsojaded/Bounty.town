"use client";

import { useVote } from "./VoteContext";

type VoteBarProps = {
    isSolo: boolean;
    currentMatch: any;
    voteCount: {
        a: number;
        b: number;
    };
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
    totalVotes: number;
    sideNames: {
        A: string;
        B: string;
    };
    sideColors: {
        A: string;
        B: string;
    };
    myVote: "A" | "B" | null;
    pendingVote: "A" | "B" | null;
    canVote?: boolean;
    showVoteButtons?: boolean;
    isCoolingDown?: boolean;
    sliderImageUrl?: string;
};

export default function VoteBar({
    isSolo,
    currentMatch,
    voteCount,
    sides,
    totalVotes,
    sideNames,
    sideColors,
    myVote,
    pendingVote,
    canVote,
    showVoteButtons = true,
    isCoolingDown = false,
    sliderImageUrl,
}: VoteBarProps) {
    const vote = useVote();
    const displayedVote = isCoolingDown ? myVote : myVote || pendingVote;
    const voteLocked = Boolean(myVote) || isCoolingDown;

    const voteButtonStyle = (background: string) => ({
        padding: "10px 18px",
        borderRadius: 8,
        border: "none",
        background: voteLocked ? "#555" : background,
        color: "white",
        cursor: voteLocked ? "not-allowed" : "pointer",
        fontWeight: 600,
        opacity: voteLocked ? 0.65 : 1,
        transition: "opacity 0.2s ease, background 0.2s ease",
    });

    if (isSolo) {
        const totalSoloVotes = voteCount.a + voteCount.b;
        const soloWinPercent =
            totalSoloVotes === 0
                ? 50
                : (voteCount.b / totalSoloVotes) * 100;

        const customSlider = Boolean(sliderImageUrl);
        const loseWidth = `${(100 - soloWinPercent) / 2}%`;
        const winWidth = `${soloWinPercent / 2}%`;

        return (
            <div
                style={{
                    textAlign: "center",
                    marginTop: 20,
                    marginBottom: 10,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: 300,
                        margin: "0 auto 6px auto",
                        fontSize: 12,
                        color: "#aaa",
                    }}
                >
                    <span>❌ LOSE — {voteCount.a}</span>
                    <span>{voteCount.b} — WIN 🏆</span>
                </div>

                <div
                    style={{
                        position: "relative",
                        width: 300,
                        height: 10,
                        background: "#222",
                        borderRadius: 5,
                        overflow: "hidden",
                        margin: "8px auto",
                    }}
                >
                    {customSlider ? (
                        <>
                            <div
                                style={{
                                    position: "absolute",
                                    right: "50%",
                                    top: 0,
                                    width: loseWidth,
                                    height: 10,
                                    overflow: "hidden",
                                    backgroundImage: `url(${sliderImageUrl})`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundSize: "auto",
                                    backgroundPosition: "right center",
                                }}
                            />

                            <div
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: 0,
                                    width: winWidth,
                                    height: 10,
                                    overflow: "hidden",
                                    backgroundImage: `url(${sliderImageUrl})`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundSize: "auto",
                                    backgroundPosition: "left center",
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <div
                                style={{
                                    position: "absolute",
                                    right: "50%",
                                    top: 0,
                                    height: "100%",
                                    width: loseWidth,
                                    background: "red",
                                    transition: "width 0.4s ease",
                                }}
                            />

                            <div
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: 0,
                                    height: "100%",
                                    width: winWidth,
                                    background: "blue",
                                    transition: "width 0.4s ease",
                                }}
                            />
                        </>
                    )}

                    <div
                        style={{
                            position: "absolute",
                            left: `${soloWinPercent}%`,
                            top: -4,
                            transform: "translateX(-50%)",
                            width: 8,
                            height: 18,
                            background: "white",
                            borderRadius: 4,
                            transition:
                                "left 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    />
                </div>

                {displayedVote ? (
                    <p
                        style={{
                            fontSize: 12,
                            color: "#aaa",
                            marginTop: 8,
                        }}
                    >
                        You voted: {displayedVote === "A" ? "LOSE" : "WIN"}
                    </p>
                ) : !canVote ? (
                    <p
                        style={{
                            fontSize: 12,
                            color: "#ff6666",
                            marginTop: 8,
                        }}
                    >
                        Unable to vote
                    </p>
                ) : null}
                {showVoteButtons && canVote && !voteLocked && (
                    <button
                        onClick={() => vote?.("A")}
                        style={voteButtonStyle("red")}
                    >
                        ❌ LOSE
                    </button>
                )}
                {showVoteButtons && canVote && !voteLocked && (
                    <button
                        onClick={() => vote?.("B")}
                        style={voteButtonStyle("blue")}
                    >
                        🏆 WIN
                    </button>
                )}
            </div>
        );
    }

    const customSlider = Boolean(sliderImageUrl);

    const creatorWidth = `${(sides.A.votes / totalVotes) * 50}%`;
    const opponentWidth = `${(sides.B.votes / totalVotes) * 50}%`;

    return (
        <div
            style={{
                textAlign: "center",
                marginTop: 20,
                marginBottom: 10,
            }}
        >
            {displayedVote ? (
                <p
                    style={{
                        fontSize: 12,
                        color: "#aaa",
                    }}
                >
                    You voted: {sideNames[displayedVote]}
                </p>
            ) : !canVote ? (
                <p
                    style={{
                        fontSize: 12,
                        color: "#ff6666",
                    }}
                >
                    Unable to vote
                </p>
            ) : null}
            {showVoteButtons && canVote && !voteLocked && (
                <button
                    onClick={() => vote?.("A")}
                    style={voteButtonStyle(sideColors.A)}
                >
                    {sideNames.A}
                </button>
            )}
            {showVoteButtons && canVote && !voteLocked && (
                <button
                    onClick={() => vote?.("B")}
                    style={voteButtonStyle(sideColors.B)}
                >
                    {sideNames.B}
                </button>
            )}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: 300,
                    margin: "2px auto 8px auto",
                    color: "#ccc",
                    fontSize: 13,
                }}
            >
                <span>
                    <span
                        style={{
                            color: sideColors.A,
                        }}
                    >
                        {sideNames.A} — {sides.A.votes}
                    </span>
                </span>
                                <span>
                    {currentMatch.opponent_id ? (
                        <span
                            style={{
                                color: sideColors.B,
                            }}
                        >
                            {sideNames.B} — {sides.B.votes}
                        </span>
                    ) : (
                        "⏳ Waiting for opponent..."
                    )}
                </span>
            </div>

            {totalVotes > 0 && (
                <div
                    style={{
                        position: "relative",
                        width: 300,
                        height: 10,
                        background: "#222",
                        borderRadius: 5,
                        overflow: "hidden",
                        margin: "8px auto",
                    }}
                >
                    {customSlider ? (
                        <>
                            <div
                                style={{
                                    position: "absolute",
                                    right: "50%",
                                    top: 0,
                                    width: creatorWidth,
                                    height: 10,
                                    overflow: "hidden",
                                    backgroundImage: `url(${sliderImageUrl})`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundSize: "auto",
                                    backgroundPosition: "right center",
                                }}
                            />

                            <div
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: 0,
                                    width: opponentWidth,
                                    height: 10,
                                    overflow: "hidden",
                                    backgroundImage: `url(${sliderImageUrl})`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundSize: "auto",
                                    backgroundPosition: "left center",
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <div
                                style={{
                                    position: "absolute",
                                    right: "50%",
                                    top: 0,
                                    height: "100%",
                                    width: creatorWidth,
                                    background: "blue",
                                    transition: "width 0.4s ease",
                                }}
                            />

                            <div
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: 0,
                                    height: "100%",
                                    width: opponentWidth,
                                    background: "red",
                                    transition: "width 0.4s ease",
                                }}
                            />
                        </>
                    )}

                    <div
                        style={{
                            position: "absolute",
                            left: `${50 +
                                ((sides.A.votes - sides.B.votes) /
                                    totalVotes) *
                                50
                                }%`,
                            top: -4,
                            transform: "translateX(-50%)",
                            width: 8,
                            height: 18,
                            background: "white",
                            borderRadius: 4,
                            transition:
                                "left 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    />
                </div>
            )}
        </div>
    );
}