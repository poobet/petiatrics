import { redirect } from 'next/navigation';

// The root URL redirects to the login page.
// Portal routing (admin / clinic / pet-owner) is handled post-authentication
// in apps/web/middleware.ts (implemented in Phase 3 T050).
export default function RootPage() {
  redirect('/login');
}
