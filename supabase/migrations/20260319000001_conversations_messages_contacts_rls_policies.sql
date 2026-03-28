-- RLS policies for inbox/AI tables:
-- - conversations
-- - messages
-- - contacts
-- - events
-- - recoveries
--
-- Scope access to rows belonging to the user's linked business:
--   business_id IN (select business_id from profiles where profiles.id = auth.uid())

-- conversations
alter table conversations enable row level security;
drop policy if exists "Users can read own conversations" on conversations;
create policy "Users can read own conversations"
  on conversations for select
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can insert own conversations" on conversations;
create policy "Users can insert own conversations"
  on conversations for insert
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can update own conversations" on conversations;
create policy "Users can update own conversations"
  on conversations for update
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  )
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

-- messages
alter table messages enable row level security;
drop policy if exists "Users can read own messages" on messages;
create policy "Users can read own messages"
  on messages for select
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can insert own messages" on messages;
create policy "Users can insert own messages"
  on messages for insert
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can update own messages" on messages;
create policy "Users can update own messages"
  on messages for update
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  )
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

-- contacts
alter table contacts enable row level security;
drop policy if exists "Users can read own contacts" on contacts;
create policy "Users can read own contacts"
  on contacts for select
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can insert own contacts" on contacts;
create policy "Users can insert own contacts"
  on contacts for insert
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can update own contacts" on contacts;
create policy "Users can update own contacts"
  on contacts for update
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  )
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

-- events
alter table events enable row level security;
drop policy if exists "Users can read own events" on events;
create policy "Users can read own events"
  on events for select
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can insert own events" on events;
create policy "Users can insert own events"
  on events for insert
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

-- recoveries
alter table recoveries enable row level security;
drop policy if exists "Users can read own recoveries" on recoveries;
create policy "Users can read own recoveries"
  on recoveries for select
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can insert own recoveries" on recoveries;
create policy "Users can insert own recoveries"
  on recoveries for insert
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists "Users can update own recoveries" on recoveries;
create policy "Users can update own recoveries"
  on recoveries for update
  using (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  )
  with check (
    business_id in (select business_id from profiles where profiles.id = auth.uid())
  );

