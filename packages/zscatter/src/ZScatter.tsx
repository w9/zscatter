import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pointsFragmentShader, pointsVertexShader } from "./shaders/points.glsl";
import { pickingFragmentShader, pickingVertexShader } from "./shaders/picking.glsl";

export type ZScatterStaticData = {
  positions: Float32Array;
  colors: Float32Array;
};

export type ZScatterChunk = {
  positions: Float32Array;
  colors: Float32Array;
};

export type ZScatterPickEvent = {
  id: number | null;
};

export type ZScatterProps = {
  data?: ZScatterStaticData;
  onLoadChunk?: (appendChunk: (chunk: ZScatterChunk) => void) => void;
  pointSize?: number;
  onHover?: (event: ZScatterPickEvent) => void;
  onClick?: (event: ZScatterPickEvent) => void;
  renderLoading?: React.ReactNode;
};

const DEFAULT_POINT_SIZE = 6;

const DEFAULT_RENDER_TARGET_PARAMS = {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
  type: THREE.UnsignedByteType,
  depthBuffer: true,
  stencilBuffer: false
} as const;

function createSequentialIds(count: number, startId: number) {
  const ids = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    ids[i] = startId + i;
  }
  return ids;
}

function nextCapacity(current: number, required: number) {
  if (current >= required) {
    return current;
  }
  return Math.max(required, Math.ceil(current * 1.5 + 1024));
}

export function ZScatter({
  data,
  onLoadChunk,
  pointSize = DEFAULT_POINT_SIZE,
  onHover,
  onClick,
  renderLoading
}: ZScatterProps) {
  const { gl, size, camera } = useThree();
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const pointsRef = useRef<THREE.Points | null>(null);
  const pickingScene = useMemo(() => new THREE.Scene(), []);

  const positionsRef = useRef<Float32Array>(data?.positions ?? new Float32Array(0));
  const colorsRef = useRef<Float32Array>(data?.colors ?? new Float32Array(0));
  const countRef = useRef(
    data ? Math.floor(data.positions.length / 3) : 0
  );
  const capacityRef = useRef(countRef.current);
  const nextIdRef = useRef(countRef.current + 1);
  const idsRef = useRef<Float32Array>(
    createSequentialIds(countRef.current, 1)
  );

  const positionAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const colorAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const idAttrRef = useRef<THREE.BufferAttribute | null>(null);

  const [isLoading, setIsLoading] = useState(
    Boolean(onLoadChunk) && !data
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pointsVertexShader,
        fragmentShader: pointsFragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uSize: { value: pointSize },
          uPixelRatio: { value: gl.getPixelRatio() }
        }
      }),
    [gl, pointSize]
  );

  const pickingMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pickingVertexShader,
        fragmentShader: pickingFragmentShader,
        depthWrite: false,
        uniforms: {
          uSize: { value: pointSize },
          uPixelRatio: { value: gl.getPixelRatio() }
        }
      }),
    [gl, pointSize]
  );

  const pickingTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const readBufferRef = useRef(new Uint8Array(4));
  const lastHoverIdRef = useRef<number | null>(null);
  const hasStartedStreamRef = useRef(false);

  const applyAttributes = useCallback(
    (force: boolean) => {
      const positions = positionsRef.current;
      const colors = colorsRef.current;
      const ids = idsRef.current;

      if (force || !positionAttrRef.current) {
        positionAttrRef.current = new THREE.BufferAttribute(positions, 3);
        positionAttrRef.current.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("position", positionAttrRef.current);
      } else {
        positionAttrRef.current.needsUpdate = true;
      }

      if (force || !colorAttrRef.current) {
        colorAttrRef.current = new THREE.BufferAttribute(colors, 3);
        colorAttrRef.current.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("color", colorAttrRef.current);
      } else {
        colorAttrRef.current.needsUpdate = true;
      }

      if (force || !idAttrRef.current) {
        idAttrRef.current = new THREE.BufferAttribute(ids, 1);
        idAttrRef.current.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("aId", idAttrRef.current);
      } else {
        idAttrRef.current.needsUpdate = true;
      }

      geometry.setDrawRange(0, countRef.current);
    },
    [geometry]
  );

  const appendChunk = useCallback(
    (chunk: ZScatterChunk) => {
      const incomingCount = Math.floor(chunk.positions.length / 3);
      if (incomingCount <= 0) {
        return;
      }
      const requiredCount = countRef.current + incomingCount;
      const nextCapacityCount = nextCapacity(
        capacityRef.current,
        requiredCount
      );
      const needsResize = nextCapacityCount !== capacityRef.current;

      if (needsResize) {
        const nextPositions = new Float32Array(nextCapacityCount * 3);
        nextPositions.set(positionsRef.current);
        positionsRef.current = nextPositions;

        const nextColors = new Float32Array(nextCapacityCount * 3);
        nextColors.set(colorsRef.current);
        colorsRef.current = nextColors;

        const nextIds = new Float32Array(nextCapacityCount);
        nextIds.set(idsRef.current);
        idsRef.current = nextIds;

        capacityRef.current = nextCapacityCount;
      }

      const positionOffset = countRef.current * 3;
      positionsRef.current.set(chunk.positions, positionOffset);
      colorsRef.current.set(chunk.colors, positionOffset);

      const nextIds = idsRef.current;
      for (let i = 0; i < incomingCount; i += 1) {
        nextIds[countRef.current + i] = nextIdRef.current;
        nextIdRef.current += 1;
      }

      countRef.current = requiredCount;
      applyAttributes(needsResize);
      setIsLoading(false);
    },
    [applyAttributes]
  );

  useEffect(() => {
    if (!onLoadChunk) {
      return;
    }
    if (hasStartedStreamRef.current) {
      return;
    }
    hasStartedStreamRef.current = true;
    setIsLoading(true);
    onLoadChunk(appendChunk);
  }, [appendChunk, onLoadChunk]);

  useEffect(() => {
    if (!data) {
      return;
    }
    positionsRef.current = data.positions;
    colorsRef.current = data.colors;
    countRef.current = Math.floor(data.positions.length / 3);
    capacityRef.current = countRef.current;
    nextIdRef.current = countRef.current + 1;
    idsRef.current = createSequentialIds(countRef.current, 1);
    applyAttributes(true);
    setIsLoading(false);
  }, [applyAttributes, data]);

  useEffect(() => {
    const pickingPoints = new THREE.Points(geometry, pickingMaterial);
    pickingPoints.frustumCulled = false;
    pickingScene.add(pickingPoints);
    return () => {
      pickingScene.remove(pickingPoints);
    };
  }, [geometry, pickingMaterial, pickingScene]);

  useEffect(() => {
    if (!pointsRef.current) {
      return;
    }
    pointsRef.current.frustumCulled = false;
  }, []);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    const width = Math.max(1, Math.floor(size.width * pixelRatio));
    const height = Math.max(1, Math.floor(size.height * pixelRatio));
    if (!pickingTargetRef.current) {
      pickingTargetRef.current = new THREE.WebGLRenderTarget(
        width,
        height,
        DEFAULT_RENDER_TARGET_PARAMS
      );
    } else {
      pickingTargetRef.current.setSize(width, height);
    }
  }, [gl, size.height, size.width]);

  useFrame(() => {
    material.uniforms.uSize.value = pointSize;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    pickingMaterial.uniforms.uSize.value = pointSize;
    pickingMaterial.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  const performPick = useCallback(
    (clientX: number, clientY: number) => {
      if (!pickingTargetRef.current || countRef.current === 0) {
        return null;
      }
      const rect = gl.domElement.getBoundingClientRect();
      const pixelRatio = gl.getPixelRatio();
      const x = Math.floor((clientX - rect.left) * pixelRatio);
      const y = Math.floor((rect.height - (clientY - rect.top)) * pixelRatio);
      if (
        x < 0 ||
        y < 0 ||
        x >= pickingTargetRef.current.width ||
        y >= pickingTargetRef.current.height
      ) {
        return null;
      }
      gl.setRenderTarget(pickingTargetRef.current);
      gl.render(pickingScene, camera);
      gl.readRenderTargetPixels(
        pickingTargetRef.current,
        x,
        y,
        1,
        1,
        readBufferRef.current
      );
      gl.setRenderTarget(null);
      const [r, g, b] = readBufferRef.current;
      const id = r * 65536 + g * 256 + b;
      return id === 0 ? null : id;
    },
    [camera, gl, pickingScene]
  );

  useEffect(() => {
    if (!onHover && !onClick) {
      return;
    }
    const canvas = gl.domElement;
    const handleMove = (event: PointerEvent) => {
      if (!onHover) {
        return;
      }
      const id = performPick(event.clientX, event.clientY);
      if (id === lastHoverIdRef.current) {
        return;
      }
      lastHoverIdRef.current = id;
      onHover({ id });
    };
    const handleClick = (event: PointerEvent) => {
      if (!onClick) {
        return;
      }
      const id = performPick(event.clientX, event.clientY);
      onClick({ id });
    };
    canvas.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerdown", handleClick);
    return () => {
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerdown", handleClick);
    };
  }, [gl.domElement, onClick, onHover, performPick]);

  useEffect(() => {
    applyAttributes(true);
  }, [applyAttributes]);

  const loadingOverlay =
    renderLoading ??
    (isLoading ? (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.45, 32]} />
          <meshBasicMaterial color="#9ca3af" transparent opacity={0.7} />
        </mesh>
      </group>
    ) : null);

  return (
    <>
      <points ref={pointsRef} geometry={geometry} material={material} />
      {isLoading ? loadingOverlay : null}
    </>
  );
}
