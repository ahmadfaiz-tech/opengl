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
let TransformControls
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
    this.originalCameraPosition = { x: 6, y: 2.5, z: 12 }  // Original 3/4 view angle (further away)
    this.targetCameraPosition = { x: 6, y: 2.5, z: 12 }  // 3/4 view angle (igloo.inc style)

    // Camera lock system
    this.cameraLocked = true
    this.lockedCameraPosition = { x: 6, y: 2.5, z: 12 }  // Default locked position
    this.lockedCameraTarget = { x: 0, y: 0, z: 0 }  // Default look at center

    // Debug mode
    this.debugMode = false
    this.freeRotationMode = false
    this.lastFrameTime = performance.now()
    this.frameCount = 0
    this.fps = 60

    // Selection system
    this.selectedObject = null
    this.selectedObjectName = null  // Track which object is selected
    this.raycaster = new THREE.Raycaster()
    this.mousePointer = new THREE.Vector2()

    // Lighting system
    this.sceneLights = {
      ambient: null,
      directional: [],
      point: [],
      hemisphere: null,
      innerLights: []
    }

    // Lighting intensity multipliers
    this.lightingSettings = {
      global: 1.0,
      ambient: 1.0,
      inner: 1.0
    }

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

    // Load snow mountain model
    try {
      console.log('📦 Starting to load snow mountain model...')
      this.snowMountainModel = await modelLoader.loadIgloo('/models/snowmountain.glb')
      console.log('✅ Snow mountain model loaded successfully!')
    } catch (error) {
      console.error('❌ Failed to load snow mountain model:', error)
      console.warn('⚠️  Will proceed without mountain model')
      this.snowMountainModel = null
    }

    // Load snow mountain model 2 (duplicate)
    try {
      console.log('📦 Starting to load snow mountain 2 model...')
      this.snowMountainModel2 = await modelLoader.loadIgloo('/models/snowmountain.glb')
      console.log('✅ Snow mountain 2 model loaded successfully!')
    } catch (error) {
      console.error('❌ Failed to load snow mountain 2 model:', error)
      console.warn('⚠️  Will proceed without mountain 2 model')
      this.snowMountainModel2 = null
    }

    await this.loadingManager.simulateProgress(500)
  }

  async loadDependencies() {
    try {
      // Dynamic import OrbitControls
      const controlsModule = await import('three/examples/jsm/controls/OrbitControls')
      OrbitControls = controlsModule.OrbitControls

      // Dynamic import TransformControls
      const transformModule = await import('three/examples/jsm/controls/TransformControls')
      TransformControls = transformModule.TransformControls

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

    // Load saved camera position from localStorage or use default
    const savedCamera = this.loadLockedCameraPosition()
    if (savedCamera) {
      this.camera.position.set(savedCamera.position.x, savedCamera.position.y, savedCamera.position.z)
      this.lockedCameraPosition = savedCamera.position
      this.lockedCameraTarget = savedCamera.target
      console.log('✅ Loaded saved camera position:', savedCamera.position)
    } else {
      // Default camera position (igloo.inc composition - front-left 3/4 angle)
      this.camera.position.set(6, 2.5, 12)
      console.log('Using default camera position')
    }

    // Load saved focal length (affects FOV)
    const savedFocalLength = localStorage.getItem('focalLength')
    if (savedFocalLength) {
      const focalLength = parseFloat(savedFocalLength)
      const fov = this.focalLengthToFOV(focalLength)
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
      console.log(`✅ Loaded saved focal length: ${focalLength.toFixed(0)}mm (FOV: ${fov.toFixed(1)}°)`)
    } else {
      console.log('Using default focal length: 43mm (FOV: 50°)')
    }

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
    const lights = this.envSetup.setupLighting()

    // Store light references
    this.sceneLights.ambient = lights.find(l => l.isAmbientLight)
    this.sceneLights.hemisphere = lights.find(l => l.isHemisphereLight)
    this.sceneLights.directional = lights.filter(l => l.isDirectionalLight)
    this.sceneLights.point = lights.filter(l => l.isPointLight)

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
    this.controls.enabled = false  // Will be controlled by scroll/lock state

    // Set target from saved camera data or default
    this.controls.target.set(
      this.lockedCameraTarget.x,
      this.lockedCameraTarget.y,
      this.lockedCameraTarget.z
    )
    this.controls.update()

    // Create Ice Blocks Scene
    this.createIceScene()

    // Post-processing
    this.setupPostProcessing()

    // Snow particles
    this.snowParticles = this.envSetup.createSnowParticles(800)

    // Event Listeners
    window.addEventListener('resize', () => this.onResize())
    window.addEventListener('mousemove', (e) => this.onMouseMove(e))
    window.addEventListener('click', (e) => this.onClick(e))

    // Initialize debug panel
    this.initDebugPanel()

    // Setup selection system
    this.setupSelectionSystem()

    // Start animation
    this.animate()
  }

  onMouseMove(event) {
    // Normalize mouse position to -1 to 1 range
    this.mouse.x = (event.clientX / this.sizes.width) * 2 - 1
    this.mouse.y = -(event.clientY / this.sizes.height) * 2 + 1

    // Update mouse pointer for raycaster
    this.mousePointer.x = (event.clientX / this.sizes.width) * 2 - 1
    this.mousePointer.y = -(event.clientY / this.sizes.height) * 2 + 1
  }

  onClick(event) {
    // Update raycaster with mouse position
    this.raycaster.setFromCamera(this.mousePointer, this.camera)

    // Check intersection with snow mountain first (higher priority)
    if (this.snowMountainModel) {
      const mountainIntersects = this.raycaster.intersectObject(this.snowMountainModel, true)
      if (mountainIntersects.length > 0) {
        this.selectObject(this.snowMountainModel, 'mountain')
        console.log('✓ Snow mountain 1 selected')
        return
      }
    }

    // Check intersection with snow mountain 2
    if (this.snowMountainModel2) {
      const mountain2Intersects = this.raycaster.intersectObject(this.snowMountainModel2, true)
      if (mountain2Intersects.length > 0) {
        this.selectObject(this.snowMountainModel2, 'mountain2')
        console.log('✓ Snow mountain 2 selected')
        return
      }
    }

    // Check intersection with ice ground
    if (this.iceGroundModel) {
      const groundIntersects = this.raycaster.intersectObject(this.iceGroundModel, true)
      if (groundIntersects.length > 0) {
        this.selectObject(this.iceGroundModel, 'ground')
        console.log('✓ Ice ground selected')
        return
      }
    }

    // Clicked on empty space - deselect
    this.deselectObject()
    console.log('✓ Object deselected')
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
      // Check if saved position exists in localStorage
      const savedPosition = this.loadIceGroundPosition()
      if (savedPosition) {
        this.iceGroundModel.position.set(savedPosition.x, savedPosition.y, savedPosition.z)
        console.log('✅ Loaded saved ice ground position:', savedPosition)
      } else {
        this.iceGroundModel.position.y = -5
        console.log('Using default ice ground position')
      }

      this.scene.add(this.iceGroundModel)

      // Setup Transform Controls for ice ground (after it's added to scene)
      this.setupTransformControls()
    } else {
      console.warn('⚠️ Ice ground model not loaded - transform controls will not be available')
    }

    // Add snow mountain model if loaded
    if (this.snowMountainModel) {
      console.log('⛰️ Adding snow mountain model')

      // Apply ice material to mountain
      modelLoader.applyIceMaterial(this.snowMountainModel, this.iceTextures)

      // Load saved position and rotation from localStorage
      const savedData = this.loadMountainTransform()
      if (savedData) {
        this.snowMountainModel.position.set(savedData.position.x, savedData.position.y, savedData.position.z)
        this.snowMountainModel.rotation.set(savedData.rotation.x, savedData.rotation.y, savedData.rotation.z)
        console.log('✅ Loaded saved mountain position:', savedData.position)
        console.log('✅ Loaded saved mountain rotation:', savedData.rotation)
      } else {
        // Default position (behind igloo)
        this.snowMountainModel.position.set(-8, -3, -5)
        console.log('Using default mountain position')
      }

      this.scene.add(this.snowMountainModel)
    } else {
      console.warn('⚠️ Snow mountain model not loaded')
    }

    // Add snow mountain 2 model if loaded
    if (this.snowMountainModel2) {
      console.log('⛰️ Adding snow mountain 2 model')

      // Apply ice material to mountain 2
      modelLoader.applyIceMaterial(this.snowMountainModel2, this.iceTextures)

      // Load saved position and rotation from localStorage
      const savedData2 = this.loadMountain2Transform()
      if (savedData2) {
        this.snowMountainModel2.position.set(savedData2.position.x, savedData2.position.y, savedData2.position.z)
        this.snowMountainModel2.rotation.set(savedData2.rotation.x, savedData2.rotation.y, savedData2.rotation.z)
        console.log('✅ Loaded saved mountain 2 position:', savedData2.position)
        console.log('✅ Loaded saved mountain 2 rotation:', savedData2.rotation)
      } else {
        // Default position (right side, opposite of mountain 1)
        this.snowMountainModel2.position.set(8, -3, -8)
        console.log('Using default mountain 2 position')
      }

      this.scene.add(this.snowMountainModel2)
    } else {
      console.warn('⚠️ Snow mountain 2 model not loaded')
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

    // Add inner glow light inside igloo (warm orange/yellow glow) - reduced intensity
    const innerLight = new THREE.PointLight(0xffa040, 2, 10)
    innerLight.position.set(0, -0.5, 0)  // Inside igloo center
    innerLight.castShadow = false
    innerLight.userData.baseIntensity = 2 // Store base intensity
    this.scene.add(innerLight)
    this.sceneLights.innerLights.push(innerLight)

    // Additional soft inner lights for better coverage - reduced intensity
    const innerLight2 = new THREE.PointLight(0xffb060, 1.5, 8)
    innerLight2.position.set(1, -0.8, 0)
    innerLight2.userData.baseIntensity = 1.5
    this.scene.add(innerLight2)
    this.sceneLights.innerLights.push(innerLight2)

    const innerLight3 = new THREE.PointLight(0xffb060, 1.5, 8)
    innerLight3.position.set(-1, -0.8, 0)
    innerLight3.userData.baseIntensity = 1.5
    this.scene.add(innerLight3)
    this.sceneLights.innerLights.push(innerLight3)

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

  setupTransformControls() {
    console.log('🎯 Setting up Transform Controls...')

    if (!this.iceGroundModel) {
      console.error('❌ Ice ground model not loaded, cannot setup transform controls')
      return
    }

    console.log('✓ Ice ground model found:', this.iceGroundModel)

    // Create TransformControls for ice ground
    this.transformControl = new TransformControls(this.camera, this.renderer.domElement)

    // Set size to make it visible (larger for distant camera)
    this.transformControl.setSize(2)

    // Attach to ice ground model
    this.transformControl.attach(this.iceGroundModel)

    // Set default mode
    this.transformControl.setMode('translate')

    // Start disabled and hidden
    this.transformControl.enabled = false
    this.transformControl.visible = false

    // Set space to world (easier to use)
    this.transformControl.setSpace('world')

    console.log('✓ TransformControl created and attached')

    // Add to scene
    this.scene.add(this.transformControl)
    console.log('✓ TransformControl added to scene')

    // Disable OrbitControls when dragging transform control
    this.transformControl.addEventListener('dragging-changed', (event) => {
      if (this.controls) {
        this.controls.enabled = !event.value
      }
      console.log('Dragging:', event.value)
    })

    // Log changes when transform happens
    this.transformControl.addEventListener('objectChange', () => {
      if (this.iceGroundModel) {
        console.log('Ice Ground Position:', {
          x: this.iceGroundModel.position.x.toFixed(2),
          y: this.iceGroundModel.position.y.toFixed(2),
          z: this.iceGroundModel.position.z.toFixed(2)
        })
      }
    })

    console.log('✅ Transform controls setup complete!')
  }

  setupSelectionSystem() {
    console.log('🎯 Setting up selection system...')

    // Create outline helper (orange line around selected object)
    this.selectionOutline = null

    // Arrow keys movement speed and rotation speed
    this.movementSpeed = 0.1
    this.fastMovementSpeed = 0.5
    this.rotationSpeed = 0.05  // ~3 degrees

    // Keyboard event listener for arrow keys (movement) and numeric keypad (rotation)
    window.addEventListener('keydown', (e) => {
      if (!this.selectedObject) return // Only move/rotate if something is selected

      const speed = e.shiftKey ? this.fastMovementSpeed : this.movementSpeed
      let moved = false
      let rotated = false

      // Arrow keys for movement
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault()
          this.selectedObject.position.y += speed
          moved = true
          console.log('↑ Moving UP')
          break
        case 'ArrowDown':
          e.preventDefault()
          this.selectedObject.position.y -= speed
          moved = true
          console.log('↓ Moving DOWN')
          break
        case 'ArrowLeft':
          e.preventDefault()
          this.selectedObject.position.x -= speed
          moved = true
          console.log('← Moving LEFT')
          break
        case 'ArrowRight':
          e.preventDefault()
          this.selectedObject.position.x += speed
          moved = true
          console.log('→ Moving RIGHT')
          break
      }

      // Numeric keypad for rotation (8=pitch up, 2=pitch down, 4=yaw left, 6=yaw right)
      switch(e.key) {
        case '8':
          e.preventDefault()
          this.selectedObject.rotation.x += this.rotationSpeed
          rotated = true
          console.log('8️⃣ Rotating PITCH UP')
          break
        case '2':
          e.preventDefault()
          this.selectedObject.rotation.x -= this.rotationSpeed
          rotated = true
          console.log('2️⃣ Rotating PITCH DOWN')
          break
        case '4':
          e.preventDefault()
          this.selectedObject.rotation.y += this.rotationSpeed
          rotated = true
          console.log('4️⃣ Rotating YAW LEFT')
          break
        case '6':
          e.preventDefault()
          this.selectedObject.rotation.y -= this.rotationSpeed
          rotated = true
          console.log('6️⃣ Rotating YAW RIGHT')
          break
      }

      if (moved) {
        console.log('New Position:', {
          x: this.selectedObject.position.x.toFixed(2),
          y: this.selectedObject.position.y.toFixed(2),
          z: this.selectedObject.position.z.toFixed(2)
        })
      }

      if (rotated) {
        console.log('New Rotation:', {
          x: THREE.MathUtils.radToDeg(this.selectedObject.rotation.x).toFixed(2) + '°',
          y: THREE.MathUtils.radToDeg(this.selectedObject.rotation.y).toFixed(2) + '°',
          z: THREE.MathUtils.radToDeg(this.selectedObject.rotation.z).toFixed(2) + '°'
        })
      }
    })

    console.log('✅ Selection system setup complete!')
  }

  selectObject(object, objectName) {
    this.selectedObject = object
    this.selectedObjectName = objectName

    // Remove old outline if exists
    if (this.selectionOutline) {
      this.scene.remove(this.selectionOutline)
      this.selectionOutline.geometry.dispose()
      this.selectionOutline.material.dispose()
    }

    // Create orange outline around object
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Create box helper with orange color
    const boxGeometry = new THREE.BoxGeometry(size.x * 1.05, size.y * 1.05, size.z * 1.05)
    const edges = new THREE.EdgesGeometry(boxGeometry)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff8800, linewidth: 3 })
    this.selectionOutline = new THREE.LineSegments(edges, lineMaterial)
    this.selectionOutline.position.copy(center)

    this.scene.add(this.selectionOutline)

    // Update debug panel
    if (this.selectionStateEl) {
      const displayName = objectName === 'mountain' ? 'Mountain 1' :
                          objectName === 'mountain2' ? 'Mountain 2' :
                          'Ice Ground'
      this.selectionStateEl.textContent = displayName
      this.selectionStateEl.style.color = '#ff8800'
    }

    console.log(`✅ ${objectName} selected with orange outline`)
  }

  deselectObject() {
    // Auto-save position when deselecting
    if (this.selectedObjectName === 'ground' && this.iceGroundModel) {
      this.saveIceGroundPosition()
    } else if (this.selectedObjectName === 'mountain' && this.snowMountainModel) {
      this.saveMountainTransform()
    } else if (this.selectedObjectName === 'mountain2' && this.snowMountainModel2) {
      this.saveMountain2Transform()
    }

    this.selectedObject = null
    this.selectedObjectName = null

    // Remove outline
    if (this.selectionOutline) {
      this.scene.remove(this.selectionOutline)
      this.selectionOutline.geometry.dispose()
      this.selectionOutline.material.dispose()
      this.selectionOutline = null
    }

    // Update debug panel
    if (this.selectionStateEl) {
      this.selectionStateEl.textContent = 'No'
      this.selectionStateEl.style.color = '#00ffff'
    }

    console.log('✅ Object deselected')
  }

  saveIceGroundPosition() {
    if (!this.iceGroundModel) return

    const position = {
      x: this.iceGroundModel.position.x,
      y: this.iceGroundModel.position.y,
      z: this.iceGroundModel.position.z
    }

    localStorage.setItem('iceGroundPosition', JSON.stringify(position))
    console.log('💾 Ice ground position saved to localStorage:', position)
  }

  loadIceGroundPosition() {
    const saved = localStorage.getItem('iceGroundPosition')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved position:', e)
        return null
      }
    }
    return null
  }

  resetIceGroundPosition() {
    if (!this.iceGroundModel) return

    // Reset to default position
    this.iceGroundModel.position.set(0, -5, 0)

    // Clear localStorage
    localStorage.removeItem('iceGroundPosition')

    console.log('🔄 Ice ground position reset to default')
  }

  saveMountainTransform() {
    if (!this.snowMountainModel) return

    const transform = {
      position: {
        x: this.snowMountainModel.position.x,
        y: this.snowMountainModel.position.y,
        z: this.snowMountainModel.position.z
      },
      rotation: {
        x: this.snowMountainModel.rotation.x,
        y: this.snowMountainModel.rotation.y,
        z: this.snowMountainModel.rotation.z
      }
    }

    localStorage.setItem('mountainTransform', JSON.stringify(transform))
    console.log('💾 Mountain position & rotation saved to localStorage:', transform)
  }

  loadMountainTransform() {
    const saved = localStorage.getItem('mountainTransform')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved mountain transform:', e)
        return null
      }
    }
    return null
  }

  resetMountainTransform() {
    if (!this.snowMountainModel) return

    // Reset to default position and rotation
    this.snowMountainModel.position.set(-8, -3, -5)
    this.snowMountainModel.rotation.set(0, 0, 0)

    // Clear localStorage
    localStorage.removeItem('mountainTransform')

    console.log('🔄 Mountain transform reset to default')
  }

  saveMountain2Transform() {
    if (!this.snowMountainModel2) return

    const transform = {
      position: {
        x: this.snowMountainModel2.position.x,
        y: this.snowMountainModel2.position.y,
        z: this.snowMountainModel2.position.z
      },
      rotation: {
        x: this.snowMountainModel2.rotation.x,
        y: this.snowMountainModel2.rotation.y,
        z: this.snowMountainModel2.rotation.z
      }
    }

    localStorage.setItem('mountain2Transform', JSON.stringify(transform))
    console.log('💾 Mountain 2 position & rotation saved to localStorage:', transform)
  }

  loadMountain2Transform() {
    const saved = localStorage.getItem('mountain2Transform')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved mountain 2 transform:', e)
        return null
      }
    }
    return null
  }

  resetMountain2Transform() {
    if (!this.snowMountainModel2) return

    // Reset to default position and rotation
    this.snowMountainModel2.position.set(8, -3, -8)
    this.snowMountainModel2.rotation.set(0, 0, 0)

    // Clear localStorage
    localStorage.removeItem('mountain2Transform')

    console.log('🔄 Mountain 2 transform reset to default')
  }

  saveLockedCameraPosition() {
    if (!this.camera) return

    // Get current camera target from OrbitControls
    const target = this.controls ? this.controls.target : new THREE.Vector3(0, 0, 0)

    const cameraData = {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      target: {
        x: target.x,
        y: target.y,
        z: target.z
      }
    }

    localStorage.setItem('lockedCameraPosition', JSON.stringify(cameraData))
    console.log('💾 Locked camera position saved to localStorage:', cameraData)
  }

  loadLockedCameraPosition() {
    const saved = localStorage.getItem('lockedCameraPosition')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved camera position:', e)
        return null
      }
    }
    return null
  }

  toggleCameraLock(locked) {
    this.cameraLocked = locked

    if (!locked) {
      // Unlock - enable free camera movement for adjustment
      console.log('🔓 Camera unlocked - adjust view freely')

      // Enable OrbitControls for camera adjustment
      if (this.controls) {
        this.controls.enabled = true
      }
    } else {
      // Lock - save current position as new home position
      console.log('🔒 Camera locked at current position')

      // Save current camera position as the new locked position
      this.lockedCameraPosition = {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      }

      // Save current camera target
      if (this.controls) {
        this.lockedCameraTarget = {
          x: this.controls.target.x,
          y: this.controls.target.y,
          z: this.controls.target.z
        }
      }

      // Save to localStorage (permanent save)
      this.saveLockedCameraPosition()

      // Disable OrbitControls (camera now fixed at this position)
      if (this.controls) {
        this.controls.enabled = false
      }

      console.log('📍 Locked position:', this.lockedCameraPosition)
      console.log('🎯 Locked target:', this.lockedCameraTarget)
    }
  }

  focalLengthToFOV(focalLength) {
    const sensorWidth = 36 // 35mm full-frame sensor width
    return 2 * Math.atan(sensorWidth / (2 * focalLength)) * (180 / Math.PI)
  }

  fovToFocalLength(fov) {
    const sensorWidth = 36
    return sensorWidth / (2 * Math.tan(fov * Math.PI / 360))
  }

  setupLightingControls() {
    // Get slider elements
    const globalSlider = document.getElementById('global-light-slider')
    const ambientSlider = document.getElementById('ambient-light-slider')
    const innerSlider = document.getElementById('inner-light-slider')

    const globalValue = document.getElementById('global-light-value')
    const ambientValue = document.getElementById('ambient-light-value')
    const innerValue = document.getElementById('inner-light-value')

    const resetLightingBtn = document.getElementById('reset-lighting-btn')

    // Load saved settings
    const saved = this.loadLightingSettings()
    if (saved) {
      this.lightingSettings = saved
      globalSlider.value = saved.global * 100
      ambientSlider.value = saved.ambient * 100
      innerSlider.value = saved.inner * 100
      this.applyLightingSettings()
    }

    // Global light slider
    globalSlider.addEventListener('input', (e) => {
      const value = e.target.value / 100
      globalValue.textContent = `${e.target.value}%`
      this.lightingSettings.global = value
      this.applyLightingSettings()
      this.saveLightingSettings()
    })

    // Ambient light slider
    ambientSlider.addEventListener('input', (e) => {
      const value = e.target.value / 100
      ambientValue.textContent = `${e.target.value}%`
      this.lightingSettings.ambient = value
      this.applyLightingSettings()
      this.saveLightingSettings()
    })

    // Inner light slider
    innerSlider.addEventListener('input', (e) => {
      const value = e.target.value / 100
      innerValue.textContent = `${e.target.value}%`
      this.lightingSettings.inner = value
      this.applyLightingSettings()
      this.saveLightingSettings()
    })

    // Reset lighting button
    if (resetLightingBtn) {
      resetLightingBtn.addEventListener('click', () => {
        this.lightingSettings = { global: 1.0, ambient: 1.0, inner: 1.0 }
        globalSlider.value = 100
        ambientSlider.value = 100
        innerSlider.value = 100
        globalValue.textContent = '100%'
        ambientValue.textContent = '100%'
        innerValue.textContent = '100%'
        this.applyLightingSettings()
        this.saveLightingSettings()
        console.log('🔄 Lighting reset to default')
      })
    }
  }

  applyLightingSettings() {
    // Apply global multiplier to all lights except inner lights
    const globalMult = this.lightingSettings.global
    const ambientMult = this.lightingSettings.ambient
    const innerMult = this.lightingSettings.inner

    // Ambient light
    if (this.sceneLights.ambient) {
      this.sceneLights.ambient.intensity =
        (this.sceneLights.ambient.userData.baseIntensity || 0.2) * globalMult * ambientMult
    }

    // Hemisphere light
    if (this.sceneLights.hemisphere) {
      this.sceneLights.hemisphere.intensity =
        (this.sceneLights.hemisphere.userData.baseIntensity || 0.4) * globalMult
    }

    // Directional lights
    this.sceneLights.directional.forEach(light => {
      if (light.userData.baseIntensity !== undefined) {
        light.intensity = light.userData.baseIntensity * globalMult
      }
    })

    // Point lights (environment)
    this.sceneLights.point.forEach(light => {
      if (light.userData.baseIntensity !== undefined) {
        light.intensity = light.userData.baseIntensity * globalMult
      }
    })

    // Inner lights (separate control)
    this.sceneLights.innerLights.forEach(light => {
      if (light.userData.baseIntensity !== undefined) {
        light.intensity = light.userData.baseIntensity * globalMult * innerMult
      }
    })

    console.log('💡 Lighting updated:', this.lightingSettings)
  }

  saveLightingSettings() {
    localStorage.setItem('lightingSettings', JSON.stringify(this.lightingSettings))
  }

  loadLightingSettings() {
    const saved = localStorage.getItem('lightingSettings')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved lighting settings:', e)
        return null
      }
    }
    return null
  }

  initDebugPanel() {
    this.debugPanel = document.getElementById('debug-panel')
    this.debugMinimizeBtn = document.getElementById('debug-minimize')
    this.debugCloseBtn = document.getElementById('debug-close')
    this.rotationToggle = document.getElementById('rotation-toggle')
    this.cameraLockToggle = document.getElementById('camera-lock-toggle')

    // Debug info elements
    this.cameraPosEl = document.getElementById('camera-pos')
    this.iglooPosEl = document.getElementById('igloo-pos')
    this.groundPosEl = document.getElementById('ground-pos')
    this.mountainPosEl = document.getElementById('mountain-pos')
    this.mountain2PosEl = document.getElementById('mountain2-pos')
    this.fpsCounterEl = document.getElementById('fps-counter')
    this.selectionStateEl = document.getElementById('selection-state')

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

    // Camera lock toggle
    this.cameraLockToggle.addEventListener('change', (e) => {
      this.toggleCameraLock(e.target.checked)
    })

    // Lighting sliders
    this.setupLightingControls()

    // Focal length slider
    const focalLengthSlider = document.getElementById('focal-length-slider')
    const focalLengthValue = document.getElementById('focal-length-value')

    if (focalLengthSlider && focalLengthValue) {
      // Load saved or calculate from current FOV
      const savedFocalLength = localStorage.getItem('focalLength')
      const initialFocalLength = savedFocalLength ? parseFloat(savedFocalLength) :
                                 this.fovToFocalLength(this.camera.fov)

      focalLengthSlider.value = initialFocalLength
      focalLengthValue.textContent = initialFocalLength.toFixed(0) + 'mm'

      focalLengthSlider.addEventListener('input', (e) => {
        const focalLength = parseFloat(e.target.value)
        focalLengthValue.textContent = focalLength.toFixed(0) + 'mm'

        // Convert to FOV and update camera
        const newFOV = this.focalLengthToFOV(focalLength)
        this.camera.fov = newFOV
        this.camera.updateProjectionMatrix()

        // Save to localStorage
        localStorage.setItem('focalLength', focalLength)

        console.log(`📷 Focal length: ${focalLength.toFixed(0)}mm (FOV: ${newFOV.toFixed(1)}°)`)
      })
    }

    // Save/Reset position buttons
    const saveBtn = document.getElementById('save-position-btn')
    const resetBtn = document.getElementById('reset-position-btn')

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveIceGroundPosition()
        alert('✅ Ice ground position saved!')
      })
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset ice ground to default position?')) {
          this.resetIceGroundPosition()
          alert('🔄 Position reset to default!')
        }
      })
    }

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
      // Disable OrbitControls if camera is locked
      if (this.cameraLocked) {
        this.controls.enabled = false
      }

      // Return camera to LOCKED position (not original hardcoded position)
      gsap.to(this.camera.position, {
        x: this.lockedCameraPosition.x,
        y: this.lockedCameraPosition.y,
        z: this.lockedCameraPosition.z,
        duration: 1.2,
        ease: 'power2.inOut',
        onUpdate: () => {
          // Keep camera looking at locked target during transition
          this.camera.lookAt(this.lockedCameraTarget.x, this.lockedCameraTarget.y, this.lockedCameraTarget.z)
        },
        onComplete: () => {
          // Reset target position for parallax to locked position
          this.targetCameraPosition.x = this.lockedCameraPosition.x
          this.targetCameraPosition.y = this.lockedCameraPosition.y
          this.targetCameraPosition.z = this.lockedCameraPosition.z

          // Reset controls target to locked target
          this.controls.target.set(this.lockedCameraTarget.x, this.lockedCameraTarget.y, this.lockedCameraTarget.z)
          this.controls.update()

          console.log('🔒 Parallax mode enabled - camera reset to original view')
        }
      })
    }
  }

  toggleTransformMode(enabled) {
    console.log('🎯 toggleTransformMode called with enabled:', enabled)

    if (!this.transformControl) {
      console.error('❌ Transform controls not available! Check if ice ground model loaded.')
      console.log('Ice ground model:', this.iceGroundModel)
      return
    }

    console.log('✓ Transform control exists:', this.transformControl)

    if (enabled) {
      // Disable rotate mode if enabled
      if (this.rotateToggle && this.rotateToggle.checked) {
        this.rotateToggle.checked = false
        console.log('✓ Disabled rotate mode')
      }

      // Enable transform (position) mode
      this.transformControl.setMode('translate')
      this.transformControl.enabled = true
      this.transformControl.visible = true

      console.log('✅ Transform mode ENABLED - drag arrows to move ice ground')
      console.log('  - Control visible:', this.transformControl.visible)
      console.log('  - Control enabled:', this.transformControl.enabled)
      console.log('  - Control mode:', this.transformControl.mode)
    } else {
      // Disable and hide transform control
      this.transformControl.enabled = false
      this.transformControl.visible = false

      // Log final position
      if (this.iceGroundModel) {
        console.log('💾 Ice Ground Final Position:', {
          x: this.iceGroundModel.position.x.toFixed(2),
          y: this.iceGroundModel.position.y.toFixed(2),
          z: this.iceGroundModel.position.z.toFixed(2)
        })
      }
      console.log('🔒 Transform mode disabled')
    }
  }

  toggleRotateMode(enabled) {
    console.log('🔄 toggleRotateMode called with enabled:', enabled)

    if (!this.transformControl) {
      console.error('❌ Transform controls not available! Check if ice ground model loaded.')
      console.log('Ice ground model:', this.iceGroundModel)
      return
    }

    console.log('✓ Transform control exists:', this.transformControl)

    if (enabled) {
      // Disable transform mode if enabled
      if (this.transformToggle && this.transformToggle.checked) {
        this.transformToggle.checked = false
        console.log('✓ Disabled transform mode')
      }

      // Enable rotate mode
      this.transformControl.setMode('rotate')
      this.transformControl.enabled = true
      this.transformControl.visible = true

      console.log('✅ Rotate mode ENABLED - drag circles to rotate ice ground')
      console.log('  - Control visible:', this.transformControl.visible)
      console.log('  - Control enabled:', this.transformControl.enabled)
      console.log('  - Control mode:', this.transformControl.mode)
    } else {
      // Disable and hide transform control
      this.transformControl.enabled = false
      this.transformControl.visible = false

      // Log final rotation
      if (this.iceGroundModel) {
        console.log('💾 Ice Ground Final Rotation:', {
          x: THREE.MathUtils.radToDeg(this.iceGroundModel.rotation.x).toFixed(2) + '°',
          y: THREE.MathUtils.radToDeg(this.iceGroundModel.rotation.y).toFixed(2) + '°',
          z: THREE.MathUtils.radToDeg(this.iceGroundModel.rotation.z).toFixed(2) + '°'
        })
      }
      console.log('🔒 Rotate mode disabled')
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

    // Update mountain position
    if (this.snowMountainModel) {
      this.mountainPosEl.textContent = `${this.snowMountainModel.position.x.toFixed(2)}, ${this.snowMountainModel.position.y.toFixed(2)}, ${this.snowMountainModel.position.z.toFixed(2)}`
    } else {
      this.mountainPosEl.textContent = 'Not loaded'
    }

    // Update mountain 2 position
    if (this.snowMountainModel2) {
      this.mountain2PosEl.textContent = `${this.snowMountainModel2.position.x.toFixed(2)}, ${this.snowMountainModel2.position.y.toFixed(2)}, ${this.snowMountainModel2.position.z.toFixed(2)}`
    } else {
      this.mountain2PosEl.textContent = 'Not loaded'
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
    if (this.freeRotationMode || !this.cameraLocked) {
      // Free rotation mode OR unlocked camera = OrbitControls active
      this.controls.update()
    } else {
      // Locked = parallax effect (subtle mouse-based camera movement)
      // Calculate target position based on mouse (offset from LOCKED position)
      this.targetCameraPosition.x = this.lockedCameraPosition.x + this.mouse.x * 0.5  // ±0.5 units horizontal
      this.targetCameraPosition.y = this.lockedCameraPosition.y + this.mouse.y * 0.3  // ±0.3 units vertical
      this.targetCameraPosition.z = this.lockedCameraPosition.z  // Keep Z fixed

      // Smooth lerp camera to target position
      this.camera.position.x += (this.targetCameraPosition.x - this.camera.position.x) * 0.05
      this.camera.position.y += (this.targetCameraPosition.y - this.camera.position.y) * 0.05
      this.camera.position.z += (this.targetCameraPosition.z - this.camera.position.z) * 0.05

      // Look at locked target
      this.camera.lookAt(this.lockedCameraTarget.x, this.lockedCameraTarget.y, this.lockedCameraTarget.z)
    }

    // Animate igloo (very subtle floating - no rotation to keep structure intact)
    if (this.iceStructure) {
      this.iceStructure.position.y = Math.sin(elapsedTime * 0.2) * 0.05
    }

    // Animate snow
    if (this.snowParticles && this.envSetup) {
      this.envSetup.animateSnow(this.snowParticles)
    }

    // Update selection outline position (follow selected object)
    if (this.selectionOutline && this.selectedObject) {
      const box = new THREE.Box3().setFromObject(this.selectedObject)
      const center = box.getCenter(new THREE.Vector3())
      this.selectionOutline.position.copy(center)
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
