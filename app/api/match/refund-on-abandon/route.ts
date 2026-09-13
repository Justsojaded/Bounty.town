import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { match_id } = await req.json();

  if (!match_id) {
    return Response.json({ error: "Missing match_id" }, { status: 400 });
  }

  // An abandoned match is only refundable after both participants have left.
  // Claim it first so this endpoint cannot refund the same match twice.
  const { data: match, error: claimError } = await supabaseAdmin
    .from("matches")
    .update({ status: "processing" })
    .eq("id", match_id)
    .in("status", ["open", "active"])
    .is("creator_id", null)
    .is("opponent_id", null)
    .select("*")
    .maybeSingle();

  if (claimError) {
    return Response.json({ error: claimError.message }, { status: 500 });
  }

  if (!match) {
    return Response.json({ error: "Match is not abandoned or already processed" }, { status: 400 });
  }

  const refundBounty = async (targetUserId: string, amount: number) => {
    if (!targetUserId || amount <= 0) return;

    const { data: bountyRow, error: bountyError } = await supabaseAdmin
      .from("bounties")
      .select("bounty")
      .eq("user_id", targetUserId)
      .single();

    if (bountyError || !bountyRow) {
      throw new Error(`Failed to load bounty for ${targetUserId}`);
    }

    const { error } = await supabaseAdmin
      .from("bounties")
      .update({ bounty: Number(bountyRow.bounty ?? 0) + amount })
      .eq("user_id", targetUserId);

    if (error) {
      throw new Error(`Failed to refund bounty for ${targetUserId}`);
    }
  };

  try {
    const { data: votes, error: votesError } = await supabaseAdmin
      .from("match_votes")
      .select("user_id, bet_amount")
      .eq("match_id", match_id);

    if (votesError) throw votesError;

    const refundedWebsiteVoters = new Set<string>();

    for (const vote of votes || []) {
      if (!vote.user_id || refundedWebsiteVoters.has(vote.user_id)) continue;

      const amount = Math.max(0, Number(vote.bet_amount ?? 0));
      if (amount <= 0) continue;

      await refundBounty(vote.user_id, amount);
      refundedWebsiteVoters.add(vote.user_id);
    }

    const { data: twitchVotes, error: twitchVotesError } = await supabaseAdmin
      .from("twitch_votes")
      .select("bounty_user_id, bet_amount")
      .eq("match_id", match_id)
      .not("bounty_user_id", "is", null)
      .gt("bet_amount", 0);

    if (twitchVotesError) throw twitchVotesError;

    for (const twitchVote of twitchVotes || []) {
      if (!twitchVote.bounty_user_id) continue;
      if (refundedWebsiteVoters.has(twitchVote.bounty_user_id)) continue;

      const amount = Math.max(0, Number(twitchVote.bet_amount ?? 0));
      if (amount <= 0) continue;

      await refundBounty(twitchVote.bounty_user_id, amount);
    }

    // PvP participants have already been cleared from the match record by the
    // abandonment flow, so their original entries are not recoverable here.
    // Keep this endpoint focused on audience refunds rather than inventing a
    // player identity after both sides have left.

    const { error: closeError } = await supabaseAdmin
      .from("matches")
      .update({ status: "cancelled", winner_id: null })
      .eq("id", match_id)
      .eq("status", "processing");

    if (closeError) throw closeError;

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    await supabaseAdmin
      .from("matches")
      .update({ status: match.status })
      .eq("id", match_id)
      .eq("status", "processing");

    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
