-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.bounties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  username text,
  bounty integer DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  points integer DEFAULT 0,
  last_login date,
  avatar_url text,
  twitch_id text,
  CONSTRAINT bounties_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  achievement_id text NOT NULL,
  unlocked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT achievements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.matches (
  id text NOT NULL,
  creator_id text NOT NULL,
  opponent_id text,
  status text DEFAULT 'open'::text,
  winner_id text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  last_activity_at timestamp without time zone,
  creator_last_seen timestamp without time zone,
  opponent_last_seen timestamp without time zone,
  mode text DEFAULT 'pvp'::text,
  correct_answer text,
  bounty_pool integer,
  title text,
  bet_amount integer NOT NULL DEFAULT 0,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.bounties(user_id),
  CONSTRAINT matches_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.bounties(user_id)
);
CREATE TABLE public.match_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  user_id text,
  vote text DEFAULT '-- "A" or "B"'::text,
  updated_at timestamp without time zone,
  bet_amount integer DEFAULT 0,
  CONSTRAINT match_votes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.hidden_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  match_id text,
  created_at timestamp with time zone,
  CONSTRAINT hidden_matches_pkey PRIMARY KEY (id)
);
CREATE TABLE public.twitch_connections (
  user_id text NOT NULL,
  twitch_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT twitch_connections_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.twitch_votes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  match_id text NOT NULL,
  twitch_user_id text NOT NULL,
  twitch_username text NOT NULL,
  vote text NOT NULL CHECK (vote = ANY (ARRAY['A'::text, 'B'::text])),
  bounty_user_id text,
  bet_amount integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT twitch_votes_pkey PRIMARY KEY (id),
  CONSTRAINT twitch_votes_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);