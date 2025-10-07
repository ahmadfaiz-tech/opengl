import * as THREE from 'three'

/**
 * LUT (Lookup Table) Generator
 * Generates procedural 3D LUTs for professional color grading
 * Creates 16x16x16 LUTs unwrapped to 256x16 textures
 */
export class LUTGenerator {
  static SIZE = 16  // 16x16x16 cube

  /**
   * Generate identity/neutral LUT (no color changes)
   */
  static generateNeutralLUT() {
    const size = this.SIZE
    const width = size * size
    const height = size
    const data = new Uint8Array(width * height * 4)

    let i = 0
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          data[i++] = Math.floor(r * 255 / (size - 1))
          data[i++] = Math.floor(g * 255 / (size - 1))
          data[i++] = Math.floor(b * 255 / (size - 1))
          data[i++] = 255
        }
      }
    }

    return this.createTexture(data, width, height)
  }

  /**
   * Generate cinematic LUT (film-like, desaturated, lifted blacks)
   */
  static generateCinematicLUT() {
    const size = this.SIZE
    const width = size * size
    const height = size
    const data = new Uint8Array(width * height * 4)

    let i = 0
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          let rNorm = r / (size - 1)
          let gNorm = g / (size - 1)
          let bNorm = b / (size - 1)

          // Apply cinematic color grading
          // 1. Lift blacks (add slight brightness to shadows)
          rNorm = rNorm * 0.9 + 0.1
          gNorm = gNorm * 0.9 + 0.1
          bNorm = bNorm * 0.9 + 0.12  // Slight blue tint in shadows

          // 2. Crush highlights (reduce brightness in highlights)
          rNorm = Math.pow(rNorm, 1.15)
          gNorm = Math.pow(rNorm, 1.15)
          bNorm = Math.pow(bNorm, 1.1)

          // 3. Desaturate (reduce color intensity)
          const lum = rNorm * 0.299 + gNorm * 0.587 + bNorm * 0.114
          rNorm = rNorm * 0.7 + lum * 0.3
          gNorm = gNorm * 0.7 + lum * 0.3
          bNorm = bNorm * 0.7 + lum * 0.3

          // Clamp and store
          data[i++] = Math.floor(Math.min(Math.max(rNorm, 0), 1) * 255)
          data[i++] = Math.floor(Math.min(Math.max(gNorm, 0), 1) * 255)
          data[i++] = Math.floor(Math.min(Math.max(bNorm, 0), 1) * 255)
          data[i++] = 255
        }
      }
    }

    return this.createTexture(data, width, height)
  }

  /**
   * Generate warm LUT (orange/golden tones)
   */
  static generateWarmLUT() {
    const size = this.SIZE
    const width = size * size
    const height = size
    const data = new Uint8Array(width * height * 4)

    let i = 0
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          let rNorm = r / (size - 1)
          let gNorm = g / (size - 1)
          let bNorm = b / (size - 1)

          // Apply warm color shift
          // Boost reds and yellows, reduce blues
          rNorm = Math.pow(rNorm, 0.9) * 1.1   // Boost reds
          gNorm = Math.pow(gNorm, 0.95) * 1.05 // Slight boost greens
          bNorm = Math.pow(bNorm, 1.15) * 0.85 // Reduce blues

          // Clamp and store
          data[i++] = Math.floor(Math.min(Math.max(rNorm, 0), 1) * 255)
          data[i++] = Math.floor(Math.min(Math.max(gNorm, 0), 1) * 255)
          data[i++] = Math.floor(Math.min(Math.max(bNorm, 0), 1) * 255)
          data[i++] = 255
        }
      }
    }

    return this.createTexture(data, width, height)
  }

  /**
   * Generate cool LUT (blue/cyan tones)
   */
  static generateCoolLUT() {
    const size = this.SIZE
    const width = size * size
    const height = size
    const data = new Uint8Array(width * height * 4)

    let i = 0
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          let rNorm = r / (size - 1)
          let gNorm = g / (size - 1)
          let bNorm = b / (size - 1)

          // Apply cool color shift
          // Boost blues and cyans, reduce reds
          rNorm = Math.pow(rNorm, 1.15) * 0.85 // Reduce reds
          gNorm = Math.pow(gNorm, 0.95) * 1.05 // Slight boost greens
          bNorm = Math.pow(bNorm, 0.9) * 1.15  // Boost blues

          // Clamp and store
          data[i++] = Math.floor(Math.min(Math.max(rNorm, 0), 1) * 255)
          data[i++] = Math.floor(Math.min(Math.max(gNorm, 0), 1) * 255)
          data[i++] = Math.floor(Math.min(Math.max(bNorm, 0), 1) * 255)
          data[i++] = 255
        }
      }
    }

    return this.createTexture(data, width, height)
  }

  /**
   * Generate vibrant LUT (increased saturation)
   */
  static generateVibrantLUT() {
    const size = this.SIZE
    const width = size * size
    const height = size
    const data = new Uint8Array(width * height * 4)

    let i = 0
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          let rNorm = r / (size - 1)
          let gNorm = g / (size - 1)
          let bNorm = b / (size - 1)

          // Increase saturation
          const lum = rNorm * 0.299 + gNorm * 0.587 + bNorm * 0.114
          const saturation = 1.4  // 40% more saturated

          rNorm = lum + (rNorm - lum) * saturation
          gNorm = lum + (gNorm - lum) * saturation
          bNorm = lum + (bNorm - lum) * saturation

          // Slight contrast boost
          rNorm = Math.pow(rNorm, 0.95)
          gNorm = Math.pow(gNorm, 0.95)
          bNorm = Math.pow(bNorm, 0.95)

          // Clamp and store
          data[i++] = Math.floor(Math.min(Math.max(rNorm, 0), 1) * 255)
          data[i++] = Math.floor(Math.min(Math.max(gNorm, 0), 1) * 255)
          data[i++] = Math.floor(Math.min(Math.max(bNorm, 0), 1) * 255)
          data[i++] = 255
        }
      }
    }

    return this.createTexture(data, width, height)
  }

  /**
   * Create THREE.DataTexture from LUT data
   */
  static createTexture(data, width, height) {
    const texture = new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )

    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.generateMipmaps = false
    texture.needsUpdate = true

    return texture
  }
}
