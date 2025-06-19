import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Audit, InsertAudit } from "@shared/schema";

export function useAudit(auditId?: number) {
  return useQuery({
    queryKey: ['/api/audits', auditId],
    enabled: !!auditId,
    refetchInterval: (data) => {
      // Stop polling when audit is completed or failed
      return data?.status === 'completed' || data?.status === 'failed' ? false : 2000;
    }
  });
}

export function useCreateAudit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertAudit) => {
      const response = await apiRequest("POST", "/api/audits", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audits'] });
    }
  });
}

export function useDownloadPDF(auditId: number) {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/audits/${auditId}/download`);
      if (!response.ok) throw new Error('Failed to download PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `seo-audit-${auditId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  });
}

export function useSendEmail(auditId: number) {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", `/api/audits/${auditId}/email`, { email });
      return response.json();
    }
  });
}
