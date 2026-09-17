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

-- Atomically place a website bounty vote.
-- Locks the match row so cancellation and voting cannot race each other.
create or replace function public.place_match_vote(
    p_match_id text,
    p_user_id text,
    p_vote text,
    p_bet_amount integer
)
returns json
language plpgsql
security definer
as $$
declare
    match_row public.matches%rowtype;
    current_bounty integer;
begin
    select *
    into match_row
    from public.matches
    where id = p_match_id
    for update;

    if not found then
        return json_build_object(
            'success', false,
            'error', 'Match not found'
        );
    end if;

    if match_row.status not in ('open', 'active', 'lobby', 'waiting') then
        return json_build_object(
            'success', false,
            'error', 'Voting is closed'
        );
    end if;

    if p_user_id = match_row.creator_id
       or (match_row.mode = 'pvp' and p_user_id = match_row.opponent_id) then
        return json_build_object(
            'success', false,
            'error', 'Players cannot vote on their own match'
        );
    end if;

    if exists (
        select 1
        from public.match_votes
        where match_id = p_match_id
          and user_id = p_user_id
    ) then
        return json_build_object(
            'success', false,
            'error', 'You already voted'
        );
    end if;

    select bounty
    into current_bounty
    from public.bounties
    where user_id = p_user_id
    for update;

    if not found then
        return json_build_object(
            'success', false,
            'error', 'User not found'
        );
    end if;

    if current_bounty < p_bet_amount then
        return json_build_object(
            'success', false,
            'error', 'Not enough bounty to vote'
        );
    end if;

    update public.bounties
    set bounty = current_bounty - p_bet_amount
    where user_id = p_user_id;

    update public.matches
    set bounty_pool = coalesce(match_row.bounty_pool, 0) + p_bet_amount,
        updated_at = now()
    where id = p_match_id;

    insert into public.match_votes (
        match_id,
        user_id,
        vote,
        updated_at,
        bet_amount
    )
    values (
        p_match_id,
        p_user_id,
        p_vote,
        now(),
        p_bet_amount
    );

    return json_build_object(
        'success', true
    );
end;
$$;

-- Atomically cancel a match.
-- Locks the match row and refuses cancellation once any vote exists.
create or replace function public.cancel_match(
    p_match_id text,
    p_user_id text
)
returns json
language plpgsql
security definer
as $$
declare
    match_row public.matches%rowtype;
    creator_bounty integer;
begin
    select *
    into match_row
    from public.matches
    where id = p_match_id
    for update;

    if not found then
        return json_build_object(
            'success', false,
            'error', 'Match not found'
        );
    end if;

    if match_row.creator_id <> p_user_id then
        return json_build_object(
            'success', false,
            'error', 'Only creator can cancel match'
        );
    end if;

    if match_row.status not in ('open', 'lobby', 'waiting') then
        return json_build_object(
            'success', false,
            'error', 'Match cannot be cancelled in current state'
        );
    end if;

    if exists (
        select 1
        from public.match_votes
        where match_id = p_match_id
    )
    or exists (
        select 1
        from public.twitch_votes
        where match_id = p_match_id
    ) then
        return json_build_object(
            'success', false,
            'error', 'Cannot cancel — votes already exist'
        );
    end if;

    if match_row.mode = 'pvp'
       and coalesce(match_row.bet_amount, 0) > 0 then

        select bounty
        into creator_bounty
        from public.bounties
        where user_id = match_row.creator_id
        for update;

        if not found then
            return json_build_object(
                'success', false,
                'error', 'Creator not found'
            );
        end if;

        update public.bounties
        set bounty = creator_bounty + match_row.bet_amount
        where user_id = match_row.creator_id;
    end if;

    update public.matches
    set status = 'cancelled',
        winner_id = null,
        updated_at = now()
    where id = p_match_id;

    return json_build_object(
        'success', true,
        'message', 'Match cancelled and refunds issued'
    );
end;
$$;
