import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    const formData = await request.formData();
    const redirectPath =
        formData.get("redirect")?.toString() || "/";

    // Get the saved Twitch access token
    const { data: connection } = await supabaseAdmin
        .from("twitch_connections")
        .select("access_token")
        .eq("user_id", session.user.id)
        .maybeSingle();

    // Revoke the Twitch authorization
    if (connection?.access_token) {
        const revokeResponse = await fetch(
            "https://id.twitch.tv/oauth2/revoke",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id:
                        process.env.TWITCH_BOT_CLIENT_ID!,
                    token: connection.access_token,
                }),
            }
        );

        if (!revokeResponse.ok) {
            console.error(
                "Failed to revoke Twitch token:",
                await revokeResponse.text()
            );
        }
    }

    // Remove saved Twitch credentials
    const { error: connectionError } = await supabaseAdmin
        .from("twitch_connections")
        .delete()
        .eq("user_id", session.user.id);

    if (connectionError) {
        console.error(
            "Failed to delete Twitch connection:",
            connectionError
        );

        return NextResponse.json(
            { error: "Could not disconnect Twitch" },
            { status: 500 }
        );
    }

    // Clear the Twitch ID from the profile
    const { error: bountyError } = await supabaseAdmin
        .from("bounties")
        .update({ twitch_id: null })
        .eq("user_id", session.user.id);

    if (bountyError) {
        console.error(
            "Failed to clear Twitch ID:",
            bountyError
        );

        return NextResponse.json(
            { error: "Could not clear Twitch connection" },
            { status: 500 }
        );
    }

    return NextResponse.redirect(
        new URL(redirectPath, request.url)
    );
}