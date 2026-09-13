import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mode, bet_amount, title } = await req.json();
  const user_id = String(sessionUserId);

  if (!["solo", "pvp"].includes(mode)) {
    return Response.json({ error: "Invalid match mode" }, { status: 400 });
  }

  const betAmount = Number(bet_amount);
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    return Response.json({ error: "Invalid bet_amount" }, { status: 400 });
  }

  const isSolo = mode === "solo";

  const { data: user, error } = await supabaseAdmin
    .from("bounties")
    .select("bounty")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error || !user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (!isSolo && user.bounty < betAmount) {
    return Response.json({ error: "Not enough bounty" }, { status: 400 });
  }

  const matchId = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .insert({
      id: matchId,
      creator_id: user_id,
      opponent_id: null,
      status: "open",
      mode,
      title: title || null,
      bet_amount: betAmount,
      bounty_pool: 0,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (matchError || !match) {
    return Response.json({ error: "Failed to create match" }, { status: 500 });
  }

  if (!isSolo) {
    const { data: deducted, error: deductError } = await supabaseAdmin
      .from("bounties")
      .update({ bounty: user.bounty - betAmount })
      .eq("user_id", user_id)
      .gte("bounty", betAmount)
      .select("user_id")
      .maybeSingle();

    if (deductError || !deducted) {
      await supabaseAdmin.from("matches").delete().eq("id", matchId);
      return Response.json({ error: "Failed to deduct bounty" }, { status: 500 });
    }
  }

  return Response.json({ data: match });
}
