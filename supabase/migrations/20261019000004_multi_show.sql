-- Multiple shows: seasons name their show, contestants can be teamless, and
-- show-specific results (murdered, shield, traitor...) live in an `events` column.
-- Additive: Hell's Kitchen keeps working unchanged. Run after the earlier files. Safe to run again.

alter table public.seasons add column if not exists show_key text not null default 'hells-kitchen';

alter table public.contestants alter column team drop not null;
alter table public.contestants drop constraint if exists contestants_team_check;
alter table public.contestants add constraint contestants_team_check check (team is null or team in ('red', 'blue'));

alter table public.episodes add column if not exists events jsonb not null default '{}'::jsonb;
alter table public.league_results add column if not exists events jsonb not null default '{}'::jsonb;

-- Who has left the game: sent home or banished (eliminated), quit, or murdered (The Traitors).
create or replace function public.left_game(p_contestant text, p_eliminated text[], p_quit text[], p_events jsonb)
returns boolean language sql immutable set search_path = public as $$
  select p_contestant = any (p_eliminated) or p_contestant = any (p_quit)
    or coalesce(p_events -> 'murdered', '[]'::jsonb) ? p_contestant;
$$;

create or replace function public.contestant_out(p_season text, p_contestant text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.episodes
    where season_id = p_season and posted and left_game(p_contestant, eliminated, quit, events)
  );
$$;

create or replace function public.contestant_out_in_league(p_league uuid, p_contestant text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from league_results r
    where r.league_id = p_league and r.posted and left_game(p_contestant, r.eliminated, r.quit, r.events)
  ) or exists (
    select 1 from episodes e join leagues l on l.season_id = e.season_id
    where l.id = p_league and e.posted
      and not exists (select 1 from league_results r where r.league_id = p_league and r.num = e.num)
      and left_game(p_contestant, e.eliminated, e.quit, e.events)
  );
$$;

-- Same functions as before, with wording that fits every show.
create or replace function public.draft_pick(p_league uuid, p_contestant text, p_member uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  l leagues;
  v_target uuid;
  v_k int;
  v_n int;
  v_round int;
  v_pos int;
  v_turn uuid;
begin
  select * into l from leagues where id = p_league for update;
  if not found then raise exception 'League not found.'; end if;
  v_target := resolve_member(p_league, p_member);
  if l.draft_status <> 'open' then raise exception 'The draft isn''t open.'; end if;
  if not exists (select 1 from contestants where season_id = l.season_id and id = p_contestant) then
    raise exception 'Unknown contestant.';
  end if;
  if contestant_out_in_league(p_league, p_contestant) then raise exception 'That contestant is already out.'; end if;
  if exists (select 1 from picks where member_id = v_target and contestant_id = p_contestant) then
    raise exception 'That contestant is already on this team.';
  end if;

  select count(*) into v_k from picks where league_id = p_league;

  if l.mode = 'snake' then
    v_n := coalesce(array_length(l.draft_order, 1), 0);
    if v_n = 0 then raise exception 'The draft order hasn''t been set.'; end if;
    if v_k >= v_n * l.roster_size then raise exception 'The draft is complete.'; end if;
    v_round := v_k / v_n;
    v_pos := v_k % v_n;
    v_turn := case when v_round % 2 = 0 then l.draft_order[v_pos + 1] else l.draft_order[v_n - v_pos] end;
    if v_turn is distinct from v_target then raise exception 'It''s not this team''s turn.'; end if;
    if exists (select 1 from picks where league_id = p_league and contestant_id = p_contestant) then
      raise exception 'That contestant has already been drafted.';
    end if;
  else
    if (select count(*) from picks where member_id = v_target) >= l.roster_size then
      raise exception 'This team already has % picks.', l.roster_size;
    end if;
  end if;

  insert into picks (league_id, member_id, contestant_id, pick_no)
  values (p_league, v_target, p_contestant,
    coalesce((select max(pick_no) from picks where league_id = p_league), -1) + 1);
end $$;

create or replace function public.set_guess(p_league uuid, p_episode int, p_contestant text, p_member uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  l leagues;
  e episodes;
  v_target uuid;
begin
  select * into l from leagues where id = p_league;
  if not found then raise exception 'League not found.'; end if;
  v_target := resolve_member(p_league, p_member);
  select * into e from episodes where season_id = l.season_id and num = p_episode;
  if not found then raise exception 'That episode isn''t on the schedule yet.'; end if;
  if e.posted or (e.air_at is not null and e.air_at <= now())
     or exists (select 1 from league_results r where r.league_id = p_league and r.num = p_episode and r.posted) then
    raise exception 'Guesses for episode % are locked.', p_episode;
  end if;
  if p_contestant is null then
    delete from guesses where member_id = v_target and episode_num = p_episode;
    return;
  end if;
  if contestant_out_in_league(p_league, p_contestant) then raise exception 'That contestant is already out.'; end if;
  insert into guesses (league_id, member_id, episode_num, contestant_id)
  values (p_league, v_target, p_episode, p_contestant)
  on conflict (member_id, episode_num) do update set contestant_id = excluded.contestant_id, updated_at = now();
end $$;

create or replace function public.set_winner_pick(p_league uuid, p_contestant text, p_member uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  l leagues;
  v_target uuid;
begin
  select * into l from leagues where id = p_league;
  if not found then raise exception 'League not found.'; end if;
  v_target := resolve_member(p_league, p_member);
  if exists (
    select 1 from episodes where season_id = l.season_id and num >= l.start_episode
      and (posted or (air_at is not null and air_at <= now()))
  ) or exists (select 1 from league_results where league_id = p_league and num >= l.start_episode and posted) then
    raise exception 'Winner picks locked when scoring started.';
  end if;
  if p_contestant is not null and contestant_out_in_league(p_league, p_contestant) then
    raise exception 'That contestant is already out.';
  end if;
  update league_members set winner_pick = p_contestant where id = v_target;
end $$;

revoke execute on function public.left_game(text, text[], text[], jsonb) from public, anon;
grant execute on function public.left_game(text, text[], text[], jsonb) to authenticated;
