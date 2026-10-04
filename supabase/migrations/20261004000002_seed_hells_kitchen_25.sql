-- Hell's Kitchen Season 25: cast, schedule and results for episodes 1-2.
-- Run after the schema file. Safe to run again; it updates rows in place.

insert into public.seasons (id, show, title, network)
values ('hk25', 'Hell''s Kitchen', 'Hell''s Kitchen, Season 25', 'FOX')
on conflict (id) do update set show = excluded.show, title = excluded.title, network = excluded.network;

insert into public.contestants (season_id, id, name, team, age, hometown) values
  ('hk25', 'miles',     'Miles Anderson',  'blue', 22, 'Albuquerque, NM'),
  ('hk25', 'mike',      'Mike Catuosco',   'blue', 24, 'Commack, NY'),
  ('hk25', 'gabe',      'Gabe Cerease',    'blue', 25, 'Lake Worth, FL'),
  ('hk25', 'dylan',     'Dylan Duffy',     'blue', 22, 'Milwaukee, WI'),
  ('hk25', 'jonny',     'Jonny Gudino',    'blue', 23, 'Grand Rapids, MI'),
  ('hk25', 'aiden',     'Aiden Ricklef',   'blue', 22, 'Fullerton, CA'),
  ('hk25', 'valentin',  'Valentin Royo',   'blue', 22, 'Houston, TX'),
  ('hk25', 'diego',     'Diego Sanchez',   'blue', 21, 'Allen Park, MI'),
  ('hk25', 'miguel',    'Miguel Soliz',    'blue', 22, 'Houston, TX'),
  ('hk25', 'jeyda',     'Jeyda Brooks',    'red',  23, 'Houston, TX'),
  ('hk25', 'kylie',     'Kylie Budich',    'red',  24, 'Hopatcong, NJ'),
  ('hk25', 'reni',      'Reni Lee',        'red',  24, 'Cincinnati, OH'),
  ('hk25', 'mya',       'Mya Gonsalves',   'red',  25, 'Lexington, OH'),
  ('hk25', 'sandra',    'Sandra Leclerc',  'red',  21, 'Bronx, NY'),
  ('hk25', 'haley',     'Haley Moss',      'red',  24, 'Orlando, FL'),
  ('hk25', 'georgiana', 'Georgiana Pahon', 'red',  24, 'Kansas City, MO'),
  ('hk25', 'nadia',     'Nadia Phillips',  'red',  24, 'Prince George''s County, MD'),
  ('hk25', 'joy',       'Joy Shi',         'red',  25, 'Washington, DC')
on conflict (season_id, id) do update set name = excluded.name, team = excluded.team, age = excluded.age, hometown = excluded.hometown;

-- Air times are 8pm Eastern. Guesses lock automatically at these times.
insert into public.episodes (season_id, num, title, air_at) values
  ('hk25', 1, '25th Premiere Party',    '2026-09-24 20:00 America/New_York'),
  ('hk25', 2, 'A Tale of Two Kitchens', '2026-10-01 20:00 America/New_York'),
  ('hk25', 3, null, '2026-10-08 20:00 America/New_York'),
  ('hk25', 4, null, '2026-10-15 20:00 America/New_York'),
  ('hk25', 5, null, '2026-10-22 20:00 America/New_York'),
  ('hk25', 6, null, '2026-10-29 20:00 America/New_York'),
  ('hk25', 7, null, '2026-11-05 20:00 America/New_York'),
  ('hk25', 8, null, '2026-11-12 20:00 America/New_York'),
  ('hk25', 9, null, '2026-11-19 20:00 America/New_York')
on conflict (season_id, num) do update set title = coalesce(excluded.title, public.episodes.title), air_at = excluded.air_at;

update public.episodes set
  posted = true,
  challenge_win = 'blue',
  service_win = null,
  mvp = '{diego,joy,miguel,mya,jonny,aiden}',
  notes = 'Signature dish challenge, Blue won on points. Standouts are the six chefs who scored a perfect 5. Valentin and Sandra had the lowest scores and got their menu books early. No elimination.'
where season_id = 'hk25' and num = 1;

update public.episodes set
  posted = true,
  challenge_win = null,
  service_win = 'blue',
  mvp = '{mya,mike}',
  nominated = '{reni,jeyda}',
  eliminated = '{reni}',
  notes = 'Mya and Mike won punishment passes in the three-round challenge. Red lost the influencer service and nominated Reni and Jeyda. Reni went home over raw salmon.'
where season_id = 'hk25' and num = 2;
