"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface DataOrb {
  position: [number, number, number];
  radius: number;
  color: THREE.Color;
  orbitRadius: number;
  orbitSpeed: number;
  orbitOffset: number;
  pulseSpeed: number;
  pulseOffset: number;
  ringCount: number;
}

interface DataOrbsProps {
  count?: number;
  spread?: number;
  colors?: string[];
}

export function DataOrbs({
  count = 8,
  spread = 25,
  colors = ["#22d3ee", "#a78bfa", "#10b981"],
}: DataOrbsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const orbRefs = useRef<(THREE.Group | null)[]>([]);

  const orbs = useMemo<DataOrb[]>(() => {
    return Array.from({ length: count }, () => {
      const theta = Math.random() * Math.PI * 2;
      const r = spread * (0.3 + Math.random() * 0.7);

      return {
        position: [
          r * Math.cos(theta),
          (Math.random() - 0.5) * spread * 0.4,
          r * Math.sin(theta) - spread * 0.3,
        ] as [number, number, number],
        radius: 0.3 + Math.random() * 0.5,
        color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)]),
        orbitRadius: 1 + Math.random() * 2,
        orbitSpeed: 0.5 + Math.random() * 1,
        orbitOffset: Math.random() * Math.PI * 2,
        pulseSpeed: 1 + Math.random() * 2,
        pulseOffset: Math.random() * Math.PI * 2,
        ringCount: 2 + Math.floor(Math.random() * 3),
      };
    });
  }, [count, spread, colors]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    orbRefs.current.forEach((orbGroup, i) => {
      if (!orbGroup) return;

      const orb = orbs[i];
      if (!orb) return;

      // Orbit animation
      const orbitAngle = time * orb.orbitSpeed + orb.orbitOffset;
      orbGroup.position.x = orb.position[0] + Math.cos(orbitAngle) * 0.5;
      orbGroup.position.z = orb.position[2] + Math.sin(orbitAngle) * 0.5;

      // Vertical float
      orbGroup.position.y =
        orb.position[1] + Math.sin(time * 0.5 + orb.orbitOffset) * 0.5;

      // Rotation
      orbGroup.rotation.y = time * 0.5;
      orbGroup.rotation.x = Math.sin(time * 0.3 + orb.orbitOffset) * 0.2;
    });

    // Global group rotation
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      {orbs.map((orb, i) => (
        <group
          key={i}
          ref={(el) => {
            orbRefs.current[i] = el;
          }}
          position={orb.position}
        >
          {/* Core sphere */}
          <mesh>
            <sphereGeometry args={[orb.radius * 0.3, 16, 16]} />
            <meshBasicMaterial
              color={orb.color}
              transparent
              opacity={0.8}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          {/* Outer glow */}
          <mesh>
            <sphereGeometry args={[orb.radius * 0.5, 16, 16]} />
            <meshBasicMaterial
              color={orb.color}
              transparent
              opacity={0.2}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Orbital rings */}
          {Array.from({ length: orb.ringCount }).map((_, ringIndex) => {
            const ringRadius = orb.radius * (1 + ringIndex * 0.4);
            const ringRotation = (Math.PI / orb.ringCount) * ringIndex;

            return (
              <mesh key={ringIndex} rotation={[ringRotation, 0, ringRotation * 0.5]}>
                <torusGeometry args={[ringRadius, 0.02, 8, 64]} />
                <meshBasicMaterial
                  color={orb.color}
                  transparent
                  opacity={0.4 - ringIndex * 0.1}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            );
          })}

          {/* Orbiting particles */}
          {Array.from({ length: 3 }).map((_, particleIndex) => {
            const angle = (Math.PI * 2 * particleIndex) / 3;
            const particleRadius = orb.radius * 1.2;

            return (
              <mesh
                key={`particle-${particleIndex}`}
                position={[
                  Math.cos(angle) * particleRadius,
                  0,
                  Math.sin(angle) * particleRadius,
                ]}
              >
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial
                  color={orb.color}
                  transparent
                  opacity={0.9}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}
