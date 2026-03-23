"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SchoolPoint } from "./ExplorerCanvas";
import { Html } from "@react-three/drei";
import { cn } from "@/lib/utils";

type SchoolPinsProps = {
  schools: SchoolPoint[];
  onSelect: (school: SchoolPoint | null) => void;
  onHover: (id: string | null) => void;
  selectedId: string | null;
  hoveredId: string | null;
};

export function SchoolPins({
  schools,
  onSelect,
  onHover,
  selectedId,
  hoveredId,
}: SchoolPinsProps) {
  return (
    <group>
      {schools.map((school) => (
        <Pin
          key={school.id}
          school={school}
          position={school.position}
          isSelected={selectedId === school.id}
          isHovered={hoveredId === school.id}
          onClick={() => onSelect(selectedId === school.id ? null : school)}
          onPointerOver={() => onHover(school.id)}
          onPointerOut={() => onHover(null)}
        />
      ))}
    </group>
  );
}

type PinProps = {
  school: SchoolPoint;
  position: [number, number, number];
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
};

function Pin({
  school,
  position,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: PinProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [internalHover, setInternalHover] = useState(false);

  const scale = isSelected ? 1.8 : (isHovered || internalHover) ? 1.5 : 1;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.scale.lerp(
      new THREE.Vector3(scale, scale, scale),
      delta * 10
    );
  });

  const color = isSelected ? "#facc15" : (isHovered || internalHover) ? "#fbbf24" : "#3b82f6";
  const emissive = isSelected || isHovered || internalHover ? color : "#1e3a8a";

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setInternalHover(true);
          onPointerOver();
        }}
        onPointerOut={() => {
          setInternalHover(false);
          onPointerOut();
        }}
      >
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isSelected || isHovered || internalHover ? 1.2 : 0.4}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Pulsing ring for selected/hovered */}
      {(isSelected || isHovered || internalHover) && (
        <mesh rotation-x={Math.PI / 2}>
          <ringGeometry args={[0.15, 0.2, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Label on Hover/Select */}
      {(isSelected || isHovered || internalHover) && (
        <Html distanceFactor={10} position={[0, 0.3, 0]} center>
          <div className={cn(
            "px-2 py-1 rounded border border-white/20 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap pointer-events-none select-none shadow-xl transition-all",
            isSelected ? "scale-110 border-yellow-500/50" : "scale-100"
          )}>
            {school.name}
          </div>
        </Html>
      )}
    </group>
  );
}
