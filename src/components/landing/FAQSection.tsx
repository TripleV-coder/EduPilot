"use client";

import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { HelpCircle } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeader } from "./SectionHeader";

const faqKeys = ["q1", "q2", "q3", "q4", "q5", "q6"];

export function FAQSection() {
    return (
        <section id="faq" className="py-24 md:py-40 bg-white dark:bg-slate-950 relative overflow-hidden">
            {/* Ambient decorative elements */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <SectionHeader
                    badgeIcon={HelpCircle}
                    badgeText={t("landing.faq.badge")}
                    title={t("landing.faq.title")}
                    subtitle={t("landing.faq.subtitle")}
                />

                <motion.div
                    className="max-w-3xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: 0.15 }}
                >
                    <Accordion type="single" collapsible className="space-y-4">
                        {faqKeys.map((key, idx) => (
                            <AccordionItem
                                key={key}
                                value={key}
                                className="border border-slate-200/60 dark:border-white/5 rounded-2xl px-6 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl data-[state=open]:border-primary/30 data-[state=open]:shadow-xl data-[state=open]:shadow-primary/5 transition-all duration-300 overflow-hidden"
                            >
                                <AccordionTrigger className="hover:no-underline text-left font-heading font-bold text-slate-900 dark:text-white py-6 text-base group cursor-pointer">
                                    <span className="group-hover:text-primary transition-colors">{t(`landing.faq.questions.${key}`)}</span>
                                </AccordionTrigger>
                                <AccordionContent className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed pb-6 font-body">
                                    {t(`landing.faq.questions.a${key.slice(1)}`)}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </motion.div>
            </div>
        </section>
    );
}
