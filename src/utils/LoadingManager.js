import * as THREE from 'three'

/**
 * Custom Loading Manager for progressive asset loading
 * Inspired by igloo.inc's loading strategy
 */
export class CustomLoadingManager {
  constructor(onProgress, onComplete) {
    this.onProgressCallback = onProgress
    this.onCompleteCallback = onComplete
    this.loadedItems = 0
    this.totalItems = 0
    this.loadingStarted = false

    // Create Three.js loading manager
    this.manager = new THREE.LoadingManager(
      // onLoad
      () => {
        if (this.onCompleteCallback) {
          this.onCompleteCallback()
        }
      },
      // onProgress
      (url, itemsLoaded, itemsTotal) => {
        this.loadedItems = itemsLoaded
        this.totalItems = itemsTotal
        const progress = (itemsLoaded / itemsTotal) * 100

        if (this.onProgressCallback) {
          this.onProgressCallback(progress, itemsLoaded, itemsTotal)
        }
      },
      // onError
      (url) => {
        console.error(`Error loading: ${url}`)
      }
    )
  }

  /**
   * Get the Three.js loading manager instance
   */
  getManager() {
    return this.manager
  }

  /**
   * Get current loading progress (0-100)
   */
  getProgress() {
    if (this.totalItems === 0) return 0
    return (this.loadedItems / this.totalItems) * 100
  }

  /**
   * Preload textures in background
   */
  async preloadTextures(texturePaths) {
    const textureLoader = new THREE.TextureLoader(this.manager)
    const promises = texturePaths.map(path => {
      return new Promise((resolve, reject) => {
        textureLoader.load(
          path,
          (texture) => resolve(texture),
          undefined,
          (error) => reject(error)
        )
      })
    })

    try {
      return await Promise.all(promises)
    } catch (error) {
      console.error('Error preloading textures:', error)
      return []
    }
  }

  /**
   * Simulate loading progress for shader compilation
   * (since shaders compile instantly but we want smooth progress)
   */
  simulateProgress(duration = 1000) {
    return new Promise((resolve) => {
      let progress = 0
      const steps = 20
      const interval = duration / steps

      const timer = setInterval(() => {
        progress += 100 / steps

        if (progress >= 100) {
          progress = 100
          clearInterval(timer)
          if (this.onProgressCallback) {
            this.onProgressCallback(progress)
          }
          resolve()
        } else {
          if (this.onProgressCallback) {
            this.onProgressCallback(progress)
          }
        }
      }, interval)
    })
  }
}

/**
 * Shader preloader - compiles shaders in background
 * Prevents frame drops during initial render
 */
export class ShaderPreloader {
  constructor(renderer, scene, camera) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.compiledShaders = new Set()
  }

  /**
   * Precompile shader material
   * This prevents stuttering when shader first appears on screen
   */
  precompileShader(material) {
    if (this.compiledShaders.has(material.uuid)) {
      return // Already compiled
    }

    // Create a temporary object to force shader compilation
    const tempGeometry = new THREE.PlaneGeometry(1, 1)
    const tempMesh = new THREE.Mesh(tempGeometry, material)

    // Add to scene temporarily
    this.scene.add(tempMesh)

    // Force compile by rendering off-screen
    this.renderer.compile(this.scene, this.camera)

    // Remove temporary object
    this.scene.remove(tempMesh)
    tempGeometry.dispose()

    // Mark as compiled
    this.compiledShaders.add(material.uuid)
  }

  /**
   * Precompile multiple materials
   */
  async precompileMaterials(materials, onProgress) {
    const total = materials.length

    for (let i = 0; i < total; i++) {
      this.precompileShader(materials[i])

      if (onProgress) {
        const progress = ((i + 1) / total) * 100
        onProgress(progress)
      }

      // Yield to main thread to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
}
