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
    setIsSubmitting(true);
    createAuditMutation.mutate();
  };

  return (
    <Card className="w-full max-w-lg mx-auto mb-8">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Brain className="h-6 w-6 text-blue-600" />
          AI SEO Audit for Synviz
        </CardTitle>
        <CardDescription>
          Comprehensive AI-powered SEO analysis and issue resolution for synviz.com
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Website Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <span className="font-semibold">Website</span>
          </div>
          <p className="text-lg font-mono">synviz.com</p>
        </div>

        {/* Industries Coverage */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <span className="font-semibold">Multi-Industry Analysis</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Analyzing synviz.com across all relevant industry contexts:
          </p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_INDUSTRIES.map((industry) => (
              <Badge key={industry.id} variant="secondary" className="text-xs">
                {industry.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Audit Features */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            What You'll Get
          </h4>
          <ul className="text-sm space-y-1 text-gray-600">
            <li>• Complete SEO health analysis</li>
            <li>• AI-powered issue resolutions with step-by-step fixes</li>
            <li>• Custom blog strategy and content generation</li>
            <li>• Google Search Console performance insights</li>
            <li>• Professional PDF report</li>
          </ul>
        </div>

        <Button 
          onClick={handleStartAudit}
          className="w-full" 
          disabled={isSubmitting}
          size="lg"
        >
          {isSubmitting ? (
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
      </CardContent>
    </Card>
  );
}
