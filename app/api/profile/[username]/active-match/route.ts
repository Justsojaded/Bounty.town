import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // Find the user by username
  const { data: user, error: userError } = await supabaseAdmin
    .from("bounties")
    .select("user_id, username")
    .eq("username", username)
    .maybeSingle();

  if (userError) {
    return NextResponse.json(
      { error: "Failed to find user" },
      { status: 500 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Find their active match
  // Find their active match first
  const { data: activeMatch, error: activeMatchError } = await supabaseAdmin
    .from("matches")
    .select(`
      *,
      creator:bounties!matches_creator_id_fkey (
        username
      ),
      opponent:bounties!matches_opponent_id_fkey (
        username
      )
    `)
    .or(`creator_id.eq.${user.user_id},opponent_id.eq.${user.user_id}`)
    .in("status", ["active", "open", "lobby", "waiting"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeMatchError) {
    return NextResponse.json(
      {
        error: "Failed to find active match",
        details: activeMatchError.message,
        code: activeMatchError.code,
      },
      { status: 500 }
    );
  }

  // If there is an active match, return it.
  if (activeMatch) {
    return NextResponse.json({
      match: activeMatch,
    });
  }

  // Otherwise, look for the most recently finished match.
  const { data: finishedMatch, error: finishedMatchError } =
    await supabaseAdmin
      .from("matches")
      .select(`
        *,
        creator:bounties!matches_creator_id_fkey (
          username
        ),
        opponent:bounties!matches_opponent_id_fkey (
          username
        )
      `)
      .or(`creator_id.eq.${user.user_id},opponent_id.eq.${user.user_id}`)
      .eq("status", "finished")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (finishedMatchError) {
    return NextResponse.json(
      {
        error: "Failed to find finished match",
        details: finishedMatchError.message,
        code: finishedMatchError.code,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    match: finishedMatch ?? null,
  });
}