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

    // Debug mode
    this.debugMode = false
    this.freeRotationMode = false
    this.lastFrameTime = performance.now()
    this.frameCount = 0
    this.fps = 60

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

    // Load ice ground model
    try {
      console.log('📦 Starting to load ice ground model...')
      this.iceGroundModel = await modelLoader.loadIgloo('/models/ice_ground.glb')
      console.log('✅ Ice ground model loaded successfully!')
    } catch (error) {
      console.error('❌ Failed to load ice ground model:', error)
      console.warn('⚠️  Will proceed without ground model')
      this.iceGroundModel = null
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

    // Initialize debug panel
    this.initDebugPanel()

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

    // Add ice ground model if loaded
    if (this.iceGroundModel) {
      console.log('🌍 Adding ice ground model')

      // Apply ice material to ground
      modelLoader.applyIceMaterial(this.iceGroundModel, this.iceTextures)

      // Position ground below igloo (lower than igloo base)
      this.iceGroundModel.position.y = -2.5

      this.scene.add(this.iceGroundModel)
    }

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

  initDebugPanel() {
    this.debugPanel = document.getElementById('debug-panel')
    this.debugMinimizeBtn = document.getElementById('debug-minimize')
    this.debugCloseBtn = document.getElementById('debug-close')
    this.rotationToggle = document.getElementById('rotation-toggle')

    // Debug info elements
    this.cameraPosEl = document.getElementById('camera-pos')
    this.iglooPosEl = document.getElementById('igloo-pos')
    this.groundPosEl = document.getElementById('ground-pos')
    this.fpsCounterEl = document.getElementById('fps-counter')

    // Minimize/Maximize
    this.debugMinimizeBtn.addEventListener('click', () => {
      this.debugPanel.classList.toggle('minimized')
      this.debugMinimizeBtn.textContent = this.debugPanel.classList.contains('minimized') ? '+' : '−'
    })

    // Close panel
    this.debugCloseBtn.addEventListener('click', () => {
      this.debugPanel.classList.add('hidden')
    })

    // Rotation toggle
    this.rotationToggle.addEventListener('change', (e) => {
      this.toggleRotationMode(e.target.checked)
    })

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // D key - toggle debug panel
      if (e.key === 'd' || e.key === 'D') {
        this.debugPanel.classList.toggle('hidden')
      }

      // R key - toggle rotation mode
      if (e.key === 'r' || e.key === 'R') {
        this.rotationToggle.checked = !this.rotationToggle.checked
        this.toggleRotationMode(this.rotationToggle.checked)
      }
    })

    // Make panel draggable
    this.makeDraggable(this.debugPanel)
  }

  makeDraggable(element) {
    const header = element.querySelector('.debug-header')
    let isDragging = false
    let currentX
    let currentY
    let initialX
    let initialY

    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('debug-btn')) return

      isDragging = true
      initialX = e.clientX - element.offsetLeft
      initialY = e.clientY - element.offsetTop
    })

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault()
        currentX = e.clientX - initialX
        currentY = e.clientY - initialY

        element.style.left = currentX + 'px'
        element.style.top = currentY + 'px'
        element.style.right = 'auto'
      }
    })

    document.addEventListener('mouseup', () => {
      isDragging = false
    })
  }

  toggleRotationMode(enabled) {
    this.freeRotationMode = enabled

    if (enabled) {
      // Enable OrbitControls for free rotation
      this.controls.enabled = true
      console.log('🔄 Free rotation mode enabled - drag to rotate 360°')
    } else {
      // Disable OrbitControls, use parallax
      this.controls.enabled = false
      console.log('🔒 Parallax mode enabled - hover to view')
    }
  }

  updateDebugInfo() {
    if (this.debugPanel.classList.contains('hidden')) return

    // Update camera position
    this.cameraPosEl.textContent = `${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)}`

    // Update igloo position
    if (this.iceStructure) {
      const baseY = -1.5
      const currentY = this.iceStructure.position.y
      this.iglooPosEl.textContent = `${this.iceStructure.position.x.toFixed(2)}, ${currentY.toFixed(2)} (base: ${baseY}), ${this.iceStructure.position.z.toFixed(2)}`
    }

    // Update ground position
    if (this.iceGroundModel) {
      this.groundPosEl.textContent = `${this.iceGroundModel.position.x.toFixed(2)}, ${this.iceGroundModel.position.y.toFixed(2)}, ${this.iceGroundModel.position.z.toFixed(2)}`
    } else {
      this.groundPosEl.textContent = 'Not loaded'
    }

    // Update FPS
    this.frameCount++
    const now = performance.now()
    const elapsed = now - this.lastFrameTime

    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed)
      this.fpsCounterEl.textContent = this.fps
      this.frameCount = 0
      this.lastFrameTime = now
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate())

    const elapsedTime = this.clock.getElapsedTime()

    // Camera controls based on mode
    if (this.freeRotationMode) {
      // Free rotation mode - OrbitControls handles camera
      this.controls.update()
    } else {
      // Parallax mode - mouse controls camera position
      // Calculate target position based on mouse
      this.targetCameraPosition.x = this.mouse.x * 0.5  // ±0.5 units horizontal movement
      this.targetCameraPosition.y = 1.5 + this.mouse.y * 0.3  // ±0.3 unit vertical movement

      // Smooth lerp camera to target position
      this.camera.position.x += (this.targetCameraPosition.x - this.camera.position.x) * 0.05
      this.camera.position.y += (this.targetCameraPosition.y - this.camera.position.y) * 0.05

      // Always look at center
      this.camera.lookAt(0, 0, 0)
    }

    // Animate igloo (very subtle floating - no rotation to keep structure intact)
    if (this.iceStructure) {
      this.iceStructure.position.y = Math.sin(elapsedTime * 0.2) * 0.05
    }

    // Animate snow
    if (this.snowParticles && this.envSetup) {
      this.envSetup.animateSnow(this.snowParticles)
    }

    // Update debug info
    this.updateDebugInfo()

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
