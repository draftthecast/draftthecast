-- League-level results: each league's commissioner can enter or correct
-- episode results for their own league. A league's entry for an episode
-- takes priority over the site-wide results for that episode; deleting it
-- falls back to the site-wide results. Site admins can edit any league's.
-- Run in the Supabase SQL editor after the earlier files. Safe to run again.

create table if not exists public.league_results (
  league_id uuid not null references public.leagues on delete cascade,
  num int not null check (num > 0),
  posted boolean not null default true,
  challenge_win text check (challenge_win in ('red', 'blue', 'both')),
  service_win text check (service_win in ('red', 'blue', 'both')),
  mvp text[] not null default '{}',
  nominated text[] not null default '{}',
  ejected text[] not null default '{}',
  eliminated text[] not null default '{}',
  quit text[] not null default '{}',
  switched text[] not null default '{}',
  black_jacket text[] not null default '{}',
  final2 text[] not null default '{}',
  winner text,
  bonus jsonb not null default '{}'::jsonb,
  notes text,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  updated_at timestamptz not null default now(),
  primary key (league_id, num)
);

alter table public.league_results enable row level security;

drop policy if exists "league results read" on public.league_results;
create policy "league results read" on public.league_results for select to authenticated
  using (public.is_league_member(league_id) or public.is_site_admin());

drop policy if exists "league results insert" on public.league_results;
create policy "league results insert" on public.league_results for insert to authenticated
  with check (public.is_commissioner(league_id));

drop policy if exists "league results update" on public.league_results;
create policy "league results update" on public.league_results for update to authenticated
  using (public.is_commissioner(league_id)) with check (public.is_commissioner(league_id));

drop policy if exists "league results delete" on public.league_results;
create policy "league results delete" on public.league_results for delete to authenticated
  using (public.is_commissioner(league_id));

grant select, insert, update, delete on public.league_results to authenticated;

-- "Sent home" now looks at this league's results first, then the site-wide ones.
create or replace function public.contestant_out_in_league(p_league uuid, p_contestant text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from league_results r
    where r.league_id = p_league and r.posted
      and (p_contestant = any (r.eliminated) or p_contestant = any (r.quit))
  ) or exists (
    select 1 from episodes e join leagues l on l.season_id = e.season_id
    where l.id = p_league and e.posted
      and not exists (select 1 from league_results r where r.league_id = p_league and r.num = e.num)
      and (p_contestant = any (e.eliminated) or p_contestant = any (e.quit))
  );
$$;

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
    raise exception 'Unknown chef.';
  end if;
  if contestant_out_in_league(p_league, p_contestant) then raise exception 'That chef has already been sent home.'; end if;
  if exists (select 1 from picks where member_id = v_target and contestant_id = p_contestant) then
    raise exception 'That chef is already on this team.';
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
      raise exception 'That chef has already been drafted.';
    end if;
  else
    if (select count(*) from picks where member_id = v_target) >= l.roster_size then
      raise exception 'This team already has % chefs.', l.roster_size;
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
  if contestant_out_in_league(p_league, p_contestant) then raise exception 'That chef has already been sent home.'; end if;
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
    raise exception 'That chef has already been sent home.';
  end if;
  update league_members set winner_pick = p_contestant where id = v_target;
end $$;

revoke execute on function public.contestant_out_in_league(uuid, text) from public, anon;
grant execute on function public.contestant_out_in_league(uuid, text) to authenticated;

-- Other people's guesses show once the episode airs or this league posts its results.
drop policy if exists "guesses read" on public.guesses;
create policy "guesses read" on public.guesses for select to authenticated
  using (
    (public.is_league_member(league_id) or public.is_site_admin())
    and (
      member_id = public.my_member_id(league_id)
      or public.is_commissioner(league_id) and exists (
        select 1 from public.league_members m where m.id = member_id and m.user_id is null
      )
      or exists (
        select 1 from public.episodes e join public.leagues l on l.season_id = e.season_id
        where l.id = league_id and e.num = episode_num and (e.posted or (e.air_at is not null and e.air_at <= now()))
      )
      or exists (
        select 1 from public.league_results r where r.league_id = guesses.league_id and r.num = episode_num and r.posted
      )
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.league_results; exception when duplicate_object then null; end;
  end if;
end $$;
