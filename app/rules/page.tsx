export default function RulesPage() {
    return (
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "40px 20px",
                fontFamily: "Arial",
                color: "white",
                background: "#111",
            }}
        >
            <div
                style={{
                    maxWidth: "600px",
                    textAlign: "center",
                    lineHeight: 1.6,
                }}
            >
                <h1>How Bounty Works</h1>
                <p
                    style={{
                        marginBottom: "20px",
                    }}
                ></p>
                ```
                <h2>Solo</h2>
                <p style={{ marginBottom: "30px" }}>
                    The creator doesn't pay to enter. Viewers can vote for A or B.

                    Paid votes add bounty to the pool. If the prediction is correct, 90% goes to the correct voters and 10% goes to the creator.

                    If 90% or more of bounty-paying voters are wrong, their bounty is refunded.

                    If nobody gets it right and the refund rule isn't triggered, the creator gets the whole pool.

                    The audience risks bounty. The creator doesn't.
                </p>

                <h2>PvP</h2>
                <p style={{ marginBottom: "30px" }}>
                    Both players pay the entry bounty, and viewer votes add more bounty to the pool.

                    If the match pays out, 10% goes to the winner and 90% goes to the correct bounty-paying voters. The loser doesn't receive a payout.

                    If 10% or fewer bounty-paying voters predict the winner correctly, the match is refunded. Both players get their entry bounty back, and paid voters get their bounty back.

                    If nobody pays to vote, the winner gets the whole pool.

                    More paid votes = a bigger potential reward.

                </p>
                <h2>Voting</h2>
                <p style={{ marginBottom: "30px" }}>
                    You can vote through bounty.town or, if enabled, through the bounty.town Twitch bot.

                    Once you vote, your prediction is locked and can't be changed.

                    Free votes can participate, but only bounty-paying votes count toward the refund rules.
                </p>
                <h2>🔒 Your Vote Is Locked</h2>
                <p style={{ marginBottom: "30px" }}>
                    Once you vote, your prediction is locked for that match. You can't change your vote later.

                    You can vote through bounty.town or through supported Twitch chat voting, and your prediction remains locked either way.
                </p>
                <h2>💰 More Votes = Bigger Bounty</h2>
                <p style={{ marginBottom: "30px" }}>
                    Every paid vote can grow the bounty pool.

                    So whether you're playing, watching, or voting from Twitch...

                    Put your bounty where your prediction is. 🐈‍⬛
                </p>
                <a
                    href="/"
                    style={{
                        color: "#9146FF",
                        textDecoration: "none",
                    }}
                >
                    ← Back to bounty.town
                </a>
            </div>
        </main>
    );
}