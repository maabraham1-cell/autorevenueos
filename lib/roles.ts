/**
 * Profile roles in Supabase `profiles.role` (see migration).
 * Internal: admin (canonical), platform_admin legacy → migrated to admin.
 * Business: customer | owner | member.
 */

export type ProfileRole =
  | "admin"
  | "customer"
  | "platform_admin"
  | "owner"
  | "member";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "platform_admin";
}

export function isCustomerRole(role: string | null | undefined): boolean {
  return (
    role === "customer" ||
    role === "owner" ||
    role === "member"
  );
}

/** Default route after login for internal operators. */
export const ADMIN_HOME_PATH = "/operator";
