import { useState, useEffect, useCallback } from "react";
import { Appointment } from "@/lib/types/appointments";
import { toast } from "sonner";

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/appointments");
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setAppointments(data.appointments || data);
    } catch (_err) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  const createAppointment = useCallback(async (data: any) => {
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erreur");
      toast.success("Rendez-vous créé");
      await fetchAppointments();
    } catch (_err) {
      toast.error("Erreur de création");
    }
  }, [fetchAppointments]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  return { appointments, loading, fetchAppointments, createAppointment };
}
