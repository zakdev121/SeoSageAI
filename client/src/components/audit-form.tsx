import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAuditSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const formSchema = insertAuditSchema.extend({
  email: z.string().email().optional().or(z.literal(""))
});

type FormData = z.infer<typeof formSchema>;

interface AuditFormProps {
  onAuditStart: (auditId: number) => void;
}

export function AuditForm({ onAuditStart }: AuditFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      industry: "Tech Services",
      email: ""
    }
  });

  const createAuditMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/audits", {
        ...data,
        email: data.email || undefined
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Audit Started",
        description: "Your SEO audit is now running. This may take 2-3 minutes.",
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

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    createAuditMutation.mutate(data);
  };

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Run SEO Audit</h2>
          <p className="text-slate-600">Analyze any website with AI-powered insights and recommendations</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="url" className="flex items-center text-sm font-medium text-slate-700 mb-2">
              <i className="fas fa-globe text-slate-400 mr-2"></i>
              Website URL
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              {...form.register("url")}
              className="w-full"
              required
            />
            {form.formState.errors.url && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.url.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="industry" className="flex items-center text-sm font-medium text-slate-700 mb-2">
              <i className="fas fa-industry text-slate-400 mr-2"></i>
              Industry
            </Label>
            <Select defaultValue="Tech Services" onValueChange={(value) => form.setValue("industry", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tech Services">Tech Services</SelectItem>
                <SelectItem value="E-commerce">E-commerce</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Real Estate">Real Estate</SelectItem>
                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                <SelectItem value="Consulting">Consulting</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="email" className="flex items-center text-sm font-medium text-slate-700 mb-2">
              <i className="fas fa-envelope text-slate-400 mr-2"></i>
              Email Report (Optional)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your-email@company.com"
              {...form.register("email")}
              className="w-full"
            />
            <p className="text-sm text-slate-500 mt-1">Leave empty to download report directly</p>
            {form.formState.errors.email && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-primary text-white py-3 px-6 font-medium hover:bg-blue-700 flex items-center justify-center space-x-2"
          >
            <i className="fas fa-rocket"></i>
            <span>{isSubmitting ? "Starting Audit..." : "Run SEO Audit"}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
