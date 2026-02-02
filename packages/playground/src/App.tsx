import React, { useCallback, useMemo, useState } from "react";
import { ZScatterChunk, ZScatterScene } from "@zscatter/zscatter";

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

export function App() {
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const handleLoadChunk = useCallback((appendChunk: (chunk: ZScatterChunk) => void) => {
    setStatus("Streaming");
    streamBinary(appendChunk, (delta) => setCount((prev: number) => prev + delta))
      .then(() => setStatus("Complete"))
      .catch((error) => {
        console.error(error);
        setStatus("Failed");
      });
  }, []);

  const handleHover = useCallback((event: { id: number | null }) => {
    setHoveredId(event.id);
  }, []);

  const overlay = useMemo(
    () => (
      <div className="hud">
        <div className="hud-title">ZScatter Streaming Demo</div>
        <div>Status: {status}</div>
        <div>Points: {count.toLocaleString()}</div>
        <div>
          Hovered: {hoveredId === null ? "—" : hoveredId.toLocaleString()}
        </div>
      </div>
    ),
    [count, hoveredId, status]
  );

  return (
    <div className="app">
      {overlay}
      <ZScatterScene
        onLoadChunk={handleLoadChunk}
        onHover={handleHover}
        pointSize={100}
      />
    </div>
  );
}
