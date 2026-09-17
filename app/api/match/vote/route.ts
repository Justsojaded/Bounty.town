import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { match_id, vote } = await request.json();

  if (!match_id || !["A", "B"].includes(vote)) {
    return Response.json({ error: "Invalid vote" }, { status: 400 });
  }

  const user_id = String(sessionUserId);

  // 1. Match and eligibility are enforced server-side. The client cannot
  // choose another user's identity or vote for a player in the match.
  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select("mode, status, creator_id, opponent_id, bet_amount, bounty_pool")
    .eq("id", String(match_id))
    .single();

  if (matchError || !match) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  if (!["open", "active", "lobby", "waiting"].includes(match.status)) {
    return Response.json({ error: "Voting is closed" }, { status: 400 });
  }

  if (
    user_id === match.creator_id ||
    (match.mode === "pvp" && user_id === match.opponent_id)
  ) {
    return Response.json({ error: "Players cannot vote on their own match" }, { status: 403 });
  }

  // 2. Existing website vote — votes are locked after the first choice.
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("match_votes")
    .select("vote")
    .eq("match_id", String(match_id))
    .eq("user_id", user_id)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  // 3. Check the user's linked Twitch vote too. A Twitch vote is the same
  // prediction as a website vote, so it also locks the user from voting again.
  const { data: twitchConnection, error: twitchConnectionError } =
    await supabaseAdmin
      .from("twitch_connections")
      .select("twitch_id")
      .eq("user_id", user_id)
      .maybeSingle();

  if (twitchConnectionError) {
    return Response.json(
      { error: twitchConnectionError.message },
      { status: 500 }
    );
  }

  let linkedTwitchId = twitchConnection?.twitch_id ?? null;

  if (!linkedTwitchId) {
    const { data: bountyTwitchLink, error: bountyTwitchLinkError } =
      await supabaseAdmin
        .from("bounties")
        .select("twitch_id")
        .eq("user_id", user_id)
        .maybeSingle();

    if (bountyTwitchLinkError) {
      return Response.json(
        { error: bountyTwitchLinkError.message },
        { status: 500 }
      );
    }

    linkedTwitchId = bountyTwitchLink?.twitch_id ?? null;
  }

  let existingTwitchVote: { vote: string } | null = null;

  if (linkedTwitchId) {
    const { data: twitchVote, error: twitchVoteError } = await supabaseAdmin
      .from("twitch_votes")
      .select("vote")
      .eq("match_id", String(match_id))
      .eq("twitch_user_id", linkedTwitchId)
      .maybeSingle();

    if (twitchVoteError) {
      return Response.json(
        { error: twitchVoteError.message },
        { status: 500 }
      );
    }

    existingTwitchVote = twitchVote;
  }

  if (existing || existingTwitchVote) {
    const currentVote =
      existing?.vote ?? existingTwitchVote?.vote ?? null;

    return Response.json(
      {
        error: currentVote
          ? `You already voted ${currentVote}`
          : "You already voted",
        current_vote: currentVote,
      },
      { status: 409 }
    );
  }

  // 4. User check
  const { data: user } = await supabaseAdmin
    .from("bounties")
    .select("bounty")
    .eq("user_id", user_id)
    .single();

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // 5. bet_amount is the fixed paid-vote cost for this match. The client
  // cannot choose the amount.
  const BET_COST = Number(match.bet_amount ?? match.bounty_pool ?? 0);

  if (BET_COST <= 0) {
    return Response.json({ error: "Invalid match bet amount" }, { status: 400 });
  }

  if (user.bounty < BET_COST) {
    return Response.json(
      { error: "Not enough bounty to vote" },
      { status: 400 }
    );
  }

  const { data: latestMatch, error: latestMatchError } = await supabaseAdmin
    .from("matches")
    .select("status")
    .eq("id", String(match_id))
    .single();

  if (latestMatchError || !latestMatch) {
    return Response.json(
      { error: "Match no longer exists" },
      { status: 404 }
    );
  }

  if (!["open", "active", "lobby", "waiting"].includes(latestMatch.status)) {
    return Response.json(
      { error: "Voting is closed" },
      { status: 400 }
    );
  }

  const { data: updatedBounty, error: deductError } = await supabaseAdmin
    .from("bounties")
    .update({ bounty: user.bounty - BET_COST })
    .eq("user_id", user_id)
    .gte("bounty", BET_COST)
    .select("user_id")
    .maybeSingle();

  if (deductError || !updatedBounty) {
    return Response.json(
      { error: "Failed to deduct bounty" },
      { status: 500 }
    );
  }

  const { error: poolError } = await supabaseAdmin
    .from("matches")
    .update({ bounty_pool: (match.bounty_pool || 0) + BET_COST })
    .eq("id", match_id);

  if (poolError) {
    await supabaseAdmin
      .from("bounties")
      .update({ bounty: user.bounty })
      .eq("user_id", user_id);

    return Response.json(
      { error: "Failed to add bounty to pool" },
      { status: 500 }
    );
  }

  // 6. Save the locked website vote.
  const { error } = await supabaseAdmin
    .from("match_votes")
    .insert({
      match_id: String(match_id),
      user_id,
      vote,
      updated_at: new Date().toISOString(),
      bet_amount: BET_COST,
    });

  if (error) {
    await supabaseAdmin
      .from("bounties")
      .update({ bounty: user.bounty })
      .eq("user_id", user_id);

    await supabaseAdmin
      .from("matches")
      .update({ bounty_pool: Math.max(0, (match.bounty_pool || 0) - BET_COST) })
      .eq("id", match_id);

    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
