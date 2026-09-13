import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");

  if (!match_id) {
    return Response.json({
      a: 0, b: 0,
      bountyA: 0, bountyB: 0,
      twitchA: 0, twitchB: 0,
      bountyVoters: 0,
      freeVoters: 0,
    });
  }

  const [{ data: bountyVotes }, { data: twitchVotes }] = await Promise.all([
    supabaseAdmin
      .from("match_votes")
      .select("vote" )
      .eq("match_id", String(match_id)),
    supabaseAdmin
      .from("twitch_votes")
      .select("vote, bet_amount")
      .eq("match_id", String(match_id)),
  ]);

  let bountyA = 0;
  let bountyB = 0;
  let twitchA = 0;
  let twitchB = 0;
  let freeVoters = 0;
  let paidTwitchVoters = 0;

  for (const v of bountyVotes || []) {
    if (v.vote === "A") bountyA++;
    if (v.vote === "B") bountyB++;
  }

  for (const v of twitchVotes || []) {
    if (v.vote === "A") twitchA++;
    if (v.vote === "B") twitchB++;

    if (Number(v.bet_amount ?? 0) > 0) {
      paidTwitchVoters++;
    } else {
      freeVoters++;
    }
  }

  return Response.json({
    a: bountyA + twitchA,
    b: bountyB + twitchB,
    bountyA,
    bountyB,
    twitchA,
    twitchB,
    // Website votes use bounty, and paid Twitch votes also use bounty.
    bountyVoters: (bountyVotes || []).length + paidTwitchVoters,
    freeVoters,
  });
}
