"use client";

import { motion } from "framer-motion";

export function ExplorerHeader() {
  return (
    <motion.header
      className="fixed left-0 right-0 top-0 z-10 flex items-center justify-between px-6 py-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h1
        className="text-lg font-semibold tracking-tight text-explorer-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        NumSchool Explorer
      </motion.h1>
      <motion.p
        className="hidden text-sm text-explorer-muted sm:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Glissez pour explorer · Cliquez sur un point pour les détails
      </motion.p>
    </motion.header>
  );
}
