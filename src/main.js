import * as THREE from 'three'
import { EffectComposer } from 'postprocessing'
import { RenderPass } from 'postprocessing'
import { EffectPass } from 'postprocessing'
import { BloomEffect } from 'postprocessing'
import { VignetteEffect } from 'postprocessing'
import { NoiseEffect } from 'postprocessing'
import { ChromaticAberrationEffect } from 'postprocessing'
import { ToneMappingEffect } from 'postprocessing'
import { CustomLoadingManager } from './utils/LoadingManager.js'
import { IceBlockGenerator } from './utils/IceBlockGenerator.js'
import { EnvironmentSetup } from './utils/EnvironmentSetup.js'
import { AdvancedTextureLoader } from './utils/TextureLoader.js'
import { TerrainGenerator } from './utils/TerrainGenerator.js'
import { ModelLoader } from './utils/ModelLoader.js'

// Dynamic imports for code splitting
let OrbitControls
let gsap

/**
 * Igloo-Inspired Ice Block Scene
 */
class IglooExperience {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas')
    this.loadingScreen = document.getElementById('loading-screen')
    this.loadingBar = document.querySelector('.loader-bar')
    this.loadingPercentage = document.querySelector('.loading-percentage')
    this.uiOverlay = document.getElementById('ui-overlay')

    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    this.clock = new THREE.Clock()
    this.isReady = false

    // Mouse tracking for parallax effect
    this.mouse = { x: 0, y: 0 }
    this.targetCameraPosition = { x: 4, y: 1.5, z: 7 }  // 3/4 view angle (igloo.inc style)

    // Initialize
    this.initWithLoading()
  }

  async initWithLoading() {
    // Loading manager
    this.loadingManager = new CustomLoadingManager(
      (progress) => this.updateLoadingProgress(progress),
      () => console.log('Assets loaded')
    )

    // Load dependencies
    await this.loadDependencies()

    // Load textures & HDRI
    await this.loadAssets()

    // Initialize scene
    this.init()

    // Complete loading
    await this.loadingManager.simulateProgress(500)
    this.completeLoading()
  }

  async loadAssets() {
    const loader = new AdvancedTextureLoader()

    // Load ice textures (with fallback to procedural)
    this.iceTextures = await loader.loadIceTextures()

    // If no textures, create procedural ones
    if (Object.keys(this.iceTextures).length === 0) {
      this.iceTextures = {
        normal: loader.createProceduralNormalMap(),
        roughness: loader.createProceduralRoughnessMap()
      }
    }

    // Load HDRI (with fallback)
    this.hdriTexture = await loader.loadHDRI()

    // Load 3D igloo model
    const modelLoader = new ModelLoader(this.loadingManager)
    try {
      console.log('📦 Starting to load igloo 3D model...')
      this.iglooModel = await modelLoader.loadIgloo('/models/igloo.glb')
      console.log('✅ Igloo 3D model loaded successfully!')
    } catch (error) {
      console.error('❌ Failed to load 3D model:', error)
      console.error('Error details:', error.message)
      console.warn('⚠️  Will use procedural igloo instead')
      this.iglooModel = null
    }

    await this.loadingManager.simulateProgress(500)
  }

  async loadDependencies() {
    try {
      // Dynamic import OrbitControls
      const controlsModule = await import('three/examples/jsm/controls/OrbitControls')
      OrbitControls = controlsModule.OrbitControls

      // Dynamic import GSAP
      const gsapModule = await import('gsap')
      gsap = gsapModule.default

      await this.loadingManager.simulateProgress(500)
    } catch (error) {
      console.error('Error loading dependencies:', error)
    }
  }

  init() {
    // Scene
    this.scene = new THREE.Scene()

    // Camera (igloo.inc style - 3/4 view angle)
    this.camera = new THREE.PerspectiveCamera(
      50,  // Slightly narrower FOV for more dramatic look
      this.sizes.width / this.sizes.height,
      0.1,
      100
    )
    // Camera positioned to view igloo from front-left 3/4 angle (igloo.inc composition)
    this.camera.position.set(4, 1.5, 7)
    this.scene.add(this.camera)

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    })
    this.renderer.setSize(this.sizes.width, this.sizes.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Environment Setup
    this.envSetup = new EnvironmentSetup(this.scene, this.renderer)
    this.envSetup.setupEnvironment()
    this.envSetup.setupLighting()
    this.envSetup.setupRenderer()

    // Apply HDRI if loaded
    if (this.hdriTexture) {
      console.log('🎨 Applying HDRI to scene...')
      this.scene.background = this.hdriTexture
      this.scene.environment = this.hdriTexture
      console.log('✅ HDRI applied successfully!')
    } else {
      console.log('⚠️  No HDRI - using gradient background')
    }

    // Controls (igloo.inc style - no auto-rotate for scroll experience)
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 4
    this.controls.maxDistance = 20
    this.controls.minPolarAngle = Math.PI / 6
    this.controls.maxPolarAngle = Math.PI / 2 + 0.3
    this.controls.autoRotate = false  // Disabled for scroll-based experience
    this.controls.enabled = false  // Will be controlled by scroll
    this.controls.target.set(0, 0, 0)

    // Create Ice Blocks Scene
    this.createIceScene()

    // Post-processing
    this.setupPostProcessing()

    // Snow particles
    this.snowParticles = this.envSetup.createSnowParticles(800)

    // Event Listeners
    window.addEventListener('resize', () => this.onResize())
    window.addEventListener('mousemove', (e) => this.onMouseMove(e))

    // Start animation
    this.animate()
  }

  onMouseMove(event) {
    // Normalize mouse position to -1 to 1 range
    this.mouse.x = (event.clientX / this.sizes.width) * 2 - 1
    this.mouse.y = -(event.clientY / this.sizes.height) * 2 + 1
  }

  createIceScene() {
    const terrainGen = new TerrainGenerator()
    const modelLoader = new ModelLoader()

    // Use 3D model if loaded, otherwise use procedural
    if (this.iglooModel) {
      console.log('🏠 Using loaded 3D igloo model')

      // Apply ice material to model
      modelLoader.applyIceMaterial(this.iglooModel, this.iceTextures)

      // Scale model to appropriate size (3 units tall)
      modelLoader.scaleModel(this.iglooModel, 3)

      // Position model
      this.iglooModel.position.y = -1.5

      // Rotate igloo so entrance faces side (igloo.inc style - 3/4 view)
      this.iglooModel.rotation.y = Math.PI * 0.25  // 45° rotation (entrance to right)

      this.scene.add(this.iglooModel)
      this.iceStructure = this.iglooModel
    } else {
      console.log('🧊 Using procedural igloo structure')
      const generator = new IceBlockGenerator()
      const { group: iceStructure, blocks: iceBlocks } = generator.createIceStructure(60, this.iceTextures)

      // Rotate procedural igloo too
      iceStructure.rotation.y = Math.PI * 0.25

      this.scene.add(iceStructure)
      this.iceBlocks = iceBlocks
      this.iceStructure = iceStructure
    }

    // Add inner glow light inside igloo (warm orange/yellow glow)
    const innerLight = new THREE.PointLight(0xffa040, 8, 10)
    innerLight.position.set(0, -0.5, 0)  // Inside igloo center
    innerLight.castShadow = false
    this.scene.add(innerLight)

    // Additional soft inner lights for better coverage
    const innerLight2 = new THREE.PointLight(0xffb060, 5, 8)
    innerLight2.position.set(1, -0.8, 0)
    this.scene.add(innerLight2)

    const innerLight3 = new THREE.PointLight(0xffb060, 5, 8)
    innerLight3.position.set(-1, -0.8, 0)
    this.scene.add(innerLight3)

    // NO terrain, mountains, or fog - clean gradient background only
  }

  setupPostProcessing() {
    try {
      this.composer = new EffectComposer(this.renderer)

      // Render pass
      const renderPass = new RenderPass(this.scene, this.camera)
      this.composer.addPass(renderPass)

      // Bloom effect (for ice edge glow - igloo.inc style)
      const bloomEffect = new BloomEffect({
        intensity: 1.2,
        luminanceThreshold: 0.2,
        luminanceSmoothing: 0.9,
        mipmapBlur: true
      })

      // Vignette effect (very subtle - igloo.inc style)
      const vignetteEffect = new VignetteEffect({
        offset: 0.5,
        darkness: 0.4
      })

      // Film grain (cinematic look)
      const noiseEffect = new NoiseEffect({
        premultiply: true
      })
      noiseEffect.blendMode.opacity.value = 0.2

      // Chromatic aberration (subtle color fringing)
      const chromaticEffect = new ChromaticAberrationEffect({
        offset: new THREE.Vector2(0.002, 0.002)
      })

      // Effect pass with working effects
      const effectPass = new EffectPass(
        this.camera,
        bloomEffect,
        vignetteEffect,
        noiseEffect,
        chromaticEffect
      )
      this.composer.addPass(effectPass)

      console.log('✅ Post-processing setup complete')
    } catch (error) {
      console.error('❌ Post-processing error:', error)
      this.composer = null
    }
  }

  updateLoadingProgress(progress) {
    this.loadingBar.style.width = `${progress}%`
    this.loadingPercentage.textContent = `${Math.floor(progress)}%`
  }

  completeLoading() {
    this.isReady = true
    this.hideLoading()
  }

  hideLoading() {
    gsap.to(this.loadingScreen, {
      opacity: 0,
      duration: 1,
      delay: 0.3,
      onComplete: () => {
        this.loadingScreen.style.display = 'none'
        this.showUI()
      }
    })
  }

  showUI() {
    this.uiOverlay.classList.add('visible')
    gsap.fromTo(
      this.uiOverlay,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out' }
    )
  }

  onResize() {
    this.sizes.width = window.innerWidth
    this.sizes.height = window.innerHeight

    this.camera.aspect = this.sizes.width / this.sizes.height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(this.sizes.width, this.sizes.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    if (this.composer) {
      this.composer.setSize(this.sizes.width, this.sizes.height)
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate())

    const elapsedTime = this.clock.getElapsedTime()

    // Mouse parallax effect on camera (igloo.inc style)
    // Calculate target position based on mouse
    this.targetCameraPosition.x = this.mouse.x * 2  // ±2 units horizontal movement
    this.targetCameraPosition.y = 1.5 + this.mouse.y * 1  // ±1 unit vertical movement

    // Smooth lerp camera to target position
    this.camera.position.x += (this.targetCameraPosition.x - this.camera.position.x) * 0.05
    this.camera.position.y += (this.targetCameraPosition.y - this.camera.position.y) * 0.05

    // Always look at center
    this.camera.lookAt(0, 0, 0)

    // Animate igloo (very subtle floating - no rotation to keep structure intact)
    if (this.iceStructure) {
      this.iceStructure.position.y = Math.sin(elapsedTime * 0.2) * 0.05
    }

    // Animate snow
    if (this.snowParticles && this.envSetup) {
      this.envSetup.animateSnow(this.snowParticles)
    }

    // Render with post-processing
    if (this.composer) {
      this.composer.render()
    } else {
      this.renderer.render(this.scene, this.camera)
    }
  }
}

// Initialize
new IglooExperience()
