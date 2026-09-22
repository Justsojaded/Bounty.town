import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user_id = session.user.id;
  const username = session.user.name ?? "unknown";
  const today = new Date().toISOString().split("T")[0];

  // Fetch the user and first-login achievement at the same time.
  // This avoids making the achievement lookup wait for the user lookup.
  const [userResult, achievementResult] = await Promise.all([
    supabaseAdmin
      .from("bounties")
      .select("user_id, bounty, last_login")
      .eq("user_id", user_id)
      .maybeSingle(),
    supabaseAdmin
      .from("achievements")
      .select("user_id")
      .eq("user_id", user_id)
      .eq("achievement_id", "first_login")
      .maybeSingle(),
  ]);

  if (userResult.error) {
    return NextResponse.json(
      { error: userResult.error.message },
      { status: 500 }
    );
  }

  let user = userResult.data;
  let bountyAdded = 0;
  const unlocked: string[] = [];

  // Create a missing user and award today's login bonus in one write.
  if (!user) {
    bountyAdded = 25;

    const { data: createdUser, error: insertError } = await supabaseAdmin
      .from("bounties")
      .insert({
        user_id,
        username,
        bounty: 25,
        points: 0,
        last_login: today,
      })
      .select("user_id, bounty, last_login")
      .single();

    if (insertError || !createdUser) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create user" },
        { status: 500 }
      );
    }

    user = createdUser;
  } else if (user.last_login !== today) {
    bountyAdded = 25;

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("bounties")
      .update({
        bounty: (user.bounty || 0) + 25,
        last_login: today,
      })
      .eq("user_id", user_id)
      .select("user_id, bounty, last_login")
      .single();

    if (updateError || !updatedUser) {
      return NextResponse.json(
        { error: updateError?.message ?? "Failed to update daily reward" },
        { status: 500 }
      );
    }

    user = updatedUser;
  }

  // Keep the first-login achievement, but don't let its lookup delay the
  // user lookup. The achievement table currently has no unique constraint,
  // so keep the existing check-then-insert behavior.
  if (achievementResult.error) {
    return NextResponse.json(
      { error: achievementResult.error.message },
      { status: 500 }
    );
  }

  if (!achievementResult.data) {
    const { error: insertError } = await supabaseAdmin
      .from("achievements")
      .insert({
        user_id,
        achievement_id: "first_login",
        unlocked_at: new Date().toISOString(),
      });

    if (!insertError) {
      unlocked.push("first_login");
    }
  }

  if (bountyAdded > 0) {
    unlocked.push("daily_login");
  }

  return NextResponse.json({ bountyAdded, unlocked });
}
