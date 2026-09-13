"use client";

type JoinMatchPromptProps = {
    previewCost: number;
    previewCurrent: number;
    previewAfter: number;
    onCancel: () => void;

    pendingJoin: {
        matchId: string;
    };
    sessionUserId: string;
    onJoined: (match: any) => void;
    showPopup: (message: string) => void;
    loadUser: (userId: string) => Promise<void>;
};

export default function JoinMatchPrompt({
    previewCost,
    previewCurrent,
    previewAfter,
    onCancel,
    pendingJoin,
    sessionUserId,
    onJoined,
    showPopup,
    loadUser,
}: JoinMatchPromptProps) {
    return (
        <div
            style={{
                marginTop: 15,
                padding: 12,
                border: "1px solid #444",
                borderRadius: 8,
                textAlign: "center",
                background: "#111",
            }}
        >
            <p style={{ marginBottom: 10 }}>
                Join match for <b>{previewCost}</b> bounty?
            </p>

            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>
                <div>You have: {previewCurrent}</div>
                <div>Cost: -{previewCost}</div>
                <div style={{ marginTop: 4 }}>
                    After: <b>{previewAfter}</b>
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                    style={{ background: "green", color: "white" }}
                    onClick={async () => {
                        const joinRes = await fetch("/api/match/join", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                user_id: sessionUserId,
                                match_id: pendingJoin.matchId,
                            }),
                        });

                        const joinData = await joinRes.json();

                        if (!joinRes.ok) {
                            showPopup(joinData.error || "Failed to join match");
                            return;
                        }

                        onJoined(joinData.data);

                        await loadUser(sessionUserId);

                        showPopup(
                            joinData.alreadyJoined
                                ? "👀 You're already in this match"
                                : "✅ Joined match!"
                        );
                    }}
                >
                    Confirm Join
                </button>

                <button
                    style={{ background: "red", color: "white" }}
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}