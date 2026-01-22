import { useState, useEffect, useCallback } from "react";
import { Certificate } from "@/lib/types/certificates";
import { toast } from "sonner";

export function useCertificates(studentId?: string) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const params = studentId ? `?studentId=${studentId}` : "";
      const response = await fetch(`/api/certificates${params}`);
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setCertificates(data.certificates || data);
    } catch (_err) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const requestCertificate = useCallback(async (data: any) => {
    try {
      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erreur");
      toast.success("Certificat créé");
      await fetchCertificates();
    } catch (_err) {
      toast.error("Erreur de création");
    }
  }, [fetchCertificates]);

  useEffect(() => { fetchCertificates(); }, [fetchCertificates]);

  return { certificates, loading, fetchCertificates, requestCertificate };
}
