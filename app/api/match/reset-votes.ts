import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { match_id } = await req.json();

  const { error } = await supabaseAdmin
    .from("match_votes")
    .delete()
    .eq("match_id", match_id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ success: true });
}