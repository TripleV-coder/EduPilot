"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

const pulseAnimation = {
  background: ["hsl(var(--muted))", "hsl(var(--muted-foreground) / 0.3)", "hsl(var(--muted))"],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

export default function FinanceLoading() {
  return (
    <motion.div
      className="container mx-auto p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-2">
        <motion.div
          className="h-8 w-48 rounded-lg"
          animate={pulseAnimation}
        />
        <motion.div
          className="h-4 w-72 rounded-lg"
          animate={pulseAnimation}
        />
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <motion.div key={i} variants={itemVariants} custom={i}>
            <Card>
              <CardHeader className="pb-2">
                <motion.div
                  className="h-4 w-24 rounded"
                  animate={pulseAnimation}
                />
              </CardHeader>
              <CardContent className="space-y-2">
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <motion.div
                className="h-5 w-48 rounded"
                animate={pulseAnimation}
              />
            </CardHeader>
            <CardContent>
              <motion.div
                className="h-[300px] rounded-lg"
                animate={pulseAnimation}
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <motion.div
                className="h-5 w-32 rounded"
                animate={pulseAnimation}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <motion.div
                    className="h-3 w-3 rounded-full"
                    animate={pulseAnimation}
                  />
                  <motion.div
                    className="h-4 flex-1 rounded"
                    animate={pulseAnimation}
                  />
                  <motion.div
                    className="h-4 w-16 rounded"
                    animate={pulseAnimation}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Transactions Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <motion.div
              className="h-5 w-40 rounded"
              animate={pulseAnimation}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Table header */}
            <div className="flex gap-4 pb-2 border-b">
              {["Date", "Description", "Catégorie", "Montant", "Statut"].map((_, i) => (
                <motion.div
                  key={i}
                  className="h-4 flex-1 rounded"
                  animate={pulseAnimation}
                />
              ))}
            </div>
            {/* Table rows */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center py-2">
                <motion.div
                  className="h-4 flex-1 rounded"
                  animate={pulseAnimation}
                />
                <motion.div
                  className="h-4 flex-1 rounded"
                  animate={pulseAnimation}
                />
                <motion.div
                  className="h-6 w-24 rounded-full"
                  animate={pulseAnimation}
                />
                <motion.div
                  className="h-4 w-20 rounded"
                  animate={pulseAnimation}
                />
                <motion.div
                  className="h-6 w-16 rounded-full"
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
