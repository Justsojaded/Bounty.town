export function calculateSoloRewards({
    votes,
    creatorId,
    creatorOutcome,
    betAmount,
}: {
    votes: { user_id: string; vote: "A" | "B"; bet_amount?: number }[];
    creatorId: string;
    creatorOutcome: "WIN" | "LOSE";
    betAmount: number;
}) {
    // The Solo creator does not wager bounty.
    // The pool is funded only by paid voters.
    const voters = votes.filter(v => v.user_id !== creatorId);
    const paidVoters = voters.filter(v => Number(v.bet_amount ?? 0) > 0);
    const pool = Math.max(0, betAmount);

    // The creator reports the actual outcome.
    const correctSide = creatorOutcome === "WIN" ? "B" : "A";
    const correctPaidVoters = paidVoters.filter(v => v.vote === correctSide);

    const rewards: Record<string, { xp: number; bounty: number }> = {};

    // 🔄 If 90% or more of bounty-paying voters were wrong, refund every paid voter.
    if (
        paidVoters.length > 0 &&
        (paidVoters.length - correctPaidVoters.length) / paidVoters.length >= 0.9
    ) {
        for (const voter of paidVoters) {
            const paid = Math.max(0, Number(voter.bet_amount ?? 0));
            rewards[voter.user_id] = { xp: 0, bounty: paid };
        }

        return { pool, rewards };
    }

    // If nobody paid to vote correctly, the creator receives the entire voter pool.
    if (correctPaidVoters.length === 0) {
        rewards[creatorId] = {
            xp: 50,
            bounty: pool,
        };

        return { pool, rewards };
    }

    // Creator gets 10%; correct paid voters split 90%.
    const creatorShare = Math.floor(pool * 0.1);
    const voterPool = pool - creatorShare;
    const eachWinner = Math.floor(voterPool / correctPaidVoters.length);

    rewards[creatorId] = {
        xp: 50,
        bounty: creatorShare,
    };

    for (const v of correctPaidVoters) {
        rewards[v.user_id] = {
            xp: 10,
            bounty: eachWinner,
        };
    }

    return { pool, rewards };
}
