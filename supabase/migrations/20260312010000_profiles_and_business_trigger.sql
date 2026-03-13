-- Link auth.users to businesses via profiles
-- and auto-create a business for each new user.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid references businesses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_business_id
  on profiles(business_id);

-- Function to auto-create a business and profile when a user signs up
create or replace function handle_new_user()
returns trigger as $$
declare
  new_business_id uuid;
begin
  insert into businesses (name)
  values ('New Business')
  returning id into new_business_id;

  insert into profiles (id, business_id)
  values (new.id, new_business_id);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_user();

