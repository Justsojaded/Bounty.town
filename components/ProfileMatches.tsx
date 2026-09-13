"use client";

import { useState } from "react";

type Match = {
    id: string;
    creator_id: string;
    opponent_id: string | null;
    status: string;
    winner_id: string | null;
    created_at: string;
    mode: string;
    bounty_pool: number;
    title: string | null;
};

export default function ProfileMatches({
    matches,
    userId,
    isOwnProfile,
}: {
    matches: Match[];
    userId: string;
    isOwnProfile: boolean;
}) {
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const start = (page - 1) * pageSize;
    const paginatedMatches = matches.slice(start, start + pageSize);
    const hasNextPage = start + pageSize < matches.length;
    const hideMatch = async (matchId: string) => {
        const response = await fetch("/api/profile/hide-match", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                match_id: matchId,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();

            console.error("HIDE MATCH FAILED:", {
                status: response.status,
                body: errorText,
            });

            return;
        }

        window.location.reload();
    };
    return (
        <div>
            <div className="mt-4 space-y-4">
                {paginatedMatches.length ? (
                    paginatedMatches.map((match) => {
                        const won = match.winner_id === userId;

                        return (
                            <div
                                key={match.id}
                                className="rounded-lg border p-4"
                            >
                                {match.title && (
                                    <p className="text-lg font-semibold">
                                        {match.mode === "solo" ? "🎯 Solo" : "⚔️ PvP"}
                                        {match.title && ` — ${match.title}`}
                                    </p>
                                )}

                                <p className="font-semibold">
                                    Match #{match.id}
                                </p>

                                <p>
                                    Bounty Pool: {match.bounty_pool}
                                </p>

                                <p>
                                    Result: {won ? "Won" : "Lost"}
                                </p>

                                <p>
                                    Date:{" "}
                                    {new Date(
                                        match.created_at
                                    ).toLocaleDateString()}
                                </p>
                                {isOwnProfile && (
                                    <button
                                        onClick={() => hideMatch(match.id)}
                                        className="mt-2 rounded px-3 py-1 border"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <p>No past bounties yet.</p>
                )}
            </div>

            <div className="mt-6 flex items-center gap-4">
                <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded border px-3 py-1 disabled:opacity-50"
                >
                    ← Previous
                </button>

                <span>Page {page}</span>

                <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNextPage}
                    className="rounded border px-3 py-1 disabled:opacity-50"
                >
                    Next →
                </button>
            </div>
        </div>
    );
}