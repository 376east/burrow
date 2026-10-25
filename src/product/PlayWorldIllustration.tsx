import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PCFShadowMap } from 'three';
import { Button } from '../components/ui/Button';

function SceneLifecycle({ onLost, angle }: { onLost: () => void; angle: number }) {
  const { gl, camera, invalidate } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  useEffect(() => {
    const radians = Math.PI / 4 + angle * Math.PI / 4;
    camera.position.set(Math.cos(radians) * 21, 12, Math.sin(radians) * 21);
    camera.lookAt(0, 0, 0);
    invalidate();
  }, [angle, camera, invalidate]);
  return null;
}

function Voxel({ position, size = [1, 1, 1], color }: { position: [number, number, number]; size?: [number, number, number]; color: string }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>;
}

function VoxelWorld({ night, biome }: { night: boolean; biome: string }) {
  const snow = biome === 'Снежные вершины';
  const top = snow ? '#e2e8df' : '#7c9c55';
  const ground = [];
  for (let x = -6; x <= 6; x++) for (let z = -4; z <= 4; z++) {
    const water = z > 1 && x < 2;
    const h = water ? -0.5 : Math.round((Math.sin(x * 0.7) + Math.cos(z * 0.8)) * 0.7) * 0.5;
    ground.push(<Voxel key={`${x}:${z}`} position={[x, h - 0.9, z]} size={[1, 1.8, 1]} color={water ? '#568c9c' : '#776451'} />);
    ground.push(<Voxel key={`top${x}:${z}`} position={[x, h + 0.08, z]} size={[1, 0.18, 1]} color={water ? '#6da9ac' : top} />);
  }
  return <><color attach="background" args={[night ? '#172f3b' : '#c6d8ce']} /><fog attach="fog" args={[night ? '#172f3b' : '#c6d8ce', 17, 39]} /><ambientLight intensity={night ? 0.55 : 1.6} /><directionalLight position={[5, 12, 6]} intensity={night ? 0.8 : 3} color={night ? '#a5c0e9' : '#fff0cb'} castShadow shadow-mapSize={[1024, 1024]} />
    <group position={[0, -0.6, 0]}>{ground}{[[-4,-2],[-2,-3],[3,-2],[5,0],[4,3],[-5,0]].map(([x,z], i) => <group key={i} position={[x, 0.7, z]}><Voxel position={[0,1,0]} size={[0.45,2,0.45]} color="#6d5141" /><Voxel position={[0,2.4,0]} size={[1.8,1.4,1.8]} color={snow ? '#769697' : '#416a4d'} /><Voxel position={[0,3.35,0]} size={[1.15,0.65,1.15]} color={snow ? '#dce7de' : '#5f8454'} /></group>)}
    <group position={[1.8,0.7,-0.7]}><Voxel position={[0,0.75,0]} size={[2.4,1.5,2]} color="#bd9468" /><Voxel position={[0,1.65,0]} size={[2.9,0.35,2.5]} color="#664d42" /><Voxel position={[0,2,0]} size={[2.1,0.35,2.5]} color="#77594a" /><Voxel position={[0,2.35,0]} size={[1.3,0.35,2.5]} color="#82614b" /><Voxel position={[0,0.45,1.02]} size={[0.5,1.1,0.06]} color="#58483c" /><Voxel position={[0.8,0.9,1.04]} size={[0.5,0.5,0.07]} color={night ? '#ffd78b' : '#accfd0'} /></group>
    <Voxel position={[-0.2,0.7,1]} size={[0.5,0.25,0.5]} color="#76543c" /><Voxel position={[-0.2,1,1]} size={[0.22,0.45,0.22]} color="#f8b657" /><pointLight position={[-0.2,1.5,1]} intensity={night ? 12 : 2} color="#ffb24b" distance={7} />
    </group><OrbitControls makeDefault enablePan={false} minDistance={12} maxDistance={23} minPolarAngle={0.65} maxPolarAngle={1.25} autoRotate={false} enableDamping={false} />
  </>;
}

export default function PlayWorldIllustration({ fallback, t }: { fallback: ReactNode; t: (key: string) => string }) {
  const [night, setNight] = useState(false);
  const [biome, setBiome] = useState('Зелёная долина');
  const [angle, setAngle] = useState(0);
  const [lost, setLost] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const region = useRef<HTMLDivElement>(null);
  const onLost = useCallback(() => setLost(true), []);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting));
    if (region.current) observer.observe(region.current);
    const change = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', change); };
  }, []);
  if (lost) return fallback;
  return <div className="next-world-illustration" ref={region}>
    <div className="next-world-canvas" role="img" aria-label={t('play_workspace.world_scene_label')}>
      <Canvas shadows={{ type: PCFShadowMap }} camera={{ position: [14, 12, 17], fov: 37 }} dpr={[1, 1.5]}
        frameloop={inViewport && pageVisible ? 'demand' : 'never'} fallback={fallback}
        gl={{ antialias: true, powerPreference: 'low-power' }}>
        <SceneLifecycle onLost={onLost} angle={angle} /><VoxelWorld night={night} biome={biome} />
      </Canvas>
    </div>
    <div className="next-world-controls">
      <Button variant="secondary" size="sm" aria-pressed={night} onClick={() => setNight(!night)}>{t(night ? 'play_workspace.world_day' : 'play_workspace.world_night')}</Button>
      <Button variant="secondary" size="sm" aria-pressed={biome === 'Снежные вершины'} onClick={() => setBiome(biome === 'Снежные вершины' ? 'Зелёная долина' : 'Снежные вершины')}>{t(biome === 'Снежные вершины' ? 'play_workspace.world_green' : 'play_workspace.world_snow')}</Button>
      <Button variant="secondary" size="sm" onClick={() => setAngle(value => (value + 1) % 8)}>{t('play_workspace.world_rotate')}</Button>
    </div>
    <p className="helper-text">{t('play_workspace.world_controls_hint')}</p>
  </div>;
}
