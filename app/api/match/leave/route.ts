import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { match_id } = await req.json();
  const user_id = String(session.user.id);

  if (!match_id) {
    return Response.json({ error: "Missing match_id" }, { status: 400 });
  }

  // 1. get match
  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select("*")
    .eq("id", match_id)
    .single();

  if (matchError || !match) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  // 2. check if the authenticated user is a participant
  const isCreator = match.creator_id === user_id;
  const isOpponent = match.opponent_id === user_id;

  if (!isCreator && !isOpponent) {
    return Response.json({ error: "Not in match" }, { status: 403 });
  }

  // 3. leaving ends the match
  const { error: updateError } = await supabaseAdmin
    .from("matches")
    .update({
      status: "cancelled",
      opponent_id: null,
    })
    .eq("id", match_id);

  if (updateError) {
    return Response.json({ error: "Failed to leave match" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
