import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, Zap, Brain } from "lucide-react";

interface AuditFormProps {
  onAuditStart: (auditId: number) => void;
}

const AVAILABLE_INDUSTRIES = [
  { id: "tech-services", name: "Tech Services", description: "Software development and technical consulting" },
  { id: "ai-automation", name: "AI & Automation", description: "Artificial intelligence and automation solutions" },
  { id: "it-staffing", name: "IT Staffing", description: "Technical recruitment and staffing services" }
];

export function AuditForm({ onAuditStart }: AuditFormProps) {
  const { toast } = useToast();
  const [selectedIndustry, setSelectedIndustry] = useState("tech-services");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createAuditMutation = useMutation({
    mutationFn: async () => {
      const allIndustries = AVAILABLE_INDUSTRIES.map(ind => ind.name).join(", ");
      const response = await apiRequest("POST", "/api/audits", {
        url: "synviz.com",
        industry: allIndustries
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "AI Audit Started",
        description: "Running comprehensive SEO analysis for synviz.com",
      });
      onAuditStart(data.auditId);
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to start audit. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  });

  const handleStartAudit = async () => {
    if (isSubmitting || createAuditMutation.isPending) return;
    setIsSubmitting(true);
    createAuditMutation.mutate();
  };

  return (
    <Card className="w-full max-w-6xl mx-auto mb-8">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle className="text-lg">AI SEO Audit for Synviz</CardTitle>
              <CardDescription className="text-sm">
                Comprehensive AI-powered SEO analysis and issue resolution for synviz.com
              </CardDescription>
            </div>
          </div>
          <Button 
            onClick={handleStartAudit}
            disabled={isSubmitting || createAuditMutation.isPending}
            size="lg"
            className="min-w-[180px]"
          >
            {isSubmitting || createAuditMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Running AI Audit...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Start AI SEO Audit
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Website Info */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-sm">Website</span>
            </div>
            <p className="text-sm font-mono text-blue-700">synviz.com</p>
          </div>

          {/* Industries Coverage */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-sm">Multi-Industry Analysis</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {AVAILABLE_INDUSTRIES.map((industry) => (
                <Badge key={industry.id} variant="secondary" className="text-xs px-2 py-1">
                  {industry.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Audit Features */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold text-sm">What You'll Get</span>
            </div>
            <ul className="text-xs space-y-1 text-gray-600">
              <li>• Complete SEO health analysis</li>
              <li>• AI-powered issue resolutions</li>
              <li>• Custom blog strategy & content</li>
              <li>• GSC performance insights</li>
              <li>• Professional PDF report</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
