import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import ProfileMatches from "@/components/ProfileMatches";
export default async function PublicProfile({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const { username } = await params;
    const session = await getServerSession(authOptions);
    const { data: user, error } = await supabaseAdmin
        .from("bounties")
        .select("user_id, username, points, bounty, avatar_url, twitch_id")
        .eq("username", username)
        .maybeSingle();
    const isOwnProfile = session?.user?.id === user?.user_id;
    if (error) {
        return <p>Something went wrong.</p>;
    }

    if (!user) {
        notFound();
    }
    const { data: matches, error: matchesError } = await supabaseAdmin
        .from("matches")
        .select(
            "id, creator_id, opponent_id, status, winner_id, created_at, mode, bounty_pool, title"
        )
        .or(`creator_id.eq.${user.user_id},opponent_id.eq.${user.user_id}`)
        .eq("status", "finished")
        .order("created_at", { ascending: false });
    const { data: hiddenMatches } = await supabaseAdmin
        .from("hidden_matches")
        .select("match_id")
        .eq("user_id", user.user_id);
    const hiddenIds = new Set(
        (hiddenMatches ?? []).map((match) => match.match_id)
    );

    const visibleMatches = (matches ?? []).filter(
        (match) => !hiddenIds.has(match.id)
    );
    return (
        <main className="min-h-screen p-6 flex flex-col items-center">
            <a
                href="/"
                style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    fontSize: 24,
                    color: "#555",
                    textDecoration: "none",
                    cursor: "pointer",
                }}
            >
                ✕
            </a>
            <div
                style={{
                    width: "100%",
                    maxWidth: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                }}
            >
                {user.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={`${user.username}'s avatar`}
                        className="h-16 w-16 rounded-full"
                    />
                ) : (
                    <div className="h-16 w-16 rounded-full border" />
                )}

                <div>
                    <h1 className="text-2xl font-bold">
                        {user.username}
                    </h1>

                    <p className="text-gray-500">
                        bounty.town profile
                    </p>
                    {isOwnProfile && (
                        <p className="text-green-500">
                            This is your profile!
                        </p>
                    )}
                    {isOwnProfile && (
                        user.twitch_id ? (
                            <div className="flex items-center gap-2 mt-3">
                                <span className="inline-block px-4 py-2 rounded bg-gray-400 text-white">
                                    🎮 Twitch Connected ✓
                                </span>

                                <form action="/api/twitch/disconnect" method="POST">
                                    <input
                                        type="hidden"
                                        name="redirect"
                                        value={`/${user.username}`}
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600"
                                        title="Disconnect Twitch"
                                    >
                                        ✕
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <a
                                href="/api/twitch/connect"
                                className="inline-block mt-3 px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700"
                            >
                                🎮 Connect Twitch Bot
                            </a>
                        )
                    )}
                </div>
            </div>

            <div
                style={{
                    width: "100%",
                    maxWidth: 600,
                    marginTop: 30,
                }}
            >
                <section>
                    <h2 className="text-xl font-semibold">
                        Balance
                    </h2>

                    <p className="mt-2">
                        Points: {user.points ?? 0}
                    </p>

                    <p>
                        Bounty: {user.bounty ?? 0}
                    </p>
                </section>

                <section className="mt-8">
                    <h2 className="text-xl font-semibold">
                        Past Bounties
                    </h2>

                    <ProfileMatches
                        matches={visibleMatches}
                        userId={user.user_id}
                        isOwnProfile={isOwnProfile}
                    />
                </section>
            </div>
        </main>
    );
}