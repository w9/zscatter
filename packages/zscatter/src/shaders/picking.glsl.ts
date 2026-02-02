export const pickingVertexShader = `
attribute float aId;

uniform float uSize;
uniform float uPixelRatio;
uniform float uMaxPointSize;

varying float vId;

void main() {
  vId = aId;
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

export const pickingFragmentShader = `
precision highp float;

varying float vId;

vec3 encodeId(float id) {
  float r = floor(id / 65536.0);
  float g = floor((id - r * 65536.0) / 256.0);
  float b = mod(id, 256.0);
  return vec3(r, g, b) / 255.0;
}

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = dot(coord, coord);
  if (dist > 0.25) {
    discard;
  }
  vec3 encoded = encodeId(vId);
  gl_FragColor = vec4(encoded, 1.0);
}
`;
