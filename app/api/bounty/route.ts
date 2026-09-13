import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user_id = String(sessionUserId);
  const today = new Date().toISOString().split("T")[0];

  const { data: user, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select("user_id")
    .eq("user_id", user_id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!user) {
    const { error: insertError } = await supabaseAdmin.from("bounties").insert({
      user_id,
      username: session.user?.name ?? "unknown",
      bounty: 0,
      points: 100,
      last_login: today,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user_id = String(sessionUserId);

  const { data, error } = await supabaseAdmin
    .from("bounties")
    .select("bounty, points, username")
    .eq("user_id", user_id)
    .maybeSingle();

  return NextResponse.json({ data, error });
}
