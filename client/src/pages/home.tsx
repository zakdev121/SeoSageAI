import { useState } from "react";
import { AuditForm } from "@/components/audit-form";
import { LoadingState } from "@/components/loading-state";
import { ResultsSection } from "@/components/results-section";
import { ToastNotifications } from "@/components/toast-notifications";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, BarChart3, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const [currentAuditId, setCurrentAuditId] = useState<number | null>(null);
  const { user, tenant, logout } = useAuth();

  // Check if user has existing audits
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard"],
  });

  const hasExistingAudits = dashboardData && dashboardData.length > 0;

  const handleAuditStart = (auditId: number) => {
    setCurrentAuditId(auditId);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-search-plus text-white text-sm"></i>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">SEO AI Agent</h1>
                <p className="text-xs text-slate-500">Internal Marketing Tool</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-600">{user?.name} ({tenant?.name})</span>
              {hasExistingAudits && (
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="flex items-center space-x-1"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AuditForm onAuditStart={handleAuditStart} />
        
        {currentAuditId && (
          <>
            <LoadingState auditId={currentAuditId} />
            <ResultsSection auditId={currentAuditId} />
          </>
        )}
      </main>

      <ToastNotifications />
    </div>
  );
}
