-- ============================================================
--  Tekora — Maintenance Management System
--  File: supabase/schema.sql
--
--  Run this once in your Supabase SQL Editor to create all
--  tables, enable Row Level Security (RLS), and seed the
--  default admin account row (Auth user must be created
--  separately in Supabase Auth → Users).
--
--  SETUP ORDER:
--    1. Create Supabase project at https://supabase.com
--    2. Authentication → Settings → Enable Email provider
--    3. Authentication → Users → Add user:
--         Email:    Admin@tekora.example
--         Password: Admin
--       Copy the UUID — you'll need it in step 5.
--    4. SQL Editor → paste & run this entire file
--    5. Update the INSERT INTO users row below with the
--       real UUID from step 3.
--  create policy "auth_all_companies"
--  on companies
--  for all
--  to authenticated
--  using (true)
--  with check (true);
-- ============================================================

-- ── Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── COMPANIES ─────────────────────────────────────────────
create table if not exists companies (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null default '',
  address    text not null default '',
  created_at timestamptz not null default now()
);

-- ── USERS (mirrors Supabase Auth, stores app profile) ─────
create table if not exists users (
  id              uuid primary key references auth.users(id) on delete cascade,
  first_name      text not null default '',
  last_name       text not null default '',
  email           text not null default '',
  position        text not null default '',
  role            text not null default 'operator',
  is_admin        boolean not null default false,
  facility_id     uuid,
  company_id      uuid,
  admin_requested boolean not null default false,
  theme           text not null default 'midnight',
  created_at      timestamptz not null default now()
);

-- ── FACILITIES ────────────────────────────────────────────
create table if not exists facilities (
  id               uuid primary key default uuid_generate_v4(),
  company_id       uuid references companies(id),
  name             text not null default '',
  type             text not null default '',
  location         text not null default '',
  holding_capacity text not null default '',
  holding          text not null default '',
  length           numeric not null default 0,
  breadth          numeric not null default 0,
  tonnage          text not null default '',
  fuel_type        text not null default '',
  tank_capacity    numeric not null default 0,
  lub_oil_capacity numeric not null default 0,
  state            text not null default 'Operational',
  created_at       timestamptz not null default now()
);

-- ── FACILITY_HISTORY (audit trail) ────────────────────────
create table if not exists facility_history (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references users(id),
  from_facility uuid references facilities(id),
  to_facility   uuid references facilities(id),
  changed_at    timestamptz not null default now()
);

-- ── EQUIPMENT ─────────────────────────────────────────────
create table if not exists equipment (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null default '',
  type             text not null default '',
  manufacturer     text not null default '',
  model            text not null default '',
  capacity         text not null default '',
  state            text not null default 'Operational',
  maintenance_type text not null default 'PMS',
  mrh              numeric not null default 0,
  current_mrh      numeric not null default 0,
  total_mrh        numeric not null default 0,
  replaced         boolean not null default false,
  date_replaced    date,
  maintained       boolean not null default true,
  created_by       uuid references users(id),
  created_at       timestamptz not null default now()
);

-- ── EQUIPMENT ↔ FACILITIES (many-to-many) ─────────────────
create table if not exists equipment_facilities (
  equipment_id uuid references equipment(id) on delete cascade,
  facility_id  uuid references facilities(id) on delete cascade,
  primary key (equipment_id, facility_id)
);

-- ── ACTIVITIES (PMS template types) ───────────────────────
create table if not exists activities (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null default '',
  type        text not null default 'PMS',
  period      text not null default 'Daily',
  description text not null default '',
  created_at  timestamptz not null default now()
);

-- ── REQUESTS (maintenance work orders) ────────────────────
create table if not exists requests (
  id                 uuid primary key default uuid_generate_v4(),
  code               text not null default '',
  date               date,
  date_completed     date,
  facility_id        uuid references facilities(id),
  equipment_id       uuid references equipment(id),
  defect_description text not null default '',
  priority           text not null default 'medium',
  status             text not null default 'open',
  generated_by       uuid references users(id),
  created_by         uuid references users(id),
  created_at         timestamptz not null default now()
);

-- ── PMS_SCHEDULES ─────────────────────────────────────────
create table if not exists pms_schedules (
  id             uuid primary key default uuid_generate_v4(),
  equipment_id   uuid references equipment(id),
  activity_id    uuid references activities(id),
  scheduled_date date not null,
  period         text not null default 'Daily',
  status         text not null default 'pending',
  skip_reason    text,
  completed_at   timestamptz,
  completed_by   uuid references users(id),
  skipped_by     uuid references users(id),
  skipped_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- ── MAINTENANCE_GROUPS ────────────────────────────────────
create table if not exists maintenance_groups (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null default '',
  location   text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================
--  ROW LEVEL SECURITY
--  Adjust these policies to match your access model.
--  For development, "allow all authenticated" is simplest.
--  alter table public.companies enable row level security; 
-- ============================================================


alter table companies         enable row level security;
alter table users             enable row level security;
alter table facilities        enable row level security;
alter table facility_history  enable row level security;
alter table equipment         enable row level security;
alter table equipment_facilities enable row level security;
alter table activities        enable row level security;
alter table requests          enable row level security;
alter table pms_schedules     enable row level security;
alter table maintenance_groups enable row level security;

-- Allow all authenticated users to read/write (adjust per your RBAC needs)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'companies','users','facilities','facility_history',
    'equipment','equipment_facilities','activities',
    'requests','pms_schedules','maintenance_groups'
  ] loop
    execute format('
      create policy "auth_all_%I"
      on %I for all
      to authenticated
      using (true)
      with check (true);
    ', tbl, tbl);
  end loop;
end $$;

-- ============================================================
--  SEED DEFAULT ADMIN PROFILE
--  Replace '00000000-0000-0000-0000-000000000000' with the
--  real UUID from Supabase Auth → Users after creating
--  Admin@tekora.example / Admin in the dashboard.
-- ============================================================
insert into users (id, first_name, last_name, email, position, role, is_admin)
values (
  'd57b7564-04ab-4487-b0ab-60c86583e900',
  'Admin', 'User',
  'Admin@tekora.example',
  'System Administrator',
  'admin', true
)
on conflict (id) do nothing;
