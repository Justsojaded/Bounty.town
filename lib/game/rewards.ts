export function calculateMatchRewards({
  winnerLevel,
  loserLevel,
  bountyPool,
  mode,
}: {
  winnerLevel: number;
  loserLevel: number;
  bountyPool: number;
  mode: "pvp" | "solo";
}) {
  // ------------------------
  // XP SYSTEM (KEEP YOUR LOGIC)
  // ------------------------

  const winnerXP =
    50 + loserLevel * 8 + winnerLevel * 3;

  const loserXP =
    10 + loserLevel * 2;

  // ------------------------
  // BOUNTY SYSTEM (NEW)
  // ------------------------

  let winnerBounty = 0;
  let loserBounty = 0;

  if (mode === "pvp") {
    // 💰 PvP SPLIT SYSTEM
    winnerBounty = Math.floor(bountyPool * 0.8);
    loserBounty = Math.floor(bountyPool * 0.2);
  }

  if (mode === "solo") {
    // 🎲 SOLO RULES
    // creator either wins full pool or loses most of it

    const winChance = 0.7; // optional tuning hook later

    winnerBounty = Math.floor(bountyPool);
    loserBounty = Math.floor(bountyPool * 0.2);
  }

  return {
    winnerXP,
    loserXP,
    winnerBounty,
    loserBounty,
  };
}