-- Wise Cloud portal — Phase 1: identity, KYC, storage security

create type public.app_role as enum ('superuser','admin','operator','client');
create type public.customer_type as enum ('ENT','IND');
create type public.customer_status as enum ('PENDING_VERIFICATION','VERIFIED','REJECTED','SUSPENDED');
create type public.contact_type as enum ('BILLING','TECHNICAL');
create type public.bank_account_type as enum ('CORPORATE','PERSONAL');
create type public.legal_doc_type as enum ('NPWP','NIB','SK_KEMENKUMHAM','AKTA','KTP_DIRECTOR','KTP','PROOF_OF_TRANSFER','PPH23_CERTIFICATE','AUTHORIZATION_LETTER','OTHER');
create type public.legal_doc_status as enum ('PENDING','VERIFIED','REJECTED');
create type public.service_status as enum ('PENDING_ACTIVATION','ACTIVE','SUSPENDED','TERMINATED');
create type public.billing_cycle as enum ('MONTHLY','QUARTERLY','ANNUALLY');
create type public.product_category as enum ('COLOCATION','DEDICATED_INTERNET','CLOUD_SERVER','OTHER');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.customer_code_counters (
  code_year smallint not null,
  code_type public.customer_type not null,
  last_seq integer not null default 0,
  primary key (code_year, code_type)
);
grant all on public.customer_code_counters to service_role;
alter table public.customer_code_counters enable row level security;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  customer_code text not null unique,
  customer_type public.customer_type not null,
  status public.customer_status not null default 'PENDING_VERIFICATION',
  company_name text,
  npwp_number text,
  nib_number text,
  kemenkumham_sk text,
  akta_path text,
  director_name text,
  director_ktp_number text,
  full_name text,
  ktp_number text,
  verified_email text not null,
  rejection_reason text,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_ent_fields check (
    customer_type = 'IND' or (company_name is not null and npwp_number is not null)
  ),
  constraint customers_ind_fields check (
    customer_type = 'ENT' or (full_name is not null and ktp_number is not null)
  )
);
create index customers_status_idx on public.customers(status);
create index customers_user_idx on public.customers(user_id);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_type public.contact_type not null,
  name text not null,
  email text not null,
  phone text,
  position text,
  created_at timestamptz not null default now(),
  unique (customer_id, contact_type)
);
create index customer_contacts_customer_idx on public.customer_contacts(customer_id);
grant select, insert, update, delete on public.customer_contacts to authenticated;
grant all on public.customer_contacts to service_role;
alter table public.customer_contacts enable row level security;

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  account_type public.bank_account_type not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);
create index bank_accounts_customer_idx on public.bank_accounts(customer_id);
grant select, insert, update, delete on public.bank_accounts to authenticated;
grant all on public.bank_accounts to service_role;
alter table public.bank_accounts enable row level security;

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  doc_type public.legal_doc_type not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  file_size bigint not null,
  status public.legal_doc_status not null default 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (customer_id, doc_type)
);
create index legal_documents_customer_idx on public.legal_documents(customer_id);
grant select, insert, update, delete on public.legal_documents to authenticated;
grant all on public.legal_documents to service_role;
alter table public.legal_documents enable row level security;

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id uuid,
  author_email text,
  note text not null,
  created_at timestamptz not null default now()
);
create index admin_notes_customer_idx on public.admin_notes(customer_id);
grant select, insert on public.admin_notes to authenticated;
grant all on public.admin_notes to service_role;
alter table public.admin_notes enable row level security;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category public.product_category not null default 'OTHER',
  description text,
  unit_price numeric(14,2) not null default 0,
  setup_fee numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;

create table public.user_services (
  id uuid primary key default gen_random_uuid(),
  service_code text not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid references public.products(id),
  service_name text not null,
  status public.service_status not null default 'PENDING_ACTIVATION',
  billing_cycle public.billing_cycle not null default 'MONTHLY',
  unit_price numeric(14,2) not null default 0,
  setup_fee numeric(14,2) not null default 0,
  activated_at timestamptz,
  suspended_at timestamptz,
  terminated_at timestamptz,
  created_at timestamptz not null default now()
);
create index user_services_customer_idx on public.user_services(customer_id);
grant select on public.user_services to authenticated;
grant all on public.user_services to service_role;
alter table public.user_services enable row level security;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('superuser','admin','operator')
  )
$$;

create or replace function public.owns_customer(_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customers c
    where c.id = _customer_id and c.user_id = auth.uid()
  )
$$;

-- user_roles policies (after is_staff exists)
create policy "Users read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id);
create policy "Staff read all roles" on public.user_roles for select to authenticated
  using (public.is_staff(auth.uid()));

create policy "Clients read own customer" on public.customers for select to authenticated
  using (auth.uid() = user_id);
create policy "Staff read all customers" on public.customers for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "Clients register own customer" on public.customers for insert to authenticated
  with check (auth.uid() = user_id and status = 'PENDING_VERIFICATION');
create policy "Staff update customers" on public.customers for update to authenticated
  using (public.is_staff(auth.uid()));

create policy "Owners read contacts" on public.customer_contacts for select to authenticated
  using (public.owns_customer(customer_id));
create policy "Staff read contacts" on public.customer_contacts for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "Owners manage contacts" on public.customer_contacts for all to authenticated
  using (public.owns_customer(customer_id))
  with check (public.owns_customer(customer_id));
create policy "Staff manage contacts" on public.customer_contacts for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create policy "Owners read bank accounts" on public.bank_accounts for select to authenticated
  using (public.owns_customer(customer_id));
create policy "Staff read bank accounts" on public.bank_accounts for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "Owners manage bank accounts" on public.bank_accounts for all to authenticated
  using (public.owns_customer(customer_id))
  with check (public.owns_customer(customer_id));
create policy "Staff manage bank accounts" on public.bank_accounts for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create policy "Owners read documents" on public.legal_documents for select to authenticated
  using (public.owns_customer(customer_id));
create policy "Staff read documents" on public.legal_documents for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "Staff update documents" on public.legal_documents for update to authenticated
  using (public.is_staff(auth.uid()));
create policy "Staff insert documents" on public.legal_documents for insert to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Staff read notes" on public.admin_notes for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "Staff insert notes" on public.admin_notes for insert to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Signed-in users read active products" on public.products for select to authenticated
  using (is_active = true or public.is_staff(auth.uid()));
create policy "Staff insert products" on public.products for insert to authenticated
  with check (public.is_staff(auth.uid()));
create policy "Staff update products" on public.products for update to authenticated
  using (public.is_staff(auth.uid()));
create policy "Staff delete products" on public.products for delete to authenticated
  using (public.is_staff(auth.uid()));

create policy "Clients read own services" on public.user_services for select to authenticated
  using (public.owns_customer(customer_id));
create policy "Staff read services" on public.user_services for select to authenticated
  using (public.is_staff(auth.uid()));

create policy "Staff read audit logs" on public.audit_logs for select to authenticated
  using (public.is_staff(auth.uid()));

create or replace function public.assign_customer_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  yr smallint;
  seq integer;
begin
  yr := (extract(year from now())::int % 100)::smallint;
  insert into public.customer_code_counters (code_year, code_type, last_seq)
  values (yr, new.customer_type, 1)
  on conflict (code_year, code_type)
  do update set last_seq = public.customer_code_counters.last_seq + 1
  returning last_seq into seq;
  new.customer_code := (case new.customer_type when 'ENT' then 'ENT-' else 'IND-' end)
    || lpad(yr::text, 2, '0') || '-' || lpad(seq::text, 5, '0');
  return new;
end;
$$;

create trigger trg_assign_customer_code
before insert on public.customers
for each row execute function public.assign_customer_code();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_customers_touch
before update on public.customers
for each row execute function public.touch_updated_at();

-- Storage security for the legal-documents bucket
create policy "Legal docs: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'legal-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Legal docs: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'legal-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Legal docs: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'legal-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Legal docs: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'legal-documents' and public.is_staff(auth.uid()));