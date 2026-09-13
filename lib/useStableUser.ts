"use client";

import { useSession } from "next-auth/react";

export function useStableUser() {
  const { data: session, status } = useSession();

  return {
    userId: session?.user?.id ?? null,
    username: session?.user?.name ?? null,
    isLoading: status === "loading",
    isLoggedIn: !!session,
  };
}