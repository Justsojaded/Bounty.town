import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  const { searchParams } = new URL(req.url);

  const page = Math.max(
    1,
    Number(searchParams.get("page")) || 1
  );

  const userId = session.user.id;
  const pageSize = 10;
  // Get profile information
  const { data: user, error: userError } = await supabaseAdmin
    .from("bounties")
    .select("username, points, bounty")
    .eq("user_id", userId)
    .maybeSingle();

  if (userError) {
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Get matches involving this user
  const { data: matches, error: matchesError } = await supabaseAdmin
    .from("matches")
    .select(
      "id, creator_id, opponent_id, status, winner_id, created_at, mode, bounty_pool, title"
    )
    .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
    .eq("status", "finished")
    .order("created_at", { ascending: false });

  if (matchesError) {
    return NextResponse.json(
      { error: "Failed to load match history" },
      { status: 500 }
    );
  }

  // Get matches this user has chosen to hide
  const { data: hiddenMatches, error: hiddenError } = await supabaseAdmin
    .from("hidden_matches")
    .select("match_id")
    .eq("user_id", userId);

  if (hiddenError) {
    return NextResponse.json(
      { error: "Failed to load hidden matches" },
      { status: 500 }
    );
  }

  const hiddenIds = new Set(
    (hiddenMatches ?? []).map((match) => match.match_id)
  );

  const visibleMatches = (matches ?? []).filter(
    (match) => !hiddenIds.has(match.id)
  );
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const paginatedMatches = visibleMatches.slice(start, end);

  const hasNextPage = end < visibleMatches.length;
  return NextResponse.json({
    username: user.username,
    points: user.points ?? 0,
    bounty: user.bounty ?? 0,
    matches: paginatedMatches,
    page,
    hasNextPage,
  });
}