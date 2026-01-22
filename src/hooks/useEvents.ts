import { useState, useEffect, useCallback } from "react";
import { SchoolEvent } from "@/lib/types/events";
import { toast } from "sonner";

export function useEvents(upcoming?: boolean) {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = upcoming ? "?upcoming=true" : "";
      const response = await fetch(`/api/events${params}`);
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setEvents(data.events || data);
    } catch (_err) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [upcoming]);

  const participate = useCallback(async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/participate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Erreur");
      toast.success("Inscription confirmée");
      await fetchEvents();
    } catch (_err) {
      toast.error("Erreur d'inscription");
    }
  }, [fetchEvents]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return { events, loading, fetchEvents, participate };
}
