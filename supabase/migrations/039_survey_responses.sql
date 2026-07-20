-- 039: post-tournament feedback survey (one response per account).
--
-- Yes/no answers as jsonb {question_key: boolean} + one optional free comment.
-- RLS: authenticated users INSERT their own row once and SELECT it back (the
-- UI uses that to stop proposing the survey). No update/delete — one shot.
-- Results are read via the Supabase dashboard / service role; survey_summary
-- aggregates yes-rates per question for the end-of-survey bilan.

create table public.survey_responses (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  survey_key text not null default 'wc2026',
  answers    jsonb not null,
  comment    text,
  created_at timestamptz not null default now()
);

alter table public.survey_responses enable row level security;

create policy "insert own response" on public.survey_responses
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "read own response" on public.survey_responses
  for select to authenticated
  using (user_id = auth.uid());

-- Aggregate view for the bilan: per-question yes counts + totals. Plain view:
-- RLS on the base table limits anon/authenticated to their own rows through
-- it; the dashboard/service role sees the full aggregate.
create view public.survey_summary as
select
  survey_key,
  count(*) as responses,
  count(comment) filter (where length(trim(comment)) > 0) as comments,
  q.key as question,
  count(*) filter (where (answers ->> q.key)::boolean) as yes_count
from public.survey_responses,
     lateral jsonb_object_keys(answers) as q(key)
group by survey_key, q.key
order by q.key;
