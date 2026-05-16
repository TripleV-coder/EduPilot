"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2, GraduationCap, Loader2, School, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import { SectionHeader } from "./SectionHeader";
import { useEffect, useMemo, useState } from "react";

type ExplorerSchool = {
  id: string;
  name: string;
  city?: string | null;
  studentsCount: number;
  teachersCount: number;
  classesCount: number;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

export function TestimonialsSection() {
  const [schools, setSchools] = useState<ExplorerSchool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/explorer/schools", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        setSchools(Array.isArray(data?.schools) ? data.schools : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const featuredSchools = useMemo(() => schools.slice(0, 3), [schools]);

  return (
    <section className="py-24 md:py-40 bg-slate-50 dark:bg-slate-900/20 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <SectionHeader
          badgeIcon={Building2}
          badgeText={t("landing.testimonials.badge")}
          title={t("landing.testimonials.title")}
          subtitle={t("landing.testimonials.subtitle")}
        />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {loading ? (
            <motion.div variants={itemVariants} className="col-span-full flex items-center justify-center rounded-[2.5rem] border border-slate-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl p-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </motion.div>
          ) : featuredSchools.length === 0 ? (
            <motion.div variants={itemVariants} className="col-span-full rounded-[2.5rem] border border-slate-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl p-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-6">
                <School className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-heading font-bold text-slate-900 dark:text-white">Aucun établissement actif</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-body">Les indicateurs apparaissent dès qu’un établissement est configuré.</p>
            </motion.div>
          ) : (
            featuredSchools.map((school) => (
              <motion.div key={school.id} variants={itemVariants} className="group">
                <div className="h-full relative rounded-[2rem] border border-slate-200/60 dark:border-white/5 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 overflow-hidden cursor-pointer">
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between gap-4 mb-8">
                      <h3 className="text-xl font-heading font-black text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors">{school.name}</h3>
                      <div className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest shrink-0">
                        {school.city || "Bénin"}
                      </div>
                    </div>
                    
                    <div className="mt-auto grid grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Élèves</span>
                        <span className="text-lg font-heading font-bold text-slate-900 dark:text-white">{school.studentsCount.toLocaleString("fr-FR")}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Profs</span>
                        <span className="text-lg font-heading font-bold text-slate-900 dark:text-white">{school.teachersCount.toLocaleString("fr-FR")}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Classes</span>
                        <span className="text-lg font-heading font-bold text-slate-900 dark:text-white">{school.classesCount.toLocaleString("fr-FR")}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative element */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" />
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </section>
  );
}
