import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const state = crypto.randomUUID();
    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.TWITCH_BOT_CLIENT_ID!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/twitch/callback`,
        scope: "user:bot user:read:chat user:write:chat",
        state,
    });

    const response = NextResponse.redirect(
        `https://id.twitch.tv/oauth2/authorize?${params.toString()}`
    );

    response.cookies.set("twitch_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60,
    });

    return response;
}
