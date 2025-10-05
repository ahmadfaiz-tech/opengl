varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uIntensity;

void main() {
  // Create gradient based on position
  float gradient = sin(vUv.x * 3.14159 + uTime * 0.5) *
                   cos(vUv.y * 3.14159 + uTime * 0.3);

  // Mix colors
  vec3 color = mix(uColor1, uColor2, gradient * 0.5 + 0.5);

  // Add lighting effect
  vec3 light = normalize(vec3(1.0, 1.0, 1.0));
  float diffuse = max(dot(vNormal, light), 0.0);

  // Add fresnel effect (rim lighting)
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);

  // Combine effects
  vec3 finalColor = color * (diffuse * 0.5 + 0.5) + fresnel * uColor2 * uIntensity;

  gl_FragColor = vec4(finalColor, 1.0);
}
