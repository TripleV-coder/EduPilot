"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ErrorBoundary } from "@/components/error-boundary";
import { StatsBar } from "@/components/explorer/StatsBar";
import { DetailPanel } from "@/components/explorer/DetailPanel";
import { ExplorerHeader } from "@/components/explorer/ExplorerHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { SchoolPoint } from "@/components/explorer/ExplorerCanvas";

function LoadingVisualization() {
  return (
    <div className="flex items-center justify-center h-[60vh] bg-explorer-bg">
      <div className="text-explorer-foreground/60">Chargement de la visualisation...</div>
    </div>
  );
}

function ExplorerFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
      <p className="text-center text-explorer-muted">
        La carte 3D n&apos;est pas disponible pour le moment.
      </p>
      <Button asChild variant="outline">
        <Link href="/" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>
      </Button>
    </div>
  );
}

const ExplorerCanvas = dynamic(
  () => import("@/components/explorer/ExplorerCanvas").then((mod) => ({ default: mod.ExplorerCanvas })),
  { ssr: false, loading: () => <LoadingVisualization /> }
);

type Overview = {
  schools: number;
  students: number;
  classes: number;
  teachers: number;
};

type SchoolsResponse = { schools: SchoolPoint[] };

export default function ExplorerRoutePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [schools, setSchools] = useState<SchoolPoint[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [_loadingSchools, setLoadingSchools] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<SchoolPoint | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/explorer/overview", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch {
      setOverview({ schools: 0, students: 0, classes: 0, teachers: 0 });
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const fetchSchools = useCallback(async () => {
    try {
      const res = await fetch("/api/explorer/schools");
      if (res.ok) {
        const data: SchoolsResponse = await res.json();
        setSchools(data.schools ?? []);
      }
    } catch {
      setSchools([]);
    } finally {
      setLoadingSchools(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchSchools();
  }, [fetchOverview, fetchSchools]);

  return (
    <main className="relative min-h-screen overflow-hidden explorer-gradient">
      <div className="explorer-grid absolute inset-0 opacity-30" aria-hidden />
      <ExplorerHeader />
      <div className="absolute left-4 top-20 z-10">
        <Button asChild variant="outline" size="sm">
          <Link href="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Accueil
          </Link>
        </Button>
      </div>
      <ErrorBoundary fallback={<ExplorerFallback />}>
        <ExplorerCanvas
          schools={schools}
          onSelect={setSelectedSchool}
          selectedId={selectedSchool?.id ?? null}
        />
      </ErrorBoundary>
      <DetailPanel school={selectedSchool as any} onClose={() => setSelectedSchool(null)} />
      <StatsBar overview={overview} loading={loadingOverview} />
      {selectedSchool && (
        <motion.div
          className="fixed inset-0 z-[5] bg-black/20 backdrop-blur-0 sm:bg-transparent sm:backdrop-blur-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedSchool(null)}
          aria-hidden
        />
      )}
    </main>
  );
}
