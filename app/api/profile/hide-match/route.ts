import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const userId = session.user.id;

    const { match_id } = await req.json();

    if (!match_id) {
        return NextResponse.json(
            { error: "Missing match_id" },
            { status: 400 }
        );
    }

    // Make sure this user actually participated in the match
    const { data: match, error: matchError } = await supabaseAdmin
        .from("matches")
        .select("id, creator_id, opponent_id")
        .eq("id", match_id)
        .maybeSingle();

    if (matchError) {
        return NextResponse.json(
            { error: "Failed to find match" },
            { status: 500 }
        );
    }

    if (!match) {
        return NextResponse.json(
            { error: "Match not found" },
            { status: 404 }
        );
    }

    const isParticipant =
        match.creator_id === userId ||
        match.opponent_id === userId;

    if (!isParticipant) {
        return NextResponse.json(
            { error: "Not allowed" },
            { status: 403 }
        );
    }

    // Hide the match for this user
    const { error: insertError } = await supabaseAdmin
        .from("hidden_matches")
        .upsert(
            {
                user_id: userId,
                match_id,
            },
            {
                onConflict: "user_id,match_id",
            }
        );

    if (insertError) {
        return NextResponse.json(
            {
                error: "Failed to hide match",
                details: insertError.message,
            },
            { status: 500 }
        );
    }

    return NextResponse.json({ ok: true });
}