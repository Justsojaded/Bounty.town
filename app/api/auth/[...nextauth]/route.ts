import { supabase } from "@/lib/supabase";
import NextAuth, { type NextAuthOptions } from "next-auth";
import TwitchProvider from "next-auth/providers/twitch";

export const authOptions: NextAuthOptions = {
  providers: [
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.userId = account.providerAccountId;

        await supabase.from("bounties").upsert({
          user_id: account.providerAccountId,
          username: profile?.name ?? "unknown",
          points: 0,
          bounty: 0,
        });
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };