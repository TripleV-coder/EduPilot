"use client";

import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SchoolPoint } from "./ExplorerCanvas";
import { Html, Float } from "@react-three/drei";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { GraduationCap, BookOpen, Sparkles, Target, Lightbulb, Heart, Quote, Compass } from "lucide-react";

type EducationalNodesProps = {
  schools: SchoolPoint[];
  onSelect: (school: SchoolPoint | null) => void;
  selectedId: string | null;
};

const PEDAGOGICAL_VISIONS = [
  { 
    label: "Excellence", 
    icon: Target, 
    vision: "Rigueur académique et dépassement de soi pour former l'élite de demain.",
    methodology: "Pédagogie par projet & Mentorat",
    color: "text-amber-500",
    glow: "shadow-amber-500/20"
  },
  { 
    label: "Innovation", 
    icon: Lightbulb, 
    vision: "Explorer les nouvelles frontières du savoir à travers le numérique et la créativité.",
    methodology: "Apprentissage Hybride & IA",
    color: "text-blue-500",
    glow: "shadow-blue-500/20"
  },
  { 
    label: "Humanisme", 
    icon: Heart, 
    vision: "Placer l'épanouissement de l'élève au cœur du système éducatif.",
    methodology: "Approche Bienveillante & Sociale",
    color: "text-rose-500",
    glow: "shadow-rose-500/20"
  },
  { 
    label: "Prospective", 
    icon: Compass, 
    vision: "Anticiper les métiers du futur et préparer les élèves aux défis globaux.",
    methodology: "Compétences du XXIe Siècle",
    color: "text-emerald-500",
    glow: "shadow-emerald-500/20"
  },
];

export function SchoolNodes({
  schools,
  onSelect,
  selectedId,
}: EducationalNodesProps) {
  const radius = 18;
  return (
    <group>
      {schools.map((school, i) => {
        const angle = (i / schools.length) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const position: [number, number, number] = [x, 2, z];
        const vision = PEDAGOGICAL_VISIONS[i % PEDAGOGICAL_VISIONS.length];

        return (
          <AcademicCapsule
            key={school.id}
            school={school}
            vision={vision}
            position={position}
            isSelected={selectedId === school.id}
            onClick={() => onSelect(selectedId === school.id ? null : school)}
          />
        );
      })}
    </group>
  );
}

export function GraduationCap3D({ scale = 1, color = "#1D9E75" }: { scale?: number; color?: string }) {
  const capRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (capRef.current) {
      capRef.current.rotation.y += 0.015;
    }
  });

  return (
    <group ref={capRef} scale={scale}>
      {/* Top part of the cap */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.5, 0.1, 1.5]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      {/* Base part */}
      <mesh position={[0, -0.2, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.5, 32]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
      {/* Tassel */}
      <mesh position={[0.7, 0.1, 0.7]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

export function Diploma3D({ scale = 1, color = "#1D9E75" }: { scale?: number; color?: string }) {
  const diplomaRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (diplomaRef.current) {
      diplomaRef.current.rotation.z += 0.01;
      diplomaRef.current.rotation.x += 0.005;
    }
  });

  return (
    <group ref={diplomaRef} scale={scale} rotation={[0, 0, Math.PI / 4]}>
      {/* Rolled paper */}
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.3, 1.8, 32]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      {/* Ribbon */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[0.35, 0.08, 16, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
    </group>
  );
}
function AcademicCapsule({
  school,
  vision,
  position,
  isSelected,
  onClick,
}: {
  school: SchoolPoint;
  vision: typeof PEDAGOGICAL_VISIONS[0];
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      gsap.from(containerRef.current, {
        scale: 0,
        opacity: 0,
        y: 100,
        duration: 1.2,
        delay: Math.random() * 0.8,
        ease: "expo.out"
      });
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        scale: isSelected ? 1.15 : 1,
        borderColor: isSelected ? "#1D9E75" : "rgba(255,255,255,0.1)",
        backgroundColor: isSelected ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.8)",
        duration: 0.4
      });
    }
  }, [isSelected]);

  return (
    <group position={position}>
      {/* Floating 3D Symbols - Better positioning to avoid card overlap */}
      <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
        <group position={[-5, 4, 0]}>
          <GraduationCap3D scale={1.5} />
        </group>
      </Float>
      <Float speed={1.5} rotationIntensity={1.5} floatIntensity={1}>
        <group position={[5, -3, 2]}>
          <Diploma3D scale={1.3} />
        </group>
      </Float>

      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5}>

        <Html distanceFactor={25} center>
          <div 
            ref={containerRef}
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
              "w-80 overflow-hidden rounded-[2.5rem] border bg-slate-950/90 shadow-2xl backdrop-blur-3xl transition-all duration-500 cursor-pointer p-0",
              isSelected ? cn("border-primary ring-1 ring-primary/20", vision.glow) : "border-white/5 hover:border-white/20"
            )}
          >
            {/* Academic Branding */}
            <div className="relative h-40 w-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-black" />
              <div className="absolute inset-0 explorer-grid opacity-20" />
              
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <div className={cn("mb-4 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-transform duration-500", (hovered || isSelected) && "scale-110 rotate-12", vision.color)}>
                  <vision.icon className="w-8 h-8" />
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Pilier Académique</h4>
                <p className="text-lg font-black text-white mt-1 tracking-tight italic">{vision.label}</p>
              </div>

              {/* Status Badge */}
              <div className="absolute top-6 right-6">
                 <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              </div>
            </div>

            {/* Vision Content */}
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary/60">
                   <Quote className="w-4 h-4" />
                   <div className="h-px flex-1 bg-primary/10" />
                </div>
                <h3 className="text-xl font-black text-white leading-tight">{school.name}</h3>
                <p className="text-sm font-medium text-slate-400 leading-relaxed italic">
                  &ldquo;{vision.vision}&rdquo;
                </p>
              </div>

              {/* Methodology */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                   <span>Méthodologie</span>
                   <div className="px-2 py-0.5 rounded bg-primary/10 text-primary">{vision.methodology}</div>
                </div>
                
                <div className="flex items-center gap-2">
                   <div className="flex -space-x-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">
                           <GraduationCap className="w-3 h-3 text-white/40" />
                        </div>
                      ))}
                   </div>
                   <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Accompagnement Personnalisé</span>
                </div>
              </div>

              {/* Navigation Action */}
              <div className={cn(
                "flex items-center justify-center gap-3 text-[11px] font-black uppercase pt-4 transition-all tracking-[0.2em]",
                isSelected || hovered ? "text-primary opacity-100 translate-y-0" : "text-white/10 opacity-0 translate-y-4"
              )}>
                <span>Explorer la Vision</span>
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Html>
      </Float>

      {/* Connection Architecture at bottom */}
      <group position={[0, -2.5, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <ringGeometry args={[1.2, 1.5, 64]} />
          <meshBasicMaterial color={isSelected ? "#1D9E75" : "#1e293b"} transparent opacity={0.2} />
        </mesh>
        {isSelected && (
          <mesh rotation-x={Math.PI / 2}>
            <circleGeometry args={[1.2, 64]} />
            <meshBasicMaterial color="#1D9E75" transparent opacity={0.05} />
          </mesh>
        )}
      </group>
    </group>
  );
}
