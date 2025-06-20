import { useEffect, useState } from "react";
import { TenantOnboarding } from "./tenant-onboarding";
import { apiRequest } from "@/lib/queryClient";

interface TenantDetectorProps {
  children: React.ReactNode;
}

interface TenantInfo {
  tenantId: string;
  name: string;
  isConfigured: boolean;
  plan: string;
}

export function TenantDetector({ children }: TenantDetectorProps) {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    detectTenant();
  }, []);

  const detectTenant = async () => {
    try {
      // Check for existing tenant from URL subdomain or default to synviz
      const hostname = window.location.hostname;
      const subdomain = hostname.split('.')[0];
      
      const response = await fetch('/api/tenant/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname, subdomain })
      });

      const data = await response.json();
      setTenantInfo(data);
      
      // Show onboarding for new tenants (not synviz)
      if (!data.isConfigured && data.tenantId !== 'synviz') {
        setShowOnboarding(true);
      }
    } catch (error) {
      // New tenant - show onboarding
      setShowOnboarding(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async (config: any) => {
    try {
      const response = await fetch('/api/tenant/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      setTenantInfo(data.tenant);
      setShowOnboarding(false);
    } catch (error) {
      console.error('Tenant registration failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing SEO AI...</p>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <TenantOnboarding onComplete={handleOnboardingComplete} />;
  }

  return <>{children}</>;
}