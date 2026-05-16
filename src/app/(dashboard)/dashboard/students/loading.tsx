"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const containerVariantsReduced = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.35,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

const itemVariantsReduced = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

const pulseAnimation = {
  background: ["hsl(var(--muted))", "hsl(var(--muted-foreground) / 0.3)", "hsl(var(--muted))"],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

const pulseAnimationReduced = {
  background: "hsl(var(--muted))",
  transition: {},
};

export default function StudentsLoading() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <motion.div
      className="container mx-auto p-6 space-y-6"
      variants={prefersReducedMotion ? containerVariantsReduced : containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header with Actions */}
      <motion.div 
        variants={prefersReducedMotion ? itemVariantsReduced : itemVariants} 
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="space-y-2">
          <motion.div
            className="h-8 w-48 rounded-lg"
            animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
          />
          <motion.div
            className="h-4 w-64 rounded-lg"
            animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
          />
        </div>
        <div className="flex gap-3">
          <motion.div
            className="h-10 w-32 rounded-lg"
            animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
          />
          <motion.div
            className="h-10 w-24 rounded-lg"
            animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
          />
        </div>
      </motion.div>

      {/* Filters Bar */}
      <motion.div 
        variants={prefersReducedMotion ? itemVariantsReduced : itemVariants}
        className="flex flex-wrap gap-3 items-center"
      >
        <motion.div
          className="h-10 w-48 rounded-lg"
          animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
        />
        <motion.div
          className="h-10 w-32 rounded-lg"
          animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
        />
        <motion.div
          className="h-10 w-32 rounded-lg"
          animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
        />
        <motion.div
          className="h-10 w-10 rounded-lg ml-auto"
          animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
        />
      </motion.div>

      {/* Students Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <motion.div key={i} variants={prefersReducedMotion ? itemVariantsReduced : itemVariants} custom={i}>
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <motion.div
                    className="h-12 w-12 rounded-full flex-shrink-0"
                    animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
                  />
                  <div className="flex-1 space-y-2 min-w-0">
                    <motion.div
                      className="h-4 w-full rounded"
                      animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
                    />
                    <motion.div
                      className="h-3 w-20 rounded"
                      animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
                    />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between items-center">
                    <motion.div
                      className="h-3 w-16 rounded"
                      animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
                    />
                    <motion.div
                      className="h-3 w-12 rounded"
                      animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <motion.div
                      className="h-3 w-20 rounded"
                      animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
                    />
                    <motion.div
                      className="h-5 w-16 rounded-full"
                      animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <motion.div 
        variants={prefersReducedMotion ? itemVariantsReduced : itemVariants}
        className="flex items-center justify-between pt-4"
      >
        <motion.div
          className="h-4 w-32 rounded"
          animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
        />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="h-10 w-10 rounded-lg"
              animate={prefersReducedMotion ? pulseAnimationReduced : pulseAnimation}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
