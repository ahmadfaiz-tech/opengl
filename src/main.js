import * as THREE from 'three'
import vertexShader from './shaders/vertexShader.glsl?raw'
import fragmentShader from './shaders/fragmentShader.glsl?raw'
import { CustomLoadingManager, ShaderPreloader } from './utils/LoadingManager.js'

// Dynamic imports for code splitting (igloo.inc optimization technique)
let OrbitControls
let gsap

/**
 * Scene Setup
 */
class WebGLExperience {
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

    // Initialize with progressive loading
    this.initWithLoading()
  }

  async initWithLoading() {
    // Create custom loading manager (igloo.inc technique)
    this.loadingManager = new CustomLoadingManager(
      (progress) => {
        this.updateLoadingProgress(progress)
      },
      () => {
        console.log('All assets loaded')
      }
    )

    // Phase 1: Load critical dependencies (dynamic imports for code splitting)
    await this.loadDependencies()

    // Phase 2: Initialize scene
    this.init()

    // Phase 3: Precompile shaders in background (igloo.inc technique)
    await this.precompileShaders()

    // Phase 4: Complete loading
    this.completeLoading()
  }

  async loadDependencies() {
    try {
      // Dynamic import OrbitControls (lazy load to reduce initial bundle)
      const controlsModule = await import('three/examples/jsm/controls/OrbitControls')
      OrbitControls = controlsModule.OrbitControls

      // Dynamic import GSAP (lazy load animations library)
      const gsapModule = await import('gsap')
      gsap = gsapModule.default

      // Simulate loading progress
      await this.loadingManager.simulateProgress(500)
    } catch (error) {
      console.error('Error loading dependencies:', error)
    }
  }

  async precompileShaders() {
    // Create shader preloader (prevents stuttering on first render)
    const shaderPreloader = new ShaderPreloader(
      this.renderer,
      this.scene,
      this.camera
    )

    // Precompile all materials
    const materials = [this.shaderMaterial]
    await shaderPreloader.precompileMaterials(materials, (progress) => {
      console.log(`Shader compilation: ${progress.toFixed(0)}%`)
    })
  }

  completeLoading() {
    this.isReady = true
    this.hideLoading()
  }

  updateLoadingProgress(progress) {
    this.loadingBar.style.width = `${progress}%`
    this.loadingPercentage.textContent = `${Math.floor(progress)}%`
  }

  init() {
    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)
    this.scene.fog = new THREE.Fog(0x000000, 5, 15)

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.sizes.width / this.sizes.height,
      0.1,
      100
    )
    this.camera.position.set(0, 0, 5)
    this.scene.add(this.camera)

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    })
    this.renderer.setSize(this.sizes.width, this.sizes.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.enableZoom = true
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.5

    // Lights
    this.setupLights()

    // Create 3D Objects
    this.createObjects()

    // Event Listeners
    this.setupEventListeners()

    // Start Animation
    this.animate()
  }

  setupLights() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambientLight)

    // Directional Light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    this.scene.add(directionalLight)

    // Point Lights for dramatic effect
    const pointLight1 = new THREE.PointLight(0x00ffff, 2, 10)
    pointLight1.position.set(-3, 2, 3)
    this.scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0xff00ff, 2, 10)
    pointLight2.position.set(3, -2, 3)
    this.scene.add(pointLight2)
  }

  createObjects() {
    // Custom Shader Material
    this.shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWaveAmplitude: { value: 0.3 },
        uWaveFrequency: { value: 2.0 },
        uColor1: { value: new THREE.Color(0x00ffff) },
        uColor2: { value: new THREE.Color(0xff00ff) },
        uIntensity: { value: 1.0 }
      },
      side: THREE.DoubleSide
    })

    // Main Sphere with custom shader
    const sphereGeometry = new THREE.SphereGeometry(1.5, 128, 128)
    this.mainSphere = new THREE.Mesh(sphereGeometry, this.shaderMaterial)
    this.scene.add(this.mainSphere)

    // Additional decorative objects
    const torusGeometry = new THREE.TorusGeometry(2.5, 0.1, 16, 100)
    const torusMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.5,
      wireframe: true
    })
    this.torus = new THREE.Mesh(torusGeometry, torusMaterial)
    this.scene.add(this.torus)

    // Particles
    this.createParticles()
  }

  createParticles() {
    const particlesGeometry = new THREE.BufferGeometry()
    const particlesCount = 1000

    const positions = new Float32Array(particlesCount * 3)
    const colors = new Float32Array(particlesCount * 3)

    for (let i = 0; i < particlesCount * 3; i += 3) {
      // Position
      positions[i] = (Math.random() - 0.5) * 20
      positions[i + 1] = (Math.random() - 0.5) * 20
      positions[i + 2] = (Math.random() - 0.5) * 20

      // Color
      const color = new THREE.Color()
      color.setHSL(Math.random(), 1.0, 0.5)
      colors[i] = color.r
      colors[i + 1] = color.g
      colors[i + 2] = color.b
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    })

    this.particles = new THREE.Points(particlesGeometry, particlesMaterial)
    this.scene.add(this.particles)
  }


  hideLoading() {
    gsap.to(this.loadingScreen, {
      opacity: 0,
      duration: 1,
      delay: 0.5,
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
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out' }
    )
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onResize())
  }

  onResize() {
    this.sizes.width = window.innerWidth
    this.sizes.height = window.innerHeight

    this.camera.aspect = this.sizes.width / this.sizes.height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(this.sizes.width, this.sizes.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  animate() {
    requestAnimationFrame(() => this.animate())

    const elapsedTime = this.clock.getElapsedTime()

    // Update shader uniforms
    if (this.shaderMaterial) {
      this.shaderMaterial.uniforms.uTime.value = elapsedTime
    }

    // Rotate objects
    if (this.mainSphere) {
      this.mainSphere.rotation.y = elapsedTime * 0.2
      this.mainSphere.rotation.x = Math.sin(elapsedTime * 0.3) * 0.2
    }

    if (this.torus) {
      this.torus.rotation.x = elapsedTime * 0.1
      this.torus.rotation.y = elapsedTime * 0.15
    }

    if (this.particles) {
      this.particles.rotation.y = elapsedTime * 0.05
    }

    // Update controls (only if loaded via dynamic import)
    if (this.controls) {
      this.controls.update()
    }

    // Render
    this.renderer.render(this.scene, this.camera)
  }
}

// Initialize the experience
new WebGLExperience()
