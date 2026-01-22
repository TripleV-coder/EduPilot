import { useState, useEffect, useCallback } from "react";
import { Resource } from "@/lib/types/resources";
import { toast } from "sonner";

interface UseResourcesOptions {
  type?: string;
  subjectId?: string;
  classLevelId?: string;
}

export function useResources(options: UseResourcesOptions = {}) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (options.type) params.append("type", options.type);
      if (options.subjectId) params.append("subjectId", options.subjectId);
      if (options.classLevelId) params.append("classLevelId", options.classLevelId);

      const response = await fetch(`/api/resources?${params}`);
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setResources(data.resources || data);
    } catch (_err) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [options.type, options.subjectId, options.classLevelId]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  return { resources, loading, fetchResources };
}
