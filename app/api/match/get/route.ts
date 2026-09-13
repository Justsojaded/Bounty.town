import { supabaseAdmin } from "@/lib/supabaseAdmin";

const EXPIRE_MINUTES = 10;

function isExpired(match: any) {
  const createdTime = new Date(match.created_at).getTime();
  const now = Date.now();
  return now - createdTime > EXPIRE_MINUTES * 60 * 1000;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const { data: match, error } = await supabaseAdmin
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();

  if (!match || error) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // 👇 fetch creator
  const { data: creator } = await supabaseAdmin
    .from("bounties")
    .select("username")
    .eq("user_id", match.creator_id)
    .single();

  // 👇 fetch opponent (if exists)
  let opponent = null;

  if (match.opponent_id) {
    const { data } = await supabaseAdmin
      .from("bounties")
      .select("username")
      .eq("user_id", match.opponent_id)
      .single();

    opponent = data;
  }

  // 🧠 expire logic
  if (match.status === "open" && isExpired(match)) {
    await supabaseAdmin
      .from("matches")
      .update({ status: "cancelled" })
      .eq("id", match.id);

    return Response.json({
      data: {
        ...match,
        status: "cancelled",
        creator,
        opponent,
      },
    });
  }

  // ✅ ALWAYS include creator + opponent
  return Response.json({
    data: {
      ...match,
      creator,
      opponent,
    },
  });
}