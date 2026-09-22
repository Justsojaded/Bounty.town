import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { match_id } = await req.json();
  const user_id = String(sessionUserId);

  if (!match_id) {
    return new Response("Missing match_id", { status: 400 });
  }

  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select("*")
    .eq("id", match_id)
    .single();

  if (matchError || !match) {
    return new Response("Match not found", { status: 404 });
  }

  const isPvP = match.mode === "pvp";

  const alreadyJoined =
    match.creator_id === user_id || match.opponent_id === user_id;

  if (alreadyJoined) {
    return Response.json({
      data: match,
      role: match.creator_id === user_id ? "creator" : "opponent",
      alreadyJoined: true,
    });
  }

  if (!isPvP) {
    return Response.json({ data: match, role: "spectator" });
  }

  if (match.opponent_id) {
    return Response.json({ data: match, role: "spectator" });
  }

  if (!["open", "lobby", "waiting"].includes(match.status)) {
    return new Response("Match is not joinable", { status: 400 });
  }

  const cost = Number(match.bet_amount ?? 0);

  if (!Number.isFinite(cost) || cost <= 0) {
    return new Response("Invalid match entry fee", { status: 400 });
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("bounties")
    .select("bounty")
    .eq("user_id", user_id)
    .single();

  if (userError || !user) {
    return new Response("User not found", { status: 404 });
  }

  const current = Number(user.bounty ?? 0);

  if (current < cost) {
    return Response.json(
      { error: "Not enough bounty", current, required: cost },
      { status: 400 }
    );
  }

  // Deduct only after confirming the user is eligible. If the opponent slot
  // is won by another request, immediately refund this deduction.
  const { data: deducted, error: deductError } = await supabaseAdmin
    .from("bounties")
    .update({ bounty: current - cost })
    .eq("user_id", user_id)
    .gte("bounty", cost)
    .select("user_id")
    .maybeSingle();

  if (deductError || !deducted) {
    return Response.json({ error: "Failed to deduct bounty" }, { status: 500 });
  }

  const { data, error: joinError } = await supabaseAdmin
    .from("matches")
    .update({
      opponent_id: user_id,
      status: "active",
      bounty_pool: Number(match.bounty_pool ?? 0) + cost,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", match_id)
    .is("opponent_id", null)
    .select()
    .single();

  if (joinError || !data) {
    await supabaseAdmin
      .from("bounties")
      .update({ bounty: current })
      .eq("user_id", user_id);

    return Response.json(
      { error: "Match already taken" },
      { status: 400 }
    );
  }

  return Response.json({ data, role: "opponent" });
}
