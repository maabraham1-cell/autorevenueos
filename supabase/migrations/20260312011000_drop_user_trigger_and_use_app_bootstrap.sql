-- Remove database trigger-based business creation.
-- The app will lazily create a business + profile on first access instead.

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists handle_new_user();

