"use client";

import { createContext, useContext } from "react";

export const VoteContext = createContext<
  ((vote: "A" | "B") => void | Promise<void>) | null
>(null);

export function useVote() {
  return useContext(VoteContext);
}