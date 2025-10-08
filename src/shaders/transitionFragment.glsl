varying vec2 vUv;

uniform sampler2D tScene1;      // Current scene texture
uniform sampler2D tScene2;      // Next scene texture
uniform sampler2D tDisplacement; // Noise/displacement map
uniform float uProgress;        // Transition progress (0 to 1)
uniform float uIntensity;       // Displacement intensity

// Noise function for organic effect
float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p){
  vec2 ip = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);

  float res = mix(
    mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
    mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
    u.y
  );
  return res * res;
}

void main() {
  vec2 uv = vUv;

  // Sample displacement map
  vec4 disp = texture2D(tDisplacement, uv);

  // Create organic noise
  float noiseFactor = noise(gl_FragCoord.xy * 0.4);

  // Combine displacement with noise
  float displacement = (disp.r + noiseFactor) * 0.5;

  // Distort UVs based on progress
  vec2 distortedUV1 = vec2(
    uv.x + uProgress * displacement * uIntensity,
    uv.y
  );

  vec2 distortedUV2 = vec2(
    uv.x - (1.0 - uProgress) * displacement * uIntensity,
    uv.y
  );

  // Sample both scenes with distorted UVs
  vec4 scene1Color = texture2D(tScene1, distortedUV1);
  vec4 scene2Color = texture2D(tScene2, distortedUV2);

  // Mix between scenes based on progress
  vec4 finalColor = mix(scene1Color, scene2Color, uProgress);

  gl_FragColor = finalColor;
}
