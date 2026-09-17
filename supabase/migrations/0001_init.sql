-- Schema per il "Questionario Assistito" (Acceleratore Adozione AI)
-- Unico punto di accesso: service role lato server. RLS abilitata, nessuna
-- policy per anon/authenticated (deny-by-default), il service role bypassa RLS.

create extension if not exists "pgcrypto";

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  status text not null default 'non_iniziata'
    check (status in ('non_iniziata', 'in_corso', 'completata', 'scaduta', 'abbandonata')),
  first_name text,
  last_name text,
  email text,
  company text,
  hubspot_contact_id text,
  started_at timestamptz,
  last_activity_at timestamptz,
  turn_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sessions_token_idx on sessions (token);

create table if not exists turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  turn_number integer not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists turns_session_id_idx on turns (session_id, turn_number);

create table if not exists coverage_state (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  objective_id integer not null check (objective_id between 1 and 16),
  status text not null default 'scoperto'
    check (status in ('scoperto', 'parziale', 'coperto')),
  extracted_content text,
  updated_at timestamptz not null default now(),
  unique (session_id, objective_id)
);

create table if not exists outputs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions (id) on delete cascade,
  recap_cliente text not null,
  brief_interno jsonb not null,
  generated_at timestamptz not null default now()
);

alter table sessions enable row level security;
alter table turns enable row level security;
alter table coverage_state enable row level security;
alter table outputs enable row level security;

-- Nessuna policy definita: solo il service role (che bypassa RLS) puo' leggere/scrivere.
