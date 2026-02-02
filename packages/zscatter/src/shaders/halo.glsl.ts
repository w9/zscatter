export const haloVertexShader = `
attribute float aId;

uniform float uHaloSize;
uniform float uPixelRatio;
uniform float uHoverId;

varying float vVisible;

void main() {
  vVisible = step(0.5, 1.0 - abs(aId - uHoverId));
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uHaloSize * uPixelRatio / max(0.0001, -mvPosition.z) * vVisible;
}
`;

export const haloFragmentShader = `
precision highp float;

varying float vVisible;

void main() {
  if (vVisible < 0.5) {
    discard;
  }
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist <= 0.27777) {
    discard;
  }
  float alpha = pow(smoothstep(0.5, 0.27777, dist), 4.0);
  if (alpha <= 0.001) {
    discard;
  }
  gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}
`;
