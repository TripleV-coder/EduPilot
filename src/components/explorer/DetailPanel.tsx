import { motion, AnimatePresence } from "framer-motion";
import { 
  X, School as SchoolIcon, Users, 
  GraduationCap, BookOpen, MapPin, 
  ExternalLink, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface School {
    id: string;
    name: string;
    code: string;
    city: string | null;
    address: string | null;
    type: string;
    level: string;
    studentsCount: number;
    teachersCount: number;
    classesCount: number;
}

interface DetailPanelProps {
    school: School | null;
    onClose: () => void;
}

const formatEnum = (val: string) => {
    return val.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
};

export function DetailPanel({ school, onClose }: DetailPanelProps) {
    return (
        <AnimatePresence>
            {school && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: "spring", damping: 20, stiffness: 100 }}
                    className="absolute right-6 top-24 z-20 w-80 overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-2xl"
                >
                    {/* Header Image/Pattern */}
                    <div className="relative h-24 bg-gradient-to-br from-primary/20 to-purple-500/20">
                        <div className="absolute inset-0 explorer-grid opacity-20" />
                        <button 
                            onClick={onClose}
                            className="absolute right-4 top-4 rounded-full bg-black/40 p-1.5 text-white/70 transition-colors hover:bg-black/60 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <div className="absolute -bottom-6 left-6 rounded-2xl bg-primary p-3 shadow-lg">
                            <SchoolIcon className="h-6 w-6 text-white" />
                        </div>
                    </div>

                    <div className="p-6 pt-10">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black tracking-tight text-white leading-tight">{school.name}</h3>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                                <Activity className="h-3 w-3" />
                                <span>Code: {school.code}</span>
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-white/40 mt-0.5" />
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase text-white/30 tracking-tighter">Localisation</p>
                                    <p className="text-xs text-white/80">{school.city}{school.address ? `, ${school.address}` : ""}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-2xl bg-white/5 p-3 border border-white/5">
                                    <p className="text-[9px] font-bold uppercase text-white/30 tracking-tighter">Type</p>
                                    <p className="text-xs font-bold text-white mt-0.5">{formatEnum(school.type)}</p>
                                </div>
                                <div className="rounded-2xl bg-white/5 p-3 border border-white/5">
                                    <p className="text-[9px] font-bold uppercase text-white/30 tracking-tighter">Niveau</p>
                                    <p className="text-xs font-bold text-white mt-0.5">{formatEnum(school.level)}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest pl-1">Statistiques Clés</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="flex flex-col items-center justify-center rounded-2xl bg-blue-500/10 p-3 border border-blue-500/20">
                                        <Users className="h-4 w-4 text-blue-400 mb-1" />
                                        <span className="text-xs font-black text-white">{school.studentsCount}</span>
                                        <span className="text-[8px] font-bold text-blue-400/70 uppercase">Élèves</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-500/10 p-3 border border-emerald-500/20">
                                        <GraduationCap className="h-4 w-4 text-emerald-400 mb-1" />
                                        <span className="text-xs font-black text-white">{school.teachersCount}</span>
                                        <span className="text-[8px] font-bold text-emerald-400/70 uppercase">Profs</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center rounded-2xl bg-purple-500/10 p-3 border border-purple-500/20">
                                        <BookOpen className="h-4 w-4 text-purple-400 mb-1" />
                                        <span className="text-xs font-black text-white">{school.classesCount}</span>
                                        <span className="text-[8px] font-bold text-purple-400/70 uppercase">Classes</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button className="mt-8 w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20 gap-2">
                            <span>Accéder au portail</span>
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
