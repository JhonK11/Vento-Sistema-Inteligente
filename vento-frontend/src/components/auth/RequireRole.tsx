import React from 'react';
import { useAuthStore } from '../../store/authStore';

interface RequireRoleProps {
  roles: string[];
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const user = useAuthStore((state) => state.user);

  if (!user || !user.rol_nombre) return null;
  
  if (roles.includes(user.rol_nombre)) {
    return <>{children}</>;
  }

  return null;
};

