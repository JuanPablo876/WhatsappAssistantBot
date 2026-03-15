// Re-export from local auth for backwards compatibility
export { 
  getCurrentUser,
  getAuthenticatedUser,
  getAuthenticatedUserWithTenant,
  isAdmin,
  requireAdmin,
} from './auth-local';

// Legacy alias
export const getAuthenticatedTenant = async () => {
  const { activeTenant } = await import('./auth-local').then(m => m.getAuthenticatedUserWithTenant());
  if (!activeTenant) {
    const { redirect } = await import('next/navigation');
    redirect('/create-tenant');
  }
  return activeTenant;
};
