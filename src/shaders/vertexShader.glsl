varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

uniform float uTime;
uniform float uWaveAmplitude;
uniform float uWaveFrequency;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  // Add wave distortion
  vec3 pos = position;
  float wave = sin(pos.x * uWaveFrequency + uTime) *
               cos(pos.y * uWaveFrequency + uTime) *
               uWaveAmplitude;
  pos.z += wave;

  vPosition = pos;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
