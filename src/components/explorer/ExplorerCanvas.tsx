"use client";

import { useRef, useEffect, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  PerspectiveCamera, OrbitControls, 
  Float, ContactShadows, Grid, Text,
  MeshDistortMaterial,
  Stars
} from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { SchoolNodes, GraduationCap3D, Diploma3D } from "./SchoolNodes";

export interface SchoolPoint {
  id: string;
  name: string;
  code: string;
  city: string | null;
  position: [number, number, number];
  type: string;
  level: string;
  studentsCount: number;
  teachersCount: number;
  classesCount: number;
}

interface ExplorerCanvasProps {
  schools: SchoolPoint[];
  selectedId: string | null;
  onSelect: (school: SchoolPoint | null) => void;
}

function AcademicHub() {
  const meshRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.15;
      meshRef.current.rotation.z = t * 0.1;
    }
    if (coreRef.current) {
      coreRef.current.position.y = Math.sin(t * 0.5) * 0.3;
    }
  });

  return (
    <group ref={coreRef} position={[0, 3, 0]}>
      {/* Central Hub Core */}
      <Float speed={3} rotationIntensity={1} floatIntensity={2}>
        <mesh ref={meshRef}>
          <octahedronGeometry args={[2.5, 0]} />
          <MeshDistortMaterial
            color="#1D9E75"
            speed={3}
            distort={0.4}
            radius={1}
            metalness={0.9}
            roughness={0.1}
            emissive="#1D9E75"
            emissiveIntensity={0.5}
          />
        </mesh>
      </Float>

      {/* Rotating Symbols around the hub for global visibility */}
      <Float speed={2} rotationIntensity={2} floatIntensity={1}>
        <group position={[5, 3, 0]}>
          <GraduationCap3D scale={1.5} color="#facc15" />
        </group>
      </Float>
      <Float speed={2.5} rotationIntensity={2} floatIntensity={1}>
        <group position={[-5, -1, 3]}>
          <Diploma3D scale={1.2} color="#3b82f6" />
        </group>
      </Float>
      
      {/* Halo de connaissance */}
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[4, 0.02, 16, 100]} />
        <meshBasicMaterial color="#1D9E75" transparent opacity={0.2} />
      </mesh>

      <Text
        position={[0, -3.5, 0]}
        fontSize={0.5}
        color="#1D9E75"
        anchorX="center"
        anchorY="middle"
        maxWidth={6}
        textAlign="center"
      >
        LE NEXUS ACADÉMIQUE
      </Text>
      <Text
        position={[0, -4.2, 0]}
        fontSize={0.2}
        color="#1D9E75"
        fillOpacity={0.5}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.2}
      >
        L'INTELLIGENCE AU SERVICE DE L'ÉDUCATION
      </Text>
    </group>
  );
}

function KnowledgeParticles() {
  const count = 100;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // eslint-disable-next-line react-hooks/purity
      pos[i * 3] = (Math.random() - 0.5) * 40;
      // eslint-disable-next-line react-hooks/purity
      pos[i * 3 + 1] = Math.random() * 20;
      // eslint-disable-next-line react-hooks/purity
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return pos;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[new Float32Array(), 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#1D9E75"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

export function ExplorerCanvas({ schools, selectedId, onSelect }: ExplorerCanvasProps) {
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useEffect(() => {
    if (selectedId && schools.length > 0) {
      const index = schools.findIndex(s => s.id === selectedId);
      const radius = 18;
      const angle = (index / schools.length) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const camX = Math.cos(angle) * (radius + 12);
      const camZ = Math.sin(angle) * (radius + 12);

      gsap.to(cameraRef.current!.position, {
        x: camX,
        y: 6,
        z: camZ,
        duration: 1.5,
        ease: "expo.inOut"
      });
      
      gsap.to(controlsRef.current!.target, {
        x, y: 2, z,
        duration: 1.5,
        ease: "expo.inOut"
      });
    } else if (!selectedId && cameraRef.current && controlsRef.current) {
      gsap.to(cameraRef.current.position, {
        x: 30, y: 25, z: 30,
        duration: 2,
        ease: "power3.inOut"
      });
      gsap.to(controlsRef.current.target, {
        x: 0, y: 0, z: 0,
        duration: 2,
        ease: "power3.inOut"
      });
    }
  }, [selectedId, schools]);

  return (
    <div style={{ width: '100%', height: '100vh', background: '#020617', position: 'relative' }}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
        <PerspectiveCamera ref={cameraRef} makeDefault position={[30, 25, 30]} fov={40} />
        
        <color attach="background" args={["#020617"]} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <ambientLight intensity={0.6} />
        <pointLight position={[15, 15, 15]} intensity={2} color="#1D9E75" />
        <spotLight position={[20, 40, 20]} angle={0.2} penumbra={1} intensity={3} castShadow />

        <Suspense fallback={null}>
          <AcademicHub />
          <KnowledgeParticles />

          <SchoolNodes 
            schools={schools} 
            selectedId={selectedId} 
            onSelect={onSelect} 
          />

          <ContactShadows 
            position={[0, -0.01, 0]} 
            opacity={0.4} 
            scale={60} 
            blur={2.5} 
            far={10} 
          />
          
          <Grid
            infiniteGrid
            fadeDistance={60}
            fadeStrength={5}
            cellSize={1}
            sectionSize={5}
            sectionColor="#1e293b"
            cellColor="#0f172a"
          />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={true}
          minDistance={10}
          maxDistance={100}
          makeDefault
        />
      </Canvas>
    </div>
  );
}
