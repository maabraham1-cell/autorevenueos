import { redirect } from 'next/navigation';

/**
 * Continue onboarding: redirect to Settings where the user can create a business
 * and complete setup (e.g. after signup with existing email but no business linked).
 */
export default function SetupPage() {
  redirect('/settings');
}
