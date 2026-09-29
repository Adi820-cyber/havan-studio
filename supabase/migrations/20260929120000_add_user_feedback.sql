-- Optional anonymous feedback. Browser clients cannot read submitted rows.
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug', 'confusing', 'idea', 'other')),
  message text not null check (char_length(btrim(message)) between 3 and 2000),
  rating smallint check (rating is null or rating between 1 and 5),
  page_area text not null check (page_area in ('landing', 'dashboard', 'maker', 'invite', 'profile', 'other')),
  follow_up_requested boolean not null default false,
  contact_email text,
  created_at timestamptz not null default now(),
  constraint user_feedback_follow_up_contact check (
    (follow_up_requested and contact_email is not null)
    or (not follow_up_requested and contact_email is null)
  ),
  constraint user_feedback_email_length check (
    contact_email is null or char_length(contact_email) <= 254
  )
);

comment on table public.user_feedback is
  'Optional user feedback. Public clients cannot read it; contact_email is stored only with explicit reply consent.';

alter table public.user_feedback enable row level security;
revoke all on table public.user_feedback from public, anon, authenticated;
grant insert on table public.user_feedback to service_role;
