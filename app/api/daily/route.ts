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

  // 1️⃣ GET USER
  let { data: user, error: userError } = await supabaseAdmin
    .from("bounties")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();

  // 2️⃣ AUTO CREATE USER IF MISSING
  if (!user) {
    const { error: insertError } = await supabaseAdmin.from("bounties").insert({
      user_id,
      username,
      bounty: 0,
      points: 0,
      last_login: null,
    });

    if (insertError) {
      return NextResponse.json({ error: "Failed to create user" });
    }

    // re-fetch user after creation
    const res = await supabaseAdmin
      .from("bounties")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    user = res.data;
  }

  let bountyAdded = 0;
  let unlocked: string[] = [];

  // 3️⃣ DAILY LOGIN
  if (user?.last_login !== today) {
    bountyAdded = 25;

    await supabaseAdmin
      .from("bounties")
      .update({
        bounty: (user.bounty || 0) + 25,
        last_login: today,
      })
      .eq("user_id", user_id);

    unlocked.push("daily_login");
  }

  // 4️⃣ ACHIEVEMENTS
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("achievements")
    .select("user_id")
    .eq("user_id", user_id)
    .eq("achievement_id", "first_login")
    .maybeSingle();

  if (!existing) {
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

  return NextResponse.json({ bountyAdded, unlocked });
}