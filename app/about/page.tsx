"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <main
      style={{
        maxWidth: 700,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "Arial",
        lineHeight: 1.6,
      }}
    >
      <h1>About This Project</h1>

      <p>
        This is a small experimental app built to explore competitive
        matchmaking, progression systems, and gamified rewards.
      </p>

      <h2>🤖 AI-Assisted Development</h2>

      <p>
        This project was built with the help of AI-assisted coding tools,
        including ChatGPT. AI was used for:
      </p>

      <ul>
        <li>Generating and iterating on code faster</li>
        <li>Debugging logic and backend flow</li>
        <li>Designing match and XP systems</li>
        <li>Helping structure API routes and database logic</li>
      </ul>

      <p>
        All final decisions, structure, and direction of the project are
        guided by the developer.
      </p>

      <h2>🎮 What This App Is</h2>

      <p>
        The goal is to create a lightweight competitive system where users can:
      </p>

      <ul>
        <li>Create and join matches</li>
        <li>Compete for rewards and XP</li>
        <li>Level up over time</li>
        <li>Climb a leaderboard system</li>
      </ul>

      <h2>🚧 Current Status</h2>

      <p>
        This project is currently in <b>v0.0.1</b>. Features may change,
        break, or evolve rapidly as the system is improved. check out the github repo for the latest updates and progress.
      </p>

      <h2>🚀 Future Goals</h2>

      <ul>
        <li>Anti-cheat / validation improvements (eventually)</li>
        <li>Ranked competitive tiers</li>
        <li>Cosmetics or profile customization</li>
        <li>Reward systems tied to performance</li>
        <li>Mobile-friendly experience</li>
        <li>Optional monetization (donations / support features)</li>
      </ul>

      <hr style={{ margin: "30px 0" }} />

      <Link href="/" style={{ color: "blue" }}>
        ← Back to app
      </Link>
    </main>
  );
}