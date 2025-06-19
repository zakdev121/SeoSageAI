import { useState } from "react";
import { AuditForm } from "@/components/audit-form";
import { LoadingState } from "@/components/loading-state";
import { ResultsSection } from "@/components/results-section";
import { ToastNotifications } from "@/components/toast-notifications";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [currentAuditId, setCurrentAuditId] = useState<number | null>(null);
  const { toast } = useToast();

  const handleAuditStart = (auditId: number) => {
    setCurrentAuditId(auditId);
  };

  const testOpenAI = async () => {
    try {
      const response = await fetch('/api/test/openai');
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "OpenAI API Test Successful",
          description: "AI features are working correctly and ready to generate recommendations.",
        });
      } else {
        toast({
          title: "OpenAI API Test Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Could not connect to test endpoint",
        variant: "destructive",
      });
    }
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
              <span className="text-sm text-slate-600">Marketing Team</span>
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                <i className="fas fa-user text-slate-600 text-xs"></i>
              </div>
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
