import React, { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ZScatter, ZScatterChunk, ZScatterPickEvent } from "./ZScatter";

export type ZScatterSceneProps = {
  onLoadChunk?: (appendChunk: (chunk: ZScatterChunk) => void) => void;
  pointSize?: number;
  onHover?: (event: ZScatterPickEvent) => void;
  onClick?: (event: ZScatterPickEvent) => void;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  ambientIntensity?: number;
  children?: React.ReactNode;
};

function DragRotateControls() {
  const { camera, gl } = useThree();
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ yaw: 0, pitch: 0 });

  useFrame(() => {
    const radius = camera.position.length();
    const clampedPitch = Math.max(-1.4, Math.min(1.4, rotationRef.current.pitch));
    const yaw = rotationRef.current.yaw;
    const x = radius * Math.cos(clampedPitch) * Math.sin(yaw);
    const y = radius * Math.sin(clampedPitch);
    const z = radius * Math.cos(clampedPitch) * Math.cos(yaw);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  });

  React.useEffect(() => {
    const element = gl.domElement;
    const handleDown = (event: PointerEvent) => {
      draggingRef.current = true;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
    };
    const handleUp = (event: PointerEvent) => {
      draggingRef.current = false;
      element.releasePointerCapture(event.pointerId);
    };
    const handleMove = (event: PointerEvent) => {
      if (!draggingRef.current) {
        return;
      }
      const deltaX = event.clientX - lastPointerRef.current.x;
      const deltaY = event.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };

      const rotationSpeed = 0.005;
      rotationRef.current.yaw -= deltaX * rotationSpeed;
      rotationRef.current.pitch += deltaY * rotationSpeed;
    };
    element.addEventListener("pointerdown", handleDown);
    element.addEventListener("pointerup", handleUp);
    element.addEventListener("pointerleave", handleUp);
    element.addEventListener("pointermove", handleMove);
    return () => {
      element.removeEventListener("pointerdown", handleDown);
      element.removeEventListener("pointerup", handleUp);
      element.removeEventListener("pointerleave", handleUp);
      element.removeEventListener("pointermove", handleMove);
    };
  }, [gl.domElement]);

  return null;
}

export function ZScatterScene({
  onLoadChunk,
  pointSize,
  onHover,
  onClick,
  cameraPosition = [0, 0, 120],
  cameraFov = 60,
  ambientIntensity = 0.4,
  children
}: ZScatterSceneProps) {
  return (
    <Canvas camera={{ position: cameraPosition, fov: cameraFov }}>
      <DragRotateControls />
      <ambientLight intensity={ambientIntensity} />
      <ZScatter
        onLoadChunk={onLoadChunk}
        pointSize={pointSize}
        onHover={onHover}
        onClick={onClick}
      />
      {children}
    </Canvas>
  );
}
