import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
const CLIENT_ID = process.env.TWITCH_BOT_CLIENT_ID;
const ACCESS_TOKEN = process.env.TWITCH_BOT_ACCESS_TOKEN;
const BOT_USER_ID = process.env.TWITCH_BOT_USER_ID;
const CHANNEL = process.env.TWITCH_BOT_CHANNEL;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const THREE_MINUTES = 3 * 60 * 1000;

function getValidVoteTime(timestamp: string | null | undefined, now = Date.now()) {
  if (!timestamp) return null;

  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time) || time > now) return null;

  return time;
}

async function loadTwitchConnections() {
  const { data, error } = await supabase
    .from("twitch_connections")
    .select("user_id, twitch_id");

  if (error) {
    console.error("Failed to load Twitch connections:", error);
    return [];
  }

  console.log("Connected Twitch accounts:", data);

  return data ?? [];
}

async function getTwitchConnection(twitchId: string) {
  const { data, error } = await supabase
    .from("twitch_connections")
    .select("user_id, twitch_id")
    .eq("twitch_id", twitchId)
    .maybeSingle();

  if (error) {
    console.error("Failed to check Twitch connection:", error);
    return null;
  }

  return data;
}

async function getBountyUserByTwitchId(twitchId: string) {
  const { data, error } = await supabase
    .from("bounties")
    .select("user_id, twitch_id, bounty")
    .eq("twitch_id", twitchId)
    .maybeSingle();

  if (error) {
    console.error("Failed to find bounty user by Twitch ID:", error);
    return null;
  }

  return data;
}

async function getActiveMatchForChannel(broadcasterId: string) {
  const connection = await getTwitchConnection(broadcasterId);

  if (!connection) return null;

  const { data: match, error } = await supabase
    .from("matches")
    .select("id, status, mode, creator_id, opponent_id, bet_amount, bounty_pool")
    .or(`creator_id.eq.${connection.user_id},opponent_id.eq.${connection.user_id}`)
    .in("status", ["open", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to find active match:", error);
    return null;
  }

  return match;
}

if (!CLIENT_ID || !ACCESS_TOKEN || !BOT_USER_ID || !CHANNEL) {
  throw new Error(
    "Missing TWITCH_BOT_CLIENT_ID, TWITCH_BOT_ACCESS_TOKEN, TWITCH_BOT_USER_ID, or TWITCH_BOT_CHANNEL"
  );
}

const TWITCH_API = "https://api.twitch.tv/helix";
const EVENTSUB_WS = "wss://eventsub.wss.twitch.tv/ws";
const RECONCILE_INTERVAL = 30_000;

let socket: WebSocket | null = null;
let reconnecting = false;
let currentSessionId: string | null = null;

async function twitchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TWITCH_API}${path}`, {
    ...init,
    headers: {
      "Client-Id": CLIENT_ID!,
      Authorization: `Bearer ${ACCESS_TOKEN!}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitch API ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function getUser(login: string) {
  const result = await twitchApi<{
    data: Array<{ id: string; login: string; display_name: string }>;
  }>(`/users?login=${encodeURIComponent(login)}`);

  const user = result.data[0];
  if (!user) throw new Error(`Twitch user not found: ${login}`);
  return user;
}

async function getUsersByIds(twitchIds: string[]) {
  if (twitchIds.length === 0) return [];

  const params = twitchIds
    .map((id) => `id=${encodeURIComponent(id)}`)
    .join("&");

  const result = await twitchApi<{
    data: Array<{
      id: string;
      login: string;
      display_name: string;
    }>;
  }>(`/users?${params}`);

  return result.data;
}

async function sendChatMessage(broadcasterId: string, message: string) {
  const result = await twitchApi<{
    data: Array<{
      message_id: string;
      is_sent: boolean;
      drop_reason?: {
        code: string;
        message: string;
      };
    }>;
  }>("/chat/messages", {
    method: "POST",
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id: BOT_USER_ID,
      message,
    }),
  });

  console.log(
    "Twitch chat send result:",
    JSON.stringify(result, null, 2)
  );
  console.log(`→ ${message}`);
}

async function subscribeToChat(
  sessionId: string,
  broadcasterId: string,
  channelLogin: string
) {
  await twitchApi("/eventsub/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: broadcasterId,
        user_id: BOT_USER_ID,
      },
      transport: {
        method: "websocket",
        session_id: sessionId,
      },
    }),
  });

  console.log(`Subscribed to ${channelLogin}'s chat`);
}

async function getChatSubscriptions() {
  const result = await twitchApi<{
    data: Array<{
      id: string;
      type: string;
      status: string;
      condition: {
        broadcaster_user_id: string;
        user_id?: string;
      };
      transport: {
        session_id?: string;
      };
    }>;
  }>(
    `/eventsub/subscriptions?user_id=${encodeURIComponent(BOT_USER_ID!)}`
  );

  return result.data;
}

async function unsubscribeFromSubscription(subscriptionId: string) {
  await twitchApi(
    `/eventsub/subscriptions?id=${encodeURIComponent(subscriptionId)}`,
    {
      method: "DELETE",
    }
  );
}

async function reconcileTwitchSubscriptions() {
  if (!currentSessionId) return;

  try {
    const connections = await loadTwitchConnections();
    const connectedIds = new Set(
      connections.map((connection) => connection.twitch_id)
    );

    const subscriptions = await getChatSubscriptions();

    const activeSubscriptions = subscriptions.filter(
      (subscription) =>
        subscription.type === "channel.chat.message" &&
        subscription.status === "enabled"
    );

    const subscribedIds = new Set<string>();

    for (const subscription of activeSubscriptions) {
      const broadcasterId = subscription.condition.broadcaster_user_id;
      subscribedIds.add(broadcasterId);

      if (!connectedIds.has(broadcasterId)) {
        await unsubscribeFromSubscription(subscription.id);
        console.log(
          `Reconciled disconnected Twitch channel: ${broadcasterId}`
        );
      }
    }

    const missingIds = [...connectedIds].filter(
      (twitchId) => !subscribedIds.has(twitchId)
    );

    if (missingIds.length > 0) {
      const broadcasters = await getUsersByIds(missingIds);

      for (const broadcaster of broadcasters) {
        await subscribeToChat(
          currentSessionId,
          broadcaster.id,
          broadcaster.login
        );
      }
    }
  } catch (error) {
    console.error("Twitch subscription reconciliation error:", error);
  }
}

async function handleChatMessage(notification: any) {
  const event = notification.payload.event;
  const connection = await getTwitchConnection(event.broadcaster_user_id);

  if (!connection) {
    console.log(
      `Ignoring message from disconnected channel: ${event.broadcaster_user_name}`
    );
    return;
  }

  const text = event.message.text.trim();

  console.log(`<${event.chatter_user_name}> ${text}`);

  if (text.toLowerCase() === "!hello") {
    await sendChatMessage(
      event.broadcaster_user_id,
      "🐈‍⬛ meow! bounty.town bot online :3"
    );
    return;
  }

  if (text.toLowerCase() === "!bounty") {
    const bountyUser = await getBountyUserByTwitchId(
      event.chatter_user_id
    );

    if (!bountyUser) {
      await sendChatMessage(
        event.broadcaster_user_id,
        `🐈‍⬛ @${event.chatter_user_name}, you don't have a bounty.town account linked yet!`
      );
      return;
    }

    await sendChatMessage(
      event.broadcaster_user_id,
      `🐈‍⬛ @${event.chatter_user_name}, you have ${bountyUser.bounty} bounty!`
    );
    return;
  }

  const voteMatch = text.match(/^!vote\s+([ab])$/i);

  if (voteMatch) {
    const vote = voteMatch[1].toUpperCase();

    const match = await getActiveMatchForChannel(
      event.broadcaster_user_id
    );

    if (!match) {
      await sendChatMessage(
        event.broadcaster_user_id,
        `🐈‍⬛ @${event.chatter_user_name}, there isn't an active match right now!`
      );
      return;
    }

    const bountyUser = await getBountyUserByTwitchId(
      event.chatter_user_id
    );

    const isParticipant =
      bountyUser?.user_id === match.creator_id ||
      bountyUser?.user_id === match.opponent_id;

    if (isParticipant) {
      await sendChatMessage(
        event.broadcaster_user_id,
        `🐈‍⬛ @${event.chatter_user_name}, players can't vote on their own match!`
      );
      return;
    }

    const linkedUserId = connection?.user_id ?? bountyUser?.user_id;

    const { data: existingWebsiteVote, error: websiteVoteError } = linkedUserId
      ? await supabase
        .from("match_votes")
        .select("vote, updated_at")
        .eq("match_id", match.id)
        .eq("user_id", linkedUserId)
        .maybeSingle()
      : { data: null, error: null };

    if (websiteVoteError) {
      console.error("Failed to check website vote:", websiteVoteError);
      return;
    }

    const { data: existingVote, error: existingError } = await supabase
      .from("twitch_votes")
      .select("id, vote, updated_at, bet_amount")
      .eq("match_id", match.id)
      .eq("twitch_user_id", event.chatter_user_id)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to check Twitch vote:", existingError);
      return;
    }

    // 🎲 A prediction is locked after the first vote.
    if (existingWebsiteVote || existingVote) {
      const currentVote = existingWebsiteVote?.vote ?? existingVote?.vote;

      await sendChatMessage(
        event.broadcaster_user_id,
        `🐈‍⬛ @${event.chatter_user_name}, you already voted ${currentVote}!`
      );
      return;
    }

    const betAmount = Number(match.bet_amount ?? match.bounty_pool ?? 0);
    let paidAmount = 0;

    if (!existingVote && bountyUser && betAmount > 0 && bountyUser.bounty >= betAmount) {
      const { data: updatedBounty, error: bountyError } = await supabase
        .from("bounties")
        .update({
          bounty: bountyUser.bounty - betAmount,
        })
        .eq("user_id", bountyUser.user_id)
        .gte("bounty", betAmount)
        .select("user_id, bounty")
        .maybeSingle();

      if (bountyError) {
        console.error("Failed to deduct Twitch vote bounty:", bountyError);
        return;
      }

      if (updatedBounty) {
        const { error: poolError } = await supabase
          .from("matches")
          .update({
            bounty_pool: (match.bounty_pool || 0) + betAmount,
          })
          .eq("id", match.id);

        if (poolError) {
          console.error("Failed to add Twitch vote bounty to pool:", poolError);

          await supabase
            .from("bounties")
            .update({ bounty: bountyUser.bounty })
            .eq("user_id", bountyUser.user_id);

          return;
        }

        paidAmount = betAmount;
      }
    }

    const voteTimestamp = new Date().toISOString();

    const { error: voteError } = await supabase
      .from("twitch_votes")
      .upsert(
        {
          match_id: match.id,
          twitch_user_id: event.chatter_user_id,
          twitch_username: event.chatter_user_name,
          vote,
          bounty_user_id: bountyUser?.user_id ?? null,
          bet_amount: paidAmount,
          updated_at: voteTimestamp,
        },
        {
          onConflict: "match_id,twitch_user_id",
        }
      );

    if (voteError) {
      console.error("Failed to save Twitch vote:", voteError);
      return;
    }

    if (paidAmount > 0) {
      await sendChatMessage(
        event.broadcaster_user_id,
        `🐈‍⬛ @${event.chatter_user_name} voted ${vote} and spent ${paidAmount} bounty!`
      );
    } else {
      await sendChatMessage(
        event.broadcaster_user_id,
        `🐈‍⬛ @${event.chatter_user_name} voted ${vote}!`
      );
    }

    return;
  }
}

function connect(url = EVENTSUB_WS) {
  if (reconnecting) return;

  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    console.log("Connected to Twitch EventSub WebSocket");
  });

  socket.addEventListener("message", async (message) => {
    try {
      const data = JSON.parse(String(message.data));
      const type = data.metadata?.message_type;

      if (type === "session_welcome") {
        currentSessionId = data.payload.session.id;
        await reconcileTwitchSubscriptions();
        return;
      }

      if (
        type === "notification" &&
        data.payload?.subscription?.type === "channel.chat.message"
      ) {
        await handleChatMessage(data);
        return;
      }

      if (type === "session_reconnect") {
        const reconnectUrl = data.payload.session.reconnect_url;
        reconnecting = true;
        socket?.close();
        connect(reconnectUrl);
        reconnecting = false;
      }
    } catch (error) {
      console.error("Twitch message handling error:", error);
    }
  });

  socket.addEventListener("close", () => {
    currentSessionId = null;

    if (reconnecting) return;

    console.log("Twitch connection closed; reconnecting in 5 seconds...");
    setTimeout(() => connect(), 5000);
  });

  socket.addEventListener("error", (error) => {
    console.error("Twitch WebSocket error:", error);
  });
}

(async () => {
  const broadcaster = await getUser(CHANNEL!);

  console.log("Starting bounty.town Twitch bot...");
  await loadTwitchConnections();
  console.log(`Bot user ID: ${BOT_USER_ID}`);
  console.log(`Channel: ${broadcaster.login} (${broadcaster.id})`);

  connect();

  setInterval(reconcileTwitchSubscriptions, RECONCILE_INTERVAL);
})();
