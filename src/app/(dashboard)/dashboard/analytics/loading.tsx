"use client";

import { motion, Variants } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Animation variants for staggered loading effect
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
    },
  },
};

const pulseAnimation: any = {
  background: ["hsl(var(--muted))", "hsl(var(--muted-foreground) / 0.3)", "hsl(var(--muted))"],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

export default function AnalyticsLoading() {
  return (
    <motion.div
      className="container mx-auto p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Skeleton */}
      <motion.div variants={itemVariants} className="space-y-2">
        <motion.div
          className="h-8 w-64 rounded-lg"
          animate={pulseAnimation}
        />
        <motion.div
          className="h-4 w-96 rounded-lg"
          animate={pulseAnimation}
        />
      </motion.div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <motion.div key={i} variants={itemVariants} custom={i}>
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <motion.div
                  className="h-4 w-24 rounded"
                  animate={pulseAnimation}
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  className="h-8 w-32 rounded"
                  animate={pulseAnimation}
                />
                <motion.div
                  className="h-3 w-20 rounded"
                  animate={pulseAnimation}
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <motion.div
                className="h-5 w-40 rounded"
                animate={pulseAnimation}
              />
            </CardHeader>
            <CardContent>
              <motion.div
                className="h-[300px] w-full rounded-lg"
                animate={pulseAnimation}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Secondary Charts */}
        {[...Array(2)].map((_, i) => (
          <motion.div key={i} variants={itemVariants} custom={i + 3}>
            <Card className="overflow-hidden">
              <CardHeader>
                <motion.div
                  className="h-5 w-32 rounded"
                  animate={pulseAnimation}
                />
              </CardHeader>
              <CardContent>
                <motion.div
                  className="h-[200px] w-full rounded-lg"
                  animate={pulseAnimation}
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Data Table Skeleton */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <CardHeader>
            <motion.div
              className="h-5 w-48 rounded"
              animate={pulseAnimation}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <motion.div
                  className="h-10 w-10 rounded-full"
                  animate={pulseAnimation}
                />
                <div className="flex-1 space-y-2">
                  <motion.div
                    className="h-4 w-48 rounded"
                    animate={pulseAnimation}
                  />
                  <motion.div
                    className="h-3 w-24 rounded"
                    animate={pulseAnimation}
                  />
                </div>
                <motion.div
                  className="h-8 w-24 rounded"
                  animate={pulseAnimation}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
