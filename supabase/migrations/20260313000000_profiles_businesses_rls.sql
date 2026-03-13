-- RLS policies so authenticated users can create/link profile and business
-- without requiring the service role key (e.g. from /api/setup and auth bootstrap).

-- Profiles: user can only read/insert/update their own row (id = auth.uid())
alter table profiles enable row level security;

drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Businesses: allow authenticated users to insert (create) one;
-- allow select/update only for the business linked to their profile
alter table businesses enable row level security;

drop policy if exists "Users can create business" on businesses;
create policy "Users can create business"
  on businesses for insert
  to authenticated
  with check (true);

drop policy if exists "Users can read own business" on businesses;
create policy "Users can read own business"
  on businesses for select
  using (
    id in (
      select business_id from profiles where profiles.id = auth.uid()
    )
  );

drop policy if exists "Users can update own business" on businesses;
create policy "Users can update own business"
  on businesses for update
  using (
    id in (
      select business_id from profiles where profiles.id = auth.uid()
    )
  )
  with check (
    id in (
      select business_id from profiles where profiles.id = auth.uid()
    )
  );
