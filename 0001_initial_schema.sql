-- Initial schema for My Business Manager. Review before applying to a live project.
create extension if not exists pgcrypto;

create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text, language text not null default 'ar' check(language in ('ar','en')),
 timezone text not null default 'Africa/Cairo', created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.daily_plans (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 plan_date date not null, daily_goal text, summary text,
 status text not null default 'draft' check(status in ('draft','active','completed','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, description text, due_at timestamptz,
 status text not null default 'active' check(status in ('active','paused','completed','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid, project_id uuid, title text not null, description text, due_at timestamptz,
 start_at timestamptz, end_at timestamptz, estimated_minutes integer check(estimated_minutes is null or estimated_minutes>0),
 priority text not null default 'normal' check(priority in ('critical','high','normal','low')),
 status text not null default 'todo' check(status in ('todo','in_progress','done','deferred','cancelled')),
 ai_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id),
 foreign key(user_id,plan_id) references public.daily_plans(user_id,id) on delete cascade,
 foreign key(user_id,project_id) references public.projects(user_id,id) on delete cascade,
 check(start_at is null or end_at is null or end_at>start_at)
);
create table public.task_steps (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null, title text not null, position integer not null default 0, is_done boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(user_id,task_id) references public.tasks(user_id,id) on delete cascade
);
create table public.reminders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid, plan_id uuid, remind_at timestamptz not null, message text,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),
 sent_at timestamptz, idempotency_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(user_id,task_id) references public.tasks(user_id,id) on delete cascade,
 foreign key(user_id,plan_id) references public.daily_plans(user_id,id) on delete cascade,
 unique(user_id,idempotency_key)
);
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null, p256dh text not null, auth_secret text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,endpoint)
);
create table public.calendar_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null default 'google', status text not null default 'disconnected' check(status in ('connected','disconnected','error')),
 external_account_email text, secret_reference text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,provider)
);
create table public.calendar_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid, external_event_id text, title text not null, start_time timestamptz not null, end_time timestamptz not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(user_id,connection_id) references public.calendar_connections(user_id,id) on delete cascade,
 check(end_time>start_time)
);
create table public.ai_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid, status text not null default 'pending' check(status in ('pending','succeeded','failed')),
 model text, error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(user_id,plan_id) references public.daily_plans(user_id,id) on delete cascade
);
create table public.reminder_cron_logs (
 id bigint generated always as identity primary key, run_at timestamptz not null default now(),
 status text not null, selected_count integer not null default 0, sent_count integer not null default 0,
 error_count integer not null default 0, details jsonb not null default '{}'::jsonb
);

create index tasks_user_due_idx on public.tasks(user_id,due_at);
create index tasks_plan_idx on public.tasks(user_id,plan_id);
create index reminders_due_idx on public.reminders(status,remind_at);
create index reminders_user_idx on public.reminders(user_id,remind_at);
create index calendar_events_user_start_idx on public.calendar_events(user_id,start_time);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.profiles enable row level security;
alter table public.daily_plans enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_steps enable row level security;
alter table public.reminders enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_events enable row level security;
alter table public.ai_requests enable row level security;
alter table public.reminder_cron_logs enable row level security;

create policy profiles_owner_all on public.profiles for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy plans_owner_all on public.daily_plans for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy projects_owner_all on public.projects for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy tasks_owner_all on public.tasks for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy steps_owner_all on public.task_steps for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy reminders_owner_all on public.reminders for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy push_owner_all on public.push_subscriptions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy calendar_connections_owner_all on public.calendar_connections for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy calendar_events_owner_all on public.calendar_events for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy ai_requests_owner_all on public.ai_requests for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
-- No authenticated policy for reminder_cron_logs: server/service role only.
