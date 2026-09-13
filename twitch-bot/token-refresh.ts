import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const CLIENT_ID = process.env.TWITCH_BOT_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_BOT_CLIENT_SECRET;
const BOT_USER_ID = process.env.TWITCH_BOT_USER_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !BOT_USER_ID) {
  throw new Error(
    "Missing TWITCH_BOT_CLIENT_ID, TWITCH_BOT_CLIENT_SECRET, or TWITCH_BOT_USER_ID"
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TWITCH_API = "https://api.twitch.tv/helix";
const TWITCH_VALIDATE = "https://id.twitch.tv/oauth2/validate";
const TWITCH_TOKEN = "https://id.twitch.tv/oauth2/token";
const VALIDATE_INTERVAL = 60 * 60 * 1000;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshingToken: Promise<void> | null = null;

function syncTokenToEnvironment() {
  if (accessToken) {
    // The existing bot file reads this once at import time.
    // Keep it populated with the current DB-backed token without changing that file.
    process.env.TWITCH_BOT_ACCESS_TOKEN = accessToken;
  }
}

async function loadBotTokens() {
  const { data, error } = await supabase
    .from("twitch_connections")
    .select("twitch_id, access_token, refresh_token")
    .eq("twitch_id", BOT_USER_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load bot Twitch connection: ${error.message}`);
  }

  if (!data?.access_token || !data?.refresh_token) {
    throw new Error(
      `No access/refresh token pair found for Twitch bot user ${BOT_USER_ID}. Reconnect the bot account on bounty.town first.`
    );
  }

  accessToken = data.access_token;
  refreshToken = data.refresh_token;
  syncTokenToEnvironment();
}

async function saveBotTokens() {
  const { error } = await supabase
    .from("twitch_connections")
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    .eq("twitch_id", BOT_USER_ID);

  if (error) {
    throw new Error(`Failed to save refreshed Twitch tokens: ${error.message}`);
  }
}

async function refreshBotToken() {
  if (refreshingToken) return refreshingToken;

  refreshingToken = (async () => {
    if (!refreshToken) {
      throw new Error("No Twitch refresh token is available for the bot.");
    }

    const response = await fetch(TWITCH_TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const tokens = await response.json();

    if (!response.ok || !tokens.access_token) {
      throw new Error(
        `Twitch token refresh failed (${response.status}): ${JSON.stringify(tokens)}`
      );
    }

    accessToken = tokens.access_token;

    // Twitch can rotate refresh tokens. Always keep the newest one when supplied.
    if (tokens.refresh_token) {
      refreshToken = tokens.refresh_token;
    }

    syncTokenToEnvironment();
    await saveBotTokens();

    console.log("🐈‍⬛ Twitch bot access token refreshed and saved.");
  })();

  try {
    await refreshingToken;
  } finally {
    refreshingToken = null;
  }
}

async function validateBotToken() {
  if (!accessToken) {
    throw new Error("No Twitch bot access token is loaded.");
  }

  const response = await fetch(TWITCH_VALIDATE, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.ok) {
    const tokenInfo = await response.json();

    if (tokenInfo.user_id && tokenInfo.user_id !== BOT_USER_ID) {
      throw new Error(
        `Twitch bot token belongs to user ${tokenInfo.user_id}, expected ${BOT_USER_ID}.`
      );
    }

    console.log(
      `🐈‍⬛ Twitch bot token valid (${tokenInfo.expires_in}s remaining).`
    );
    return;
  }

  if (response.status === 401) {
    console.log("🐈‍⬛ Twitch bot token is invalid/expired; refreshing...");
    await refreshBotToken();
    return;
  }

  const body = await response.text();
  throw new Error(`Twitch token validation failed (${response.status}): ${body}`);
}

const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (!url.startsWith(TWITCH_API)) {
    return originalFetch(input, init);
  }

  if (!accessToken) {
    await loadBotTokens();
  }

  const makeRequest = () => {
    const headers = new Headers(init?.headers);
    headers.set("Client-Id", CLIENT_ID!);
    headers.set("Authorization", `Bearer ${accessToken!}`);

    return originalFetch(input, {
      ...init,
      headers,
    });
  };

  let response = await makeRequest();

  // Twitch recommends reacting to 401s rather than relying only on expiry timers.
  if (response.status === 401) {
    await refreshBotToken();
    response = await makeRequest();
  }

  return response;
};

async function main() {
  await loadBotTokens();
  await validateBotToken();

  setInterval(async () => {
    try {
      await validateBotToken();
    } catch (error) {
      console.error("Twitch bot token validation error:", error);
    }
  }, VALIDATE_INTERVAL);

  console.log("🐈‍⬛ Twitch token manager ready.");

  // Import the existing bot only after the token manager is initialized.
  await import("./index");
}

main().catch((error) => {
  console.error("🐈‍⬛ Twitch token manager failed to start:", error);
  process.exit(1);
});
