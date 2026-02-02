export const pointsVertexShader = `
attribute vec3 color;

uniform float uSize;
uniform float uPixelRatio;
uniform float uMaxPointSize;

varying vec3 vColor;

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float size = uSize * uPixelRatio / max(0.0001, -mvPosition.z);
  if (size > uMaxPointSize) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = size;
}
`;

export const pointsFragmentShader = `
precision highp float;

varying vec3 vColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = dot(coord, coord);
  if (dist > 0.25) {
    discard;
  }
  gl_FragColor = vec4(vColor, 1.0);
}
`;
