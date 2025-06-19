import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface LoadingStateProps {
  auditId: number;
}

const progressSteps = [
  { id: 1, label: "Crawling website pages", threshold: 10 },
  { id: 2, label: "Analyzing SEO elements", threshold: 30 },
  { id: 3, label: "Connecting to Google Search Console", threshold: 50 },
  { id: 4, label: "Generating AI recommendations", threshold: 70 },
  { id: 5, label: "Creating PDF report", threshold: 85 }
];

export function LoadingState({ auditId }: LoadingStateProps) {
  const [isVisible, setIsVisible] = useState(true);

  const { data: audit } = useQuery({
    queryKey: [`/api/audits/${auditId}`],
    refetchInterval: 2000, // Poll every 2 seconds
    enabled: !!auditId
  });

  useEffect(() => {
    if (audit?.status === 'completed' || audit?.status === 'failed') {
      // Keep visible for a moment then hide
      setTimeout(() => setIsVisible(false), 1000);
    }
  }, [audit?.status]);

  if (!isVisible || !audit || audit.status === 'completed') {
    return null;
  }

  const progress = audit.progress || 0;

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {audit.status === 'failed' ? 'Audit Failed' : 'Analyzing Website'}
          </h3>
          <p className="text-slate-600 mb-6">
            {audit.status === 'failed' 
              ? 'There was an error processing your audit. Please try again.'
              : 'This may take 2-3 minutes. Please don\'t close this tab.'
            }
          </p>
          
          {audit.status !== 'failed' && (
            <div className="max-w-md mx-auto">
              <div className="space-y-3">
                {progressSteps.map((step) => {
                  const isComplete = progress >= step.threshold;
                  const isActive = progress >= (progressSteps[step.id - 2]?.threshold || 0) && progress < step.threshold;
                  const isPending = progress < (progressSteps[step.id - 2]?.threshold || 0);

                  return (
                    <div key={step.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center space-x-2">
                        {isComplete && (
                          <i className="fas fa-check-circle text-green-600"></i>
                        )}
                        {isActive && (
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        )}
                        {isPending && (
                          <i className="fas fa-circle text-slate-300"></i>
                        )}
                        <span className={`${isPending ? 'text-slate-400' : 'text-slate-700'}`}>
                          {step.label}
                        </span>
                      </span>
                      <span className={`font-medium ${
                        isComplete ? 'text-green-600' : 
                        isActive ? 'text-amber-600' : 
                        'text-slate-400'
                      }`}>
                        {isComplete ? 'Complete' : isActive ? 'In Progress' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Progress bar */}
              <div className="mt-6">
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-slate-500 mt-2">{progress}% complete</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
