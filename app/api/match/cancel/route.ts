import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { match_id } = body;
    const user_id = String(sessionUserId);

    if (!match_id) {
      return NextResponse.json({ error: "Missing match_id" }, { status: 400 });
    }

    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", match_id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.creator_id !== user_id) {
      return NextResponse.json(
        { error: "Only creator can cancel match" },
        { status: 403 }
      );
    }

    if (match.opponent_id) {
      return NextResponse.json(
        { error: "Cannot cancel — opponent already joined" },
        { status: 400 }
      );
    }

    if (!["open", "lobby", "waiting"].includes(match.status)) {
      return NextResponse.json(
        { error: "Match cannot be cancelled in current state" },
        { status: 400 }
      );
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

      const { error: updateBountyError } = await supabaseAdmin
        .from("bounties")
        .update({ bounty: Number(bountyRow.bounty ?? 0) + amount })
        .eq("user_id", targetUserId);

      if (updateBountyError) {
        throw new Error(`Failed to refund bounty for ${targetUserId}`);
      }
    };

    const { data: votes, error: votesError } = await supabaseAdmin
      .from("match_votes")
      .select("user_id, bet_amount")
      .eq("match_id", match_id);

    if (votesError) {
      return NextResponse.json(
        { error: "Failed to load votes for refund" },
        { status: 500 }
      );
    }

    if (votes && votes.length > 0) {
      return NextResponse.json(
        { error: "Cannot cancel — votes already exist" },
        { status: 400 }
      );
    }

    const refundedWebsiteUsers = new Set<string>();

    for (const vote of votes || []) {
      if (!vote.user_id || refundedWebsiteUsers.has(vote.user_id)) continue;

      const amount = Number(vote.bet_amount ?? 0);
      if (amount <= 0) continue;

      await refundBounty(vote.user_id, amount);
      refundedWebsiteUsers.add(vote.user_id);
    }

    const { data: twitchVotes, error: twitchVotesError } = await supabaseAdmin
      .from("twitch_votes")
      .select("bounty_user_id, bet_amount")
      .eq("match_id", match_id)
      .not("bounty_user_id", "is", null)
      .gt("bet_amount", 0);

    if (twitchVotesError) {
      return NextResponse.json(
        { error: "Failed to load Twitch votes for refund" },
        { status: 500 }
      );
    }

    for (const twitchVote of twitchVotes || []) {
      if (!twitchVote.bounty_user_id) continue;
      if (refundedWebsiteUsers.has(twitchVote.bounty_user_id)) continue;

      const amount = Number(twitchVote.bet_amount ?? 0);
      if (amount <= 0) continue;

      await refundBounty(twitchVote.bounty_user_id, amount);
    }

    if (match.mode === "pvp" && match.creator_id) {
      await refundBounty(match.creator_id, Number(match.bet_amount ?? 0));
    }

    const { error: updateError } = await supabaseAdmin
      .from("matches")
      .update({ status: "cancelled", winner_id: null })
      .eq("id", match_id)
      .eq("status", match.status);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to cancel match" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Match cancelled and refunds issued",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
