import React, { useCallback, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ZScatter, ZScatterChunk } from "@zscatter/zscatter";

const RECORD_SIZE_BYTES = 24;

function decodeChunk(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const recordCount = Math.floor(buffer.byteLength / RECORD_SIZE_BYTES);
  const positions = new Float32Array(recordCount * 3);
  const colors = new Float32Array(recordCount * 3);

  let offset = 0;
  for (let i = 0; i < recordCount; i += 1) {
    positions[i * 3] = view.getFloat32(offset, true);
    positions[i * 3 + 1] = view.getFloat32(offset + 4, true);
    positions[i * 3 + 2] = view.getFloat32(offset + 8, true);

    colors[i * 3] = view.getFloat32(offset + 12, true);
    colors[i * 3 + 1] = view.getFloat32(offset + 16, true);
    colors[i * 3 + 2] = view.getFloat32(offset + 20, true);

    offset += RECORD_SIZE_BYTES;
  }

  return { positions, colors, count: recordCount };
}

async function streamBinary(appendChunk: (chunk: ZScatterChunk) => void, onCount: (n: number) => void) {
  const response = await fetch("/stream");
  if (!response.body) {
    throw new Error("stream response missing body");
  }

  const reader = response.body.getReader();
  let remainder = new Uint8Array(0);

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value || value.length === 0) {
      continue;
    }

    const combined = new Uint8Array(remainder.length + value.length);
    combined.set(remainder, 0);
    combined.set(value, remainder.length);

    const alignedLength =
      Math.floor(combined.length / RECORD_SIZE_BYTES) * RECORD_SIZE_BYTES;

    if (alignedLength > 0) {
      const slice = combined.slice(0, alignedLength);
      const decoded = decodeChunk(slice.buffer);
      appendChunk({ positions: decoded.positions, colors: decoded.colors });
      onCount(decoded.count);
    }

    remainder = combined.slice(alignedLength);
  }
}

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

export function App() {
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("Idle");

  const handleLoadChunk = useCallback((appendChunk: (chunk: ZScatterChunk) => void) => {
    setStatus("Streaming");
    streamBinary(appendChunk, (delta) => setCount((prev: number) => prev + delta))
      .then(() => setStatus("Complete"))
      .catch((error) => {
        console.error(error);
        setStatus("Failed");
      });
  }, []);

  const overlay = useMemo(
    () => (
      <div className="hud">
        <div className="hud-title">ZScatter Streaming Demo</div>
        <div>Status: {status}</div>
        <div>Points: {count.toLocaleString()}</div>
      </div>
    ),
    [count, status]
  );

  return (
    <div className="app">
      {overlay}
      <Canvas camera={{ position: [0, 0, 120], fov: 60 }}>
        <DragRotateControls />
        <ambientLight intensity={0.4} />
        <ZScatter onLoadChunk={handleLoadChunk} pointSize={100} />
      </Canvas>
    </div>
  );
}
