import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In | Petiatrics',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Auth pages (login) have no persistent layout shell
  return <>{children}</>;
}
