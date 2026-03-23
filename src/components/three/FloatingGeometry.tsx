"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FloatingShape {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  geometry: "icosahedron" | "octahedron" | "tetrahedron" | "dodecahedron";
  color: THREE.Color;
  floatSpeed: number;
  rotationSpeed: [number, number, number];
  floatOffset: number;
  floatAmplitude: number;
}

interface FloatingGeometryProps {
  count?: number;
  spread?: number;
  colors?: string[];
}

export function FloatingGeometry({
  count = 15,
  spread = 40,
  colors = ["#22d3ee", "#a78bfa", "#f59e0b", "#10b981"],
}: FloatingGeometryProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const shapes = useMemo<FloatingShape[]>(() => {
    const geometries: FloatingShape["geometry"][] = [
      "icosahedron",
      "octahedron",
      "tetrahedron",
      "dodecahedron",
    ];

    return Array.from({ length: count }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = spread * (0.3 + Math.random() * 0.7);

      return {
        position: [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) * 0.5,
          r * Math.cos(phi) - spread * 0.5,
        ] as [number, number, number],
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ] as [number, number, number],
        scale: 0.3 + Math.random() * 0.8,
        geometry: geometries[Math.floor(Math.random() * geometries.length)],
        color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)]),
        floatSpeed: 0.2 + Math.random() * 0.4,
        rotationSpeed: [
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
        ] as [number, number, number],
        floatOffset: Math.random() * Math.PI * 2,
        floatAmplitude: 0.5 + Math.random() * 1.5,
      };
    });
  }, [count, spread, colors]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;

      const shape = shapes[i];
      if (!shape) return;

      // Rotation
      mesh.rotation.x += shape.rotationSpeed[0] * delta;
      mesh.rotation.y += shape.rotationSpeed[1] * delta;
      mesh.rotation.z += shape.rotationSpeed[2] * delta;

      // Floating motion
      mesh.position.y =
        shape.position[1] +
        Math.sin(time * shape.floatSpeed + shape.floatOffset) * shape.floatAmplitude;

      // Subtle horizontal drift
      mesh.position.x =
        shape.position[0] +
        Math.sin(time * shape.floatSpeed * 0.5 + shape.floatOffset) * 0.3;
    });

    // Global group rotation
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.02;
    }
  });

  const getGeometry = (type: FloatingShape["geometry"]) => {
    switch (type) {
      case "icosahedron":
        return <icosahedronGeometry args={[1, 0]} />;
      case "octahedron":
        return <octahedronGeometry args={[1, 0]} />;
      case "tetrahedron":
        return <tetrahedronGeometry args={[1, 0]} />;
      case "dodecahedron":
        return <dodecahedronGeometry args={[1, 0]} />;
      default:
        return <icosahedronGeometry args={[1, 0]} />;
    }
  };

  return (
    <group ref={groupRef}>
      {shapes.map((shape, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
        >
          {getGeometry(shape.geometry)}
          <meshBasicMaterial
            color={shape.color}
            wireframe
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
