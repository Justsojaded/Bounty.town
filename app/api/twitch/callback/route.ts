import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const storedState = request.headers
        .get("cookie")
        ?.match(/(?:^|;\s*)twitch_oauth_state=([^;]*)/)?.[1];

    if (!code) {
        return NextResponse.json(
            { error: "Missing Twitch authorization code" },
            { status: 400 }
        );
    }

    if (!state || !storedState || state !== decodeURIComponent(storedState)) {
        return NextResponse.json(
            { error: "Invalid Twitch authorization state" },
            { status: 403 }
        );
    }

    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: process.env.TWITCH_BOT_CLIENT_ID!,
            client_secret: process.env.TWITCH_BOT_CLIENT_SECRET!,
            code,
            grant_type: "authorization_code",
            redirect_uri: `${process.env.NEXTAUTH_URL}/api/twitch/callback`,
        }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
        console.error("Twitch token exchange failed:", tokens);

        return NextResponse.json(
            { error: "Twitch authorization failed" },
            { status: 400 }
        );
    }

    const twitchUserResponse = await fetch(
        "https://api.twitch.tv/helix/users",
        {
            headers: {
                "Client-ID": process.env.TWITCH_BOT_CLIENT_ID!,
                Authorization: `Bearer ${tokens.access_token}`,
            },
        }
    );

    const twitchUserData = await twitchUserResponse.json();
    const twitchUserId = twitchUserData.data?.[0]?.id;

    if (!twitchUserId) {
        return NextResponse.json(
            { error: "Could not determine Twitch user" },
            { status: 400 }
        );
    }

    const { error } = await supabaseAdmin
        .from("bounties")
        .update({ twitch_id: twitchUserId })
        .eq("user_id", session.user.id);

    if (error) {
        console.error("Failed to save Twitch ID:", error);

        return NextResponse.json(
            { error: "Could not save Twitch connection" },
            { status: 500 }
        );
    }

    const { error: connectionError } = await supabaseAdmin
        .from("twitch_connections")
        .upsert({
            user_id: session.user.id,
            twitch_id: twitchUserId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
        });

    if (connectionError) {
        console.error("Failed to save Twitch connection:", connectionError);

        return NextResponse.json(
            { error: "Could not save Twitch connection" },
            { status: 500 }
        );
    }

    console.log(
        `Twitch account ${twitchUserId} connected to bounty.town user ${session.user.id}`
    );

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("twitch_oauth_state", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    return response;
}
