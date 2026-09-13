export function calculatePvPRewards({
    votes,
    creatorId,
    opponentId,
    winnerId,
    voterPool,
    entryFee,
}: {
    votes: { user_id: string; vote: "A" | "B"; bet_amount?: number }[];
    creatorId: string;
    opponentId: string;
    winnerId: string;
    voterPool: number;
    entryFee: number;
}) {
    // 🧠 Dedupe voters and keep the two players out of the audience pool.
    const voters = [...new Map(votes.map(v => [v.user_id, v])).values()]
        .filter(v => v.user_id !== creatorId && v.user_id !== opponentId);
    const paidVoters = voters.filter(v => Number(v.bet_amount ?? 0) > 0);

    const playerEntry = Math.max(0, entryFee);
    const pool = Math.max(0, voterPool + playerEntry * 2);
    const correctSide = winnerId === creatorId ? "A" : "B";
    const correctPaidVoters = paidVoters.filter(v => v.vote === correctSide);

    const rewards: Record<string, { xp: number; bounty: number }> = {};

    // 🏆 If nobody paid to vote, the winner gets the entire VS prize pool.
    if (paidVoters.length === 0) {
        rewards[winnerId] = { xp: 50, bounty: pool };
        return { pool, rewards };
    }

    // 🔄 If 10% or fewer bounty-paying voters predicted correctly, refund every paid stake.
    // This prevents correct voters from losing bounty when the correct side is too crowded.
    if (correctPaidVoters.length / paidVoters.length <= 0.1) {
        rewards[creatorId] = { xp: 50, bounty: playerEntry };
        rewards[opponentId] = { xp: 50, bounty: playerEntry };

        for (const voter of paidVoters) {
            const paid = Math.max(0, Number(voter.bet_amount ?? 0));
            rewards[voter.user_id] = { xp: 0, bounty: paid };
        }

        return { pool, rewards };
    }

    // 🏆 Esports Mode: winner gets 10% of the total pool.
    // The losing player gets no additional bounty reward.
    const winnerShare = Math.floor(pool * 0.1);
    const voterRewardPool = pool - winnerShare;
    const eachWinner = Math.floor(voterRewardPool / correctPaidVoters.length);

    rewards[winnerId] = { xp: 50, bounty: winnerShare };

    // 🎲 Correct paid voters split the remaining 90% of the total pool.
    for (const voter of correctPaidVoters) {
        rewards[voter.user_id] = {
            xp: 10,
            bounty: eachWinner,
        };
    }

    return { pool, rewards };
}