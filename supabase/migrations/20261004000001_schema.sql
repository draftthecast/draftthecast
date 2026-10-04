-- Draft the Cast: database schema, security rules and league functions.
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- A show season, e.g. Hell's Kitchen Season 25.
create table if not exists public.seasons (
  id text primary key,
  show text not null,
  title text not null,
  network text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contestants (
  season_id text not null references public.seasons on delete cascade,
  id text not null,
  name text not null,
  team text not null check (team in ('red', 'blue')),
  age int,
  hometown text,
  primary key (season_id, id)
);

-- One row per episode. Results only count once `posted` is true.
create table if not exists public.episodes (
  season_id text not null references public.seasons on delete cascade,
  num int not null check (num > 0),
  title text,
  air_at timestamptz,
  posted boolean not null default false,
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
  updated_at timestamptz not null default now(),
  primary key (season_id, num)
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.seasons,
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by uuid not null references auth.users,
  mode text not null default 'snake' check (mode in ('snake', 'open')),
  roster_size int not null default 3 check (roster_size between 1 and 9),
  start_episode int not null default 1 check (start_episode >= 1),
  draft_status text not null default 'setup' check (draft_status in ('setup', 'open', 'closed')),
  draft_order uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- A team in a league. user_id is null for players the commissioner adds by hand.
create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid references auth.users on delete set null,
  team_name text not null check (char_length(team_name) between 1 and 40),
  manager_name text check (manager_name is null or char_length(manager_name) <= 40),
  role text not null default 'player' check (role in ('commissioner', 'player')),
  winner_pick text,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  member_id uuid not null references public.league_members on delete cascade,
  contestant_id text not null,
  pick_no int not null,
  created_at timestamptz not null default now(),
  unique (member_id, contestant_id),
  unique (league_id, pick_no)
);

-- Weekly "who goes home" guesses.
create table if not exists public.guesses (
  league_id uuid not null references public.leagues on delete cascade,
  member_id uuid not null references public.league_members on delete cascade,
  episode_num int not null,
  contestant_id text not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, episode_num)
);

create index if not exists league_members_league_idx on public.league_members (league_id);
create index if not exists league_members_user_idx on public.league_members (user_id);
create index if not exists picks_league_idx on public.picks (league_id);
create index if not exists guesses_league_idx on public.guesses (league_id);

-- ============================================================
-- Profiles are created automatically when someone signs in with Google
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Helper checks (security definer so policies don't recurse)
-- ============================================================

create or replace function public.is_site_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_admins where user_id = auth.uid());
$$;

create or replace function public.is_league_member(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = p_league and user_id = auth.uid());
$$;

create or replace function public.is_commissioner(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_admin() or exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = auth.uid() and role = 'commissioner'
  );
$$;

create or replace function public.my_member_id(p_league uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.league_members where league_id = p_league and user_id = auth.uid();
$$;

-- Chef has been sent home (or quit) in a posted episode.
create or replace function public.contestant_out(p_season text, p_contestant text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.episodes
    where season_id = p_season and posted
      and (p_contestant = any (eliminated) or p_contestant = any (quit))
  );
$$;

-- ============================================================
-- Row level security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.site_admins enable row level security;
alter table public.seasons enable row level security;
alter table public.contestants enable row level security;
alter table public.episodes enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.picks enable row level security;
alter table public.guesses enable row level security;

-- Profiles: signed-in people can see names; you edit your own.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "admins read own" on public.site_admins;
create policy "admins read own" on public.site_admins for select to authenticated using (user_id = auth.uid());

-- Show data is public; only site admins change it.
drop policy if exists "seasons read" on public.seasons;
create policy "seasons read" on public.seasons for select to anon, authenticated using (true);
drop policy if exists "seasons admin" on public.seasons;
create policy "seasons admin" on public.seasons for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists "contestants read" on public.contestants;
create policy "contestants read" on public.contestants for select to anon, authenticated using (true);
drop policy if exists "contestants admin" on public.contestants;
create policy "contestants admin" on public.contestants for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists "episodes read" on public.episodes;
create policy "episodes read" on public.episodes for select to anon, authenticated using (true);
drop policy if exists "episodes admin" on public.episodes;
create policy "episodes admin" on public.episodes for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

-- Leagues: members see their league; commissioners change settings.
drop policy if exists "leagues read" on public.leagues;
create policy "leagues read" on public.leagues for select to authenticated
  using (public.is_league_member(id) or public.is_site_admin());
drop policy if exists "leagues update" on public.leagues;
create policy "leagues update" on public.leagues for update to authenticated
  using (public.is_commissioner(id)) with check (public.is_commissioner(id));
drop policy if exists "leagues delete" on public.leagues;
create policy "leagues delete" on public.leagues for delete to authenticated
  using (created_by = auth.uid() or public.is_site_admin());

revoke update on public.leagues from anon, authenticated;
grant update (name, mode, roster_size, start_episode, draft_status, draft_order) on public.leagues to authenticated;

-- Members: league members see each other.
drop policy if exists "members read" on public.league_members;
create policy "members read" on public.league_members for select to authenticated
  using (public.is_league_member(league_id) or public.is_site_admin());
-- Commissioners can add players who won't sign in themselves.
drop policy if exists "members add manual" on public.league_members;
create policy "members add manual" on public.league_members for insert to authenticated
  with check (public.is_commissioner(league_id) and user_id is null and role = 'player');
drop policy if exists "members update" on public.league_members;
create policy "members update" on public.league_members for update to authenticated
  using (user_id = auth.uid() or public.is_commissioner(league_id))
  with check (user_id = auth.uid() or public.is_commissioner(league_id));
drop policy if exists "members delete" on public.league_members;
create policy "members delete" on public.league_members for delete to authenticated
  using (public.is_commissioner(league_id) or (user_id = auth.uid() and role = 'player'));

revoke update on public.league_members from anon, authenticated;
grant update (team_name, manager_name) on public.league_members to authenticated;

-- Picks: visible to the league; changed only through the draft functions below.
drop policy if exists "picks read" on public.picks;
create policy "picks read" on public.picks for select to authenticated
  using (public.is_league_member(league_id) or public.is_site_admin());

-- Guesses: you always see your own; everyone else's appear once the episode starts airing.
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
    )
  );

-- ============================================================
-- League functions
-- ============================================================

create or replace function public.new_invite_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.leagues where invite_code = code);
  end loop;
  return code;
end $$;

create or replace function public.create_league(
  p_season text, p_name text, p_team_name text,
  p_mode text default 'snake', p_roster_size int default 3, p_start_episode int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
  v_start int;
begin
  if auth.uid() is null then raise exception 'Sign in to create a league.'; end if;
  if not exists (select 1 from seasons where id = p_season and active) then
    raise exception 'That season isn''t available.';
  end if;
  v_start := coalesce(p_start_episode,
    (select min(num) from episodes where season_id = p_season and not posted), 1);
  insert into leagues (season_id, name, invite_code, created_by, mode, roster_size, start_episode)
  values (p_season, trim(p_name), new_invite_code(), auth.uid(), p_mode, p_roster_size, v_start)
  returning id into v_league;
  insert into league_members (league_id, user_id, team_name, role)
  values (v_league, auth.uid(), trim(p_team_name), 'commissioner');
  return v_league;
end $$;

-- What a person sees on an invite link before joining.
create or replace function public.league_preview(p_code text)
returns table (id uuid, name text, season_title text, member_count int, draft_status text, mode text)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, s.title,
    (select count(*)::int from league_members m where m.league_id = l.id),
    l.draft_status, l.mode
  from leagues l join seasons s on s.id = l.season_id
  where l.invite_code = upper(trim(p_code));
$$;

create or replace function public.join_league(p_code text, p_team_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  l leagues;
  v_existing uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to join a league.'; end if;
  select * into l from leagues where invite_code = upper(trim(p_code));
  if not found then raise exception 'That invite code doesn''t match a league.'; end if;
  select id into v_existing from league_members where league_id = l.id and user_id = auth.uid();
  if v_existing is not null then return l.id; end if;
  if l.mode = 'snake' and l.draft_status <> 'setup' then
    raise exception 'This league''s draft has already started. Ask the commissioner to add you.';
  end if;
  if coalesce(trim(p_team_name), '') = '' then raise exception 'Give your team a name.'; end if;
  insert into league_members (league_id, user_id, team_name) values (l.id, auth.uid(), trim(p_team_name));
  return l.id;
end $$;

-- Resolve which team an action applies to. Commissioners may act for any team in their league.
create or replace function public.resolve_member(p_league uuid, p_member uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := my_member_id(p_league);
begin
  if p_member is null or p_member = v_me then
    if v_me is null then raise exception 'Join this league first.'; end if;
    return v_me;
  end if;
  if not is_commissioner(p_league) then
    raise exception 'Only the commissioner can do that for another team.';
  end if;
  if not exists (select 1 from league_members where id = p_member and league_id = p_league) then
    raise exception 'That team isn''t in this league.';
  end if;
  return p_member;
end $$;

create or replace function public.draft_order_for(p_league uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  -- Saved order (minus anyone removed), then anyone not yet placed, by join time.
  select coalesce(array_agg(id order by pos), '{}') from (
    select m.id, coalesce(array_position(l.draft_order, m.id), 100000 + row_number() over (order by m.joined_at)) as pos
    from league_members m join leagues l on l.id = m.league_id
    where m.league_id = p_league
  ) t;
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
  if contestant_out(l.season_id, p_contestant) then raise exception 'That chef has already been sent home.'; end if;
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

create or replace function public.drop_pick(p_league uuid, p_contestant text, p_member uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  l leagues;
  v_target uuid;
begin
  select * into l from leagues where id = p_league for update;
  v_target := resolve_member(p_league, p_member);
  if l.mode <> 'open' or l.draft_status <> 'open' then
    raise exception 'Picks can only be removed while a free-pick draft is open.';
  end if;
  delete from picks where member_id = v_target and contestant_id = p_contestant;
end $$;

create or replace function public.undo_last_pick(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_commissioner(p_league) then raise exception 'Only the commissioner can undo picks.'; end if;
  perform 1 from leagues where id = p_league for update;
  delete from picks where id = (
    select id from picks where league_id = p_league order by pick_no desc limit 1
  );
end $$;

create or replace function public.reset_picks(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_commissioner(p_league) then raise exception 'Only the commissioner can clear picks.'; end if;
  perform 1 from leagues where id = p_league for update;
  delete from picks where league_id = p_league;
end $$;

create or replace function public.shuffle_draft_order(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_commissioner(p_league) then raise exception 'Only the commissioner can change the order.'; end if;
  update leagues set draft_order = (
    select coalesce(array_agg(id order by random()), '{}') from league_members where league_id = p_league
  ) where id = p_league and draft_status = 'setup';
end $$;

create or replace function public.open_draft(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_commissioner(p_league) then raise exception 'Only the commissioner can open the draft.'; end if;
  update leagues set draft_order = draft_order_for(p_league), draft_status = 'open' where id = p_league;
end $$;

create or replace function public.set_member_role(p_member uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
begin
  select league_id into v_league from league_members where id = p_member and user_id is not null;
  if v_league is null then raise exception 'Only people who have signed in can be commissioners.'; end if;
  if not is_commissioner(v_league) then raise exception 'Only the commissioner can change roles.'; end if;
  if p_role not in ('commissioner', 'player') then raise exception 'Unknown role.'; end if;
  if p_role = 'player' and (select count(*) from league_members where league_id = v_league and role = 'commissioner') <= 1 then
    raise exception 'A league needs at least one commissioner.';
  end if;
  update league_members set role = p_role where id = p_member;
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
  if e.posted or (e.air_at is not null and e.air_at <= now()) then
    raise exception 'Guesses for episode % are locked.', p_episode;
  end if;
  if p_contestant is null then
    delete from guesses where member_id = v_target and episode_num = p_episode;
    return;
  end if;
  if contestant_out(l.season_id, p_contestant) then raise exception 'That chef has already been sent home.'; end if;
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
  ) then
    raise exception 'Winner picks locked when scoring started.';
  end if;
  if p_contestant is not null and contestant_out(l.season_id, p_contestant) then
    raise exception 'That chef has already been sent home.';
  end if;
  update league_members set winner_pick = p_contestant where id = v_target;
end $$;

-- Function access: signed-in users only (league_preview is open so invite links work before sign-in).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.league_preview(text) to anon;

-- ============================================================
-- Live updates
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.leagues; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.league_members; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.picks; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.guesses; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.episodes; exception when duplicate_object then null; end;
  end if;
end $$;
