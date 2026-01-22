"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiPiece {
    id: number;
    x: number;
    color: string;
    size: number;
    rotation: number;
}

export function Confetti({ trigger }: { trigger: boolean }) {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

    useEffect(() => {
        if (trigger) {
            const colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#EF4444"];
            const newPieces: ConfettiPiece[] = [];

            for (let i = 0; i < 50; i++) {
                newPieces.push({
                    id: i,
                    x: Math.random() * 100,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    size: Math.random() * 8 + 4,
                    rotation: Math.random() * 360,
                });
            }

            setPieces(newPieces);

            // Clear after animation
            setTimeout(() => setPieces([]), 3000);
        }
    }, [trigger]);

    return (
        <AnimatePresence>
            {pieces.length > 0 && (
                <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
                    {pieces.map((piece) => (
                        <motion.div
                            key={piece.id}
                            initial={{
                                x: `${piece.x}vw`,
                                y: -20,
                                rotate: piece.rotation,
                                opacity: 1,
                            }}
                            animate={{
                                y: "110vh",
                                rotate: piece.rotation + 720,
                                opacity: [1, 1, 0],
                            }}
                            transition={{
                                duration: 3,
                                ease: "easeOut",
                                delay: Math.random() * 0.5,
                            }}
                            style={{
                                position: "absolute",
                                width: piece.size,
                                height: piece.size,
                                backgroundColor: piece.color,
                                borderRadius: Math.random() > 0.5 ? "50%" : "0%",
                            }}
                        />
                    ))}
                </div>
            )}
        </AnimatePresence>
    );
}

export function SuccessAnimation({ show, message }: { show: boolean; message: string }) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ y: 20 }}
                        animate={{ y: 0 }}
                        className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl text-center max-w-md mx-4"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", delay: 0.2 }}
                            className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center"
                        >
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <motion.path
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.5, delay: 0.3 }}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </motion.div>
                        <h2 className="text-2xl font-bold text-green-600 mb-2">Bravo ! 🎉</h2>
                        <p className="text-muted-foreground">{message}</p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
