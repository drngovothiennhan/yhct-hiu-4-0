create index if not exists drl_semesters_published_by_idx
  on public.drl_semesters (published_by)
  where published_by is not null;
