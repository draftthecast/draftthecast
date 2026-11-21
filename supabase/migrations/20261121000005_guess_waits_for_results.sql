-- Weekly guesses for an episode stay closed while last week's episode has aired but its results
-- aren't posted (site-wide or by this league). Without this, a late guess for the aired episode
-- silently counted for the following week, and could name someone who had just gone home.
-- An earlier episode airing the same night (a double episode, under 12 hours apart) doesn't block.
-- Run this in the Supabase SQL Editor.

create or replace function public.set_guess(p_league uuid, p_episode int, p_contestant text, p_member uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  l leagues;
  e episodes;
  w int;
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
  select p.num into w from episodes p
   where p.season_id = l.season_id and p.num < p_episode
     and not p.posted
     and p.air_at is not null and p.air_at <= now()
     and (e.air_at is null or e.air_at - p.air_at >= interval '12 hours')
     and not exists (select 1 from league_results r where r.league_id = p_league and r.num = p.num and r.posted)
   order by p.num limit 1;
  if w is not null then
    raise exception 'Guesses for episode % open once episode % results are posted.', p_episode, w;
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
