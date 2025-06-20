import { useState, useEffect } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  tenantId: string;
  role: string;
}

interface Tenant {
  id: number;
  tenantId: string;
  name: string;
  website: string;
  industry: string;
  plan: string;
  keywords: string[];
  features: {
    auditsPerMonth: number;
    fixesPerMonth: number;
    competitorAnalysis: boolean;
    customReporting: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    dedicatedSupport: boolean;
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setTenant(data.tenant);
      }
    } catch (error) {
      console.log('Not authenticated');
    } finally {
      setLoading(false);
    }
  };

  const login = async (authData: { user: User; tenant: Tenant }) => {
    setUser(authData.user);
    setTenant(authData.tenant);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setTenant(null);
    }
  };

  return {
    user,
    tenant,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}