/**
 * Admin/operator routing helpers (role-based; see `profiles.role` and `lib/roles.ts`).
 */
export {
  ADMIN_HOME_PATH,
  isAdminRole,
  isCustomerRole,
} from "@/lib/roles";

export { fetchSessionRoleFromApi } from "@/lib/client-profile-role";

import { ADMIN_HOME_PATH, isAdminRole } from "@/lib/roles";

export function defaultPostAuthPathFromRole(
  role: string | null | undefined,
): string {
  return isAdminRole(role) ? ADMIN_HOME_PATH : "/dashboard";
}

export function sanitizeAppPathForAdminRole(
  path: string,
  role: string | null | undefined,
): string {
  if (!isAdminRole(role)) {
    return path.startsWith("/") ? path : `/${path}`;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const forbidden = ["/dashboard", "/settings", "/recoveries", "/setup"];
  for (const p of forbidden) {
    if (normalized === p || normalized.startsWith(`${p}/`)) {
      return ADMIN_HOME_PATH;
    }
  }
  return normalized;
}

export function sanitizeAuthCallbackNext(
  next: string,
  role: string | null | undefined,
): string {
  return sanitizeAppPathForAdminRole(next, role);
}
