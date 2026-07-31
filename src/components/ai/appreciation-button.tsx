"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/edu";
import { callGovernanceAction } from "@/lib/ai/client-governance";

type AppreciationButtonProps = {
  studentId: string;
  currentGrade?: string | number;
  maxGrade?: number;
  onGenerated: (comment: string) => void;
  size?: "sm" | "md";
  label?: string;
};

export function AppreciationButton({
  studentId,
  currentGrade,
  maxGrade = 20,
  onGenerated,
  size = "sm",
  label = "Rédiger l'appréciation",
}: AppreciationButtonProps) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await callGovernanceAction<{ comment: string }>(
        "draft-report-comment",
        {
          studentId,
          data: { currentGrade, maxGrade },
        }
      );
      const comment = result.data?.comment;
      if (comment) {
        onGenerated(comment);
        toast.success("Appréciation générée");
      } else {
        toast.error("Aucune appréciation retournée");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      icon="sparkle"
      loading={loading}
      disabled={loading}
      onClick={generate}
      title={label}
      aria-label={label}
    >
      {size === "md" ? label : undefined}
    </Button>
  );
}
