import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("bounties")
    .select("user_id, username, points, bounty")
    .order("points", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json(
      { data: [], error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}