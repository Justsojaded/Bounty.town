# 🏆 bounty.town

### A Twitch-focused matchmaking and virtual bounty app for streamers and their communities.

**Create matches. Place virtual bounty bets. Compete live.**

🌐 **Live site:** https://bounty.town

---

## 🎮 What is bounty.town?

bounty.town is an independent Twitch-focused web app built around community matches and virtual **bounty**.

Streamers and viewers can create or join matches, make predictions with virtual bounty, and follow the results through a simple matchmaking experience.

It also includes an **OBS-friendly overlay**, so active matches and results can be displayed directly on stream.

> 💡 Bounty is virtual in-app currency — there is no real-money wagering.

## ✨ Features

- 🎯 **PvP matches** — create and compete in player-vs-player matches
- 🎲 **Solo matches** — create prediction-style challenges
- 💰 **Virtual bounty** — use in-app bounty to vote on match outcomes
- 🏆 **Leaderboard** — see how you stack up against other users
- 📺 **OBS overlay** — display active matches and results on stream
- 👤 **User profiles** — view player profiles and match information
- ⚡ **Live match updates** — matches update automatically without requiring a page refresh
- 🎁 **Daily bounty bonus** — return each day to claim bonus virtual bounty

## 📺 OBS Overlay

Each user has a dedicated overlay page that can be added to OBS as a Browser Source.

From the app, use **Copy OBS Overlay Link** to quickly grab your personal overlay URL.

## 🛠️ Built With

- **Next.js** — application framework
- **TypeScript** — application language
- **Supabase** — database and realtime data
- **NextAuth** — Twitch authentication
- **Vercel** — deployment and hosting

## 🧪 Experimental / Learning Project

bounty.town is an experimental project and was originally built as hands-on ground work for learning **Next.js** and full-stack web development.

The code reflects an ongoing learning process, so some parts may be rough, unconventional, or subject to change. It is shared publicly so other developers — especially people who are learning — can explore it, experiment with it, fork it, and build their own ideas from it.

This project is not intended to be a demonstration of production-level architecture. It is a real project built while learning by doing.

## 🚀 Running Locally

Clone the repository and install dependencies:

```bash
git clone https://github.com/justsojaded/Bounty.Town.git
cd Bounty.town
npm install
```

## 🔐 Environment Variables

Create a file named `.env.local` in the root of the project.

### 🟣 Twitch Login

Create your own Twitch Developer application and copy its:

Client ID → `TWITCH_CLIENT_ID`

Client Secret → `TWITCH_CLIENT_SECRET`

### 🟢 Supabase

Create your own Supabase project.

From your Supabase project's API settings, copy:

Project URL → `NEXT_PUBLIC_SUPABASE_URL`

Supabase Public key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Service Role key → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ Keep your Service Role key private. Never commit it to GitHub.

### 🔑 NextAuth

For local development:

`NEXTAUTH_URL=http://localhost:3000`

Create a secure random value for `NEXTAUTH_SECRET`.

### 🤖 Twitch Bot

The Twitch bot is optional.

You only need the bot configuration if you want viewers to vote directly from Twitch chat using commands such as `!vote`.

The Twitch bot requires its own Twitch account and credentials.

Fill in:

`TWITCH_BOT_CHANNEL` → The Twitch channel the bot will join

`TWITCH_BOT_CLIENT_ID` → Bot Twitch application Client ID

`TWITCH_BOT_CLIENT_SECRET` → Bot Twitch application Client Secret

`TWITCH_BOT_ACCESS_TOKEN` → Bot account access token

`TWITCH_BOT_USER_ID` → Bot account's Twitch user ID

#### Configure the Twitch bot

Create a separate Twitch account for your bot and create a Twitch Developer application for it.

From the project directory, run:

```bash
twitch configure
```

Follow the prompts to authorize the bot's Twitch account. The configuration process will provide the credentials needed for the `.env.local` variables above.

Once your `.env.local` file is configured, start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

If you want to run the Twitch bot, start it with:

```bash
npm run bot
```

### ▲ Vercel Deployment

If you deploy bounty.town with Vercel, you also need to add your environment variables to your Vercel project.

In the Vercel dashboard, open your project and go to:

**Settings → Environment Variables**

These are the environment variables you may need to add to Vercel:

1. `TWITCH_BOT_CLIENT_SECRET` — Twitch bot application client secret
2. `TWITCH_BOT_CLIENT_ID` — Twitch bot application client ID
3. `TWITCH_CLIENT_SECRET` — Twitch application client secret
4. `NEXTAUTH_URL` — URL of your deployed bounty.town site
5. `TWITCH_CLIENT_ID` — Twitch application client ID
6. `NEXTAUTH_SECRET` — secure secret used by NextAuth
7. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable API key
8. `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
9. `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key

Add each variable to the Vercel environment(s) where your deployment needs it, such as **Production**, **Preview**, or **Development**.

After adding or changing environment variables, redeploy the project for the changes to take effect.

⚠️ Never expose or commit secret keys such as `SUPABASE_SERVICE_ROLE_KEY`, Twitch client secrets, or `NEXTAUTH_SECRET`.

## 🔐 Database Variables

Create a Supabase project.

Open SQL Editor.

Run the bounty.town database schema.

Run the SQL in `supabase/schema.sql` in your Supabase project's SQL Editor.

Enable RLS on the tables.

## 🌱 About the Project

bounty.town is an independent project built by **justsojaded** while learning app development.

The goal is simple: make a fun, lightweight Twitch community tool and keep improving it based on how people actually use it.

Feedback, ideas, and bug reports are welcome!

---

**Built with curiosity, caffeine, and probably too many bounty bets. ☕💰**
