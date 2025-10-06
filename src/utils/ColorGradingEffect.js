import { Effect } from 'postprocessing'
import { Uniform } from 'three'

/**
 * Color Grading Effect - Adobe Lightroom-style controls
 * Provides professional color grading with highlights/shadows separation
 */

const fragmentShader = /* glsl */`
  uniform float highlights;
  uniform float shadows;
  uniform float whites;
  uniform float blacks;
  uniform float temperature;
  uniform float tint;
  uniform float clarity;

  // Convert RGB to luminance
  float getLuminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  // Smooth highlights/shadows mask
  float getHighlightsMask(float lum) {
    return smoothstep(0.3, 0.7, lum);
  }

  float getShadowsMask(float lum) {
    return smoothstep(0.7, 0.3, lum);
  }

  // Temperature and tint adjustment
  vec3 adjustTemperature(vec3 color, float temp, float tnt) {
    // Temperature: blue (cold) <-> orange (warm)
    vec3 warmColor = color + vec3(temp * 0.3, temp * 0.15, -temp * 0.3);

    // Tint: green <-> magenta
    vec3 tintedColor = warmColor + vec3(tnt * 0.2, -tnt * 0.2, tnt * 0.1);

    return tintedColor;
  }

  // Clarity enhancement (local contrast)
  vec3 adjustClarity(vec3 color, float amount) {
    float lum = getLuminance(color);
    float edge = abs(lum - 0.5) * 2.0;
    return color + (color - vec3(lum)) * edge * amount;
  }

  // Tone curve adjustment
  vec3 adjustTones(vec3 color, float h, float s, float w, float b) {
    float lum = getLuminance(color);

    // Highlights adjustment (affects bright areas)
    float hMask = getHighlightsMask(lum);
    color += color * h * hMask * 0.01;

    // Shadows adjustment (affects dark areas)
    float sMask = getShadowsMask(lum);
    color += color * s * sMask * 0.01;

    // Whites (brightest tones)
    float wMask = smoothstep(0.7, 1.0, lum);
    color += vec3(w * wMask * 0.01);

    // Blacks (darkest tones)
    float bMask = smoothstep(0.3, 0.0, lum);
    color += vec3(b * bMask * 0.01);

    return color;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    // Apply tone adjustments
    color = adjustTones(color, highlights, shadows, whites, blacks);

    // Apply temperature and tint
    color = adjustTemperature(color, temperature, tint);

    // Apply clarity
    color = adjustClarity(color, clarity);

    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);

    outputColor = vec4(color, inputColor.a);
  }
`

export class ColorGradingEffect extends Effect {
  constructor({
    highlights = 0,
    shadows = 0,
    whites = 0,
    blacks = 0,
    temperature = 0,
    tint = 0,
    clarity = 0
  } = {}) {
    super('ColorGradingEffect', fragmentShader, {
      uniforms: new Map([
        ['highlights', new Uniform(highlights)],
        ['shadows', new Uniform(shadows)],
        ['whites', new Uniform(whites)],
        ['blacks', new Uniform(blacks)],
        ['temperature', new Uniform(temperature)],
        ['tint', new Uniform(tint)],
        ['clarity', new Uniform(clarity)]
      ])
    })
  }

  /**
   * Highlights adjustment (-100 to +100)
   */
  set highlights(value) {
    this.uniforms.get('highlights').value = value
  }

  get highlights() {
    return this.uniforms.get('highlights').value
  }

  /**
   * Shadows adjustment (-100 to +100)
   */
  set shadows(value) {
    this.uniforms.get('shadows').value = value
  }

  get shadows() {
    return this.uniforms.get('shadows').value
  }

  /**
   * Whites adjustment (-100 to +100)
   */
  set whites(value) {
    this.uniforms.get('whites').value = value
  }

  get whites() {
    return this.uniforms.get('whites').value
  }

  /**
   * Blacks adjustment (-100 to +100)
   */
  set blacks(value) {
    this.uniforms.get('blacks').value = value
  }

  get blacks() {
    return this.uniforms.get('blacks').value
  }

  /**
   * Temperature adjustment (-1 to +1)
   * Negative = cooler (blue), Positive = warmer (orange)
   */
  set temperature(value) {
    this.uniforms.get('temperature').value = value
  }

  get temperature() {
    return this.uniforms.get('temperature').value
  }

  /**
   * Tint adjustment (-1 to +1)
   * Negative = green, Positive = magenta
   */
  set tint(value) {
    this.uniforms.get('tint').value = value
  }

  get tint() {
    return this.uniforms.get('tint').value
  }

  /**
   * Clarity adjustment (0 to 1)
   */
  set clarity(value) {
    this.uniforms.get('clarity').value = value
  }

  get clarity() {
    return this.uniforms.get('clarity').value
  }
}
