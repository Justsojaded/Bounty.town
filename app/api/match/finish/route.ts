import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateSoloRewards } from "@/lib/game/soloRewards";
import { calculatePvPRewards } from "@/lib/game/payoutsPvp";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { match_id, winner_id } = await req.json();
  const caller_id = String(sessionUserId);

  if (!match_id) {
    return Response.json({ error: "Missing match_id" }, { status: 400 });
  }

  const { data: initialMatch, error: initialMatchError } = await supabaseAdmin
    .from("matches")
    .select("creator_id, opponent_id, mode, bet_amount")
    .eq("id", match_id)
    .single();

  if (initialMatchError || !initialMatch) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  const isParticipant =
    caller_id === initialMatch.creator_id ||
    caller_id === initialMatch.opponent_id;

  if (!isParticipant) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  if (initialMatch.mode === "pvp") {
    if (!initialMatch.opponent_id) {
      return Response.json({ error: "No opponent" }, { status: 400 });
    }

    if (caller_id !== winner_id) {
      return Response.json(
        { error: "You can only declare yourself as winner" },
        { status: 403 }
      );
    }
  } else {
    if (winner_id !== null && winner_id !== undefined && winner_id !== initialMatch.creator_id) {
      return Response.json({ error: "Invalid Solo winner" }, { status: 400 });
    }
  }

  // 🔒 Lock match only after authorization has passed.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("matches")
    .update({ status: "processing" })
    .eq("id", match_id)
    .in("status", ["active", "open", "waiting", "lobby"])
    .select()
    .single();

  if (!claimed || claimError) {
    return Response.json({ error: "Already processing or finished" }, { status: 400 });
  }

  const match = claimed;
  const finalWinnerId = match.mode === "solo"
    ? (winner_id ? match.creator_id : null)
    : winner_id;
  const entryFee = Number(match.bet_amount ?? 0);

  const { data: votes } = await supabaseAdmin
    .from("match_votes")
    .select("user_id, vote, bet_amount")
    .eq("match_id", match_id);

  const { data: twitchVotes } = await supabaseAdmin
    .from("twitch_votes")
    .select("bounty_user_id, vote, bet_amount")
    .eq("match_id", match_id)
    .gt("bet_amount", 0)
    .not("bounty_user_id", "is", null);

  const allVotes = votes ?? [];
  const websiteVoterIds = new Set(allVotes.map(v => v.user_id));

  const paidTwitchVotes = (twitchVotes ?? [])
    .filter(v => v.bounty_user_id && !websiteVoterIds.has(v.bounty_user_id))
    .map(v => ({
      user_id: v.bounty_user_id as string,
      vote: v.vote as "A" | "B",
      bet_amount: Number(v.bet_amount ?? 0),
    }));

  const combinedVotes = [
    ...allVotes.map(v => ({
      user_id: v.user_id,
      vote: v.vote as "A" | "B",
      bet_amount: Number(v.bet_amount ?? 0),
    })),
    ...paidTwitchVotes,
  ];

  const voteData = match.mode === "solo"
    ? combinedVotes.filter(v => v.user_id !== match.creator_id)
    : combinedVotes.filter(
      v => v.user_id !== match.creator_id && v.user_id !== match.opponent_id
    );

  // Player entries and audience bounty are separate. Only paid audience votes
  // belong in the voter pool; player entry fees are supplied separately.
  const voterPaid = voteData.reduce(
    (sum, vote) => sum + Math.max(0, Number(vote.bet_amount ?? 0)),
    0
  );
  const actualPool = match.mode === "solo"
    ? voterPaid
    : Math.max(0, entryFee * 2 + voterPaid);

  let rewards: Record<string, { xp: number; bounty: number }> = {};

  if (match.mode === "solo") {
    const result = calculateSoloRewards({
      betAmount: actualPool,
      creatorId: match.creator_id,
      votes: voteData,
      creatorOutcome: winner_id ? "WIN" : "LOSE",
    });
    rewards = result.rewards;
  } else {
    const result = calculatePvPRewards({
      votes: voteData,
      creatorId: match.creator_id,
      opponentId: match.opponent_id,
      winnerId: finalWinnerId,
      voterPool: voterPaid,
      entryFee,
    });
    rewards = result.rewards;
  }

  for (const userId in rewards) {
    const reward = rewards[userId];

    const { data: user, error: userError } = await supabaseAdmin
      .from("bounties")
      .select("bounty, points")
      .eq("user_id", userId)
      .single();

    if (userError || !user) {
      return Response.json(
        { error: `Unable to load reward account for ${userId}` },
        { status: 500 }
      );
    }

    const { data: updatedUser, error: rewardError } = await supabaseAdmin
      .from("bounties")
      .update({
        bounty: Number(user.bounty ?? 0) + reward.bounty,
        points: Number(user.points ?? 0) + reward.xp,
      })
      .eq("user_id", userId)
      .eq("bounty", Number(user.bounty ?? 0))
      .eq("points", Number(user.points ?? 0))
      .select("user_id")
      .maybeSingle();

    if (rewardError || !updatedUser) {
      return Response.json(
        { error: `Unable to apply reward for ${userId}` },
        { status: 500 }
      );
    }
  }

  const { data: updated } = await supabaseAdmin
    .from("matches")
    .update({
      status: "finished",
      winner_id: finalWinnerId,
    })
    .eq("id", match_id)
    .eq("status", "processing")
    .select()
    .single();

  if (!updated) {
    return Response.json({ error: "Already finished" }, { status: 400 });
  }

  return Response.json({ ok: true, rewards });
}
