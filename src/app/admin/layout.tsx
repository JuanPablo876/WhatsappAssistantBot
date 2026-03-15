import { requireAdmin } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import AdminShell from './components/admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  // Get stats for sidebar
  const [userCount, tenantCount] = await Promise.all([
    prisma.user.count(),
    prisma.tenant.count(),
  ]);

  return (
    <AdminShell 
      user={user} 
      stats={{ userCount, tenantCount }}
    >
      {children}
    </AdminShell>
  );
}
