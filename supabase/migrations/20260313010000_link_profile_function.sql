-- SECURITY DEFINER function to link a profile to a business.
-- Called from the API with the session JWT; checks auth.uid() = p_user_id then bypasses RLS to insert/update.

create or replace function public.link_profile_to_business(p_user_id uuid, p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Unauthorized: can only link your own profile';
  end if;
  insert into public.profiles (id, business_id)
  values (p_user_id, p_business_id)
  on conflict (id) do update set business_id = excluded.business_id;
end;
$$;

grant execute on function public.link_profile_to_business(uuid, uuid) to authenticated;
grant execute on function public.link_profile_to_business(uuid, uuid) to service_role;
