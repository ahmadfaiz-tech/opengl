import * as THREE from 'three'

/**
 * RenderTargetTransition - Handles render-to-texture transitions
 * Based on YouTube tutorial approach
 */
export class RenderTargetTransition {
  constructor(renderer, scene, camera, onPageChange = null, composer = null) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.onPageChange = onPageChange // Callback for page changes
    this.composer = composer // Optional post-processing composer

    // State
    this.currentPage = 0
    this.targetPage = 0
    this.isTransitioning = false
    this.transitionProgress = 0
    this.scrollProgress = 0

    // Pages (each page has objects and render target)
    this.pages = []

    // Render targets
    this.renderTargets = []

    // Transition system
    this.transitionScene = new THREE.Scene()
    this.transitionCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.transitionMaterial = null
    this.transitionQuad = null

    // Displacement texture for organic effect
    this.displacementTexture = this.createProceduralDisplacement() // Fallback
    this.loadCustomDisplacementTexture() // Try to load custom .jpg (async)

    // Scroll settings
    this.scrollSensitivity = 0.001
    this.scrollThreshold = 0.1 // Start transition at 10% scroll (more responsive!)
    this.transitionSpeed = 0.005 // 10x slower for smooth, visible transitions

    // Auto-snap settings (sticky pages)
    this.lastScrollTime = 0
    this.autoSnapDelay = 2000 // Wait 2 seconds after last scroll
    this.snapThreshold = 0.5 // 50% - snap forward if >= 50%, snap back if < 50%

    // Bind methods
    this.onWheel = this.onWheel.bind(this)

    // Timeout fallback: if custom texture takes too long to load, proceed with procedural
    setTimeout(() => {
      if (!this.transitionMaterial) {
        console.log('⏱️ Displacement load timeout - proceeding with current texture')
        this.init()
      }
    }, 1000) // Wait max 1 second

    // init() will be called by loadCustomDisplacementTexture() when texture loads
    // or by timeout if load takes too long
  }

  /**
   * Initialize transition system
   */
  init() {
    // Create transition material
    this.createTransitionMaterial()

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.transitionQuad = new THREE.Mesh(geometry, this.transitionMaterial)
    this.transitionScene.add(this.transitionQuad)

    console.log('✅ RenderTargetTransition initialized')
  }

  /**
   * Load custom displacement texture from .jpg/.jpeg file
   * Put your custom displacement map in: /public/textures/displacement/
   */
  loadCustomDisplacementTexture() {
    const loader = new THREE.TextureLoader()

    // Try to load custom displacement map
    // User can replace this with their own .jpg/.jpeg file!
    const customPath = '/textures/displacement/custom.jpg'

    console.log('🎨 Attempting to load custom displacement map from:', customPath)

    loader.load(
      customPath,
      (texture) => {
        // Success - use custom texture
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping

        this.displacementTexture = texture
        console.log('✅ Custom displacement map loaded!')

        // Initialize material with custom texture
        if (!this.transitionMaterial) {
          console.log('🎬 Creating transition material with custom displacement')
          this.init()
        } else {
          // Material already created (by timeout), update it
          this.transitionMaterial.uniforms.tDisplacement.value = texture
          console.log('✅ Updated existing material with custom displacement')
        }
      },
      undefined,
      (error) => {
        // Failed to load - use procedural fallback (already set in constructor)
        console.log('ℹ️ Custom displacement map not found, using procedural noise')
        console.log('   To use custom: place .jpg file at /public/textures/displacement/custom.jpg')

        // Initialize with procedural fallback
        if (!this.transitionMaterial) {
          console.log('🎬 Creating transition material with procedural displacement')
          this.init()
        }
      }
    )
  }

  /**
   * Create procedural displacement texture (fallback)
   */
  createProceduralDisplacement() {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // Create multi-octave noise
    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4

        // Layered noise
        const noise1 = Math.random()
        const noise2 = Math.random()
        const combined = noise1 * 0.6 + noise2 * 0.4

        const value = Math.floor(combined * 255)

        data[i] = value
        data[i + 1] = value
        data[i + 2] = value
        data[i + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping

    return texture
  }

  /**
   * Create transition material with custom shader (inline shaders)
   */
  createTransitionMaterial() {
    const vertexShader = `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      varying vec2 vUv;

      uniform sampler2D tScene1;
      uniform sampler2D tScene2;
      uniform sampler2D tDisplacement;
      uniform float uProgress;
      uniform float uIntensity;

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

        // Use pure displacement texture (no extra noise)
        // This shows your custom displacement map clearly!
        float displacement = disp.r;

        // Distort UVs based on progress (both X and Y for water caustics effect)
        vec2 distortedUV1 = vec2(
          uv.x + uProgress * displacement * uIntensity,
          uv.y + uProgress * displacement * uIntensity * 0.5
        );

        vec2 distortedUV2 = vec2(
          uv.x - (1.0 - uProgress) * displacement * uIntensity,
          uv.y - (1.0 - uProgress) * displacement * uIntensity * 0.5
        );

        // Sample both scenes with distorted UVs
        vec4 scene1Color = texture2D(tScene1, distortedUV1);
        vec4 scene2Color = texture2D(tScene2, distortedUV2);

        // Mix between scenes based on progress
        vec4 finalColor = mix(scene1Color, scene2Color, uProgress);

        gl_FragColor = finalColor;
      }
    `

    this.transitionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene1: { value: null },
        tScene2: { value: null },
        tDisplacement: { value: this.displacementTexture },
        uProgress: { value: 0.0 },
        uIntensity: { value: 2.0 } // Increased for custom displacement visibility
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false
    })

    console.log('✅ Transition material created')
  }

  /**
   * Register a page
   */
  registerPage(config) {
    const pageIndex = this.pages.length

    // Create render target for this page
    const renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType
      }
    )

    const page = {
      index: pageIndex,
      name: config.name,
      objects: config.objects || [],
      renderTarget: renderTarget,
      background: config.background || null,
      environment: config.environment || null,
      onEnter: config.onEnter || (() => {}),
      onExit: config.onExit || (() => {}),
    }

    this.pages.push(page)
    this.renderTargets.push(renderTarget)

    console.log(`📄 Page registered: ${page.name} (index: ${pageIndex})`)

    return page
  }

  /**
   * Start listening to scroll events
   */
  startListening() {
    window.addEventListener('wheel', this.onWheel, { passive: false })
    console.log('👂 Listening to scroll events')
  }

  /**
   * Handle wheel scroll - controls transition progress in real-time
   */
  onWheel(event) {
    console.log('🎡 Wheel event detected:', event.deltaY)
    event.preventDefault()

    // Track last scroll time for auto-snap behavior
    this.lastScrollTime = Date.now()

    if (!this.isTransitioning) {
      // Not transitioning - accumulate scroll to trigger transition
      this.scrollProgress += event.deltaY * this.scrollSensitivity

      console.log('📊 Scroll progress:', this.scrollProgress.toFixed(3), '/ Threshold:', this.scrollThreshold)

      // Start transition when threshold reached
      if (Math.abs(this.scrollProgress) >= this.scrollThreshold) {
        const direction = this.scrollProgress > 0 ? 1 : -1
        const newPage = this.currentPage + direction

        console.log('🎯 Attempting transition: current =', this.currentPage, 'target =', newPage, 'total pages =', this.pages.length)

        if (newPage >= 0 && newPage < this.pages.length) {
          this.targetPage = newPage
          this.startTransition()
          this.scrollProgress = 0 // Reset to start controlling transition progress
        } else {
          console.log('⚠️ Cannot transition: out of bounds')
          this.scrollProgress = 0
        }
      }
    } else {
      // Already transitioning - user controls transition progress with scroll
      this.scrollProgress += event.deltaY * this.scrollSensitivity

      // Map scroll to transition progress (0 to 1.0 range)
      // Use ABSOLUTE value to handle both forward and reverse scrolling
      const scrollRange = 1.0 // Total scroll distance needed to complete transition
      const absScrollProgress = Math.abs(this.scrollProgress)
      this.transitionProgress = absScrollProgress / scrollRange

      // Clamp to 0-1 range
      this.transitionProgress = Math.max(0, Math.min(1, this.transitionProgress))

      console.log('📊 Transition progress:', (this.transitionProgress * 100).toFixed(1) + '%', 'scroll:', this.scrollProgress.toFixed(3))

      // Check completion
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0
        this.completeTransition()
      }

      // Update shader
      if (this.transitionMaterial) {
        this.transitionMaterial.uniforms.uProgress.value = this.transitionProgress
      }
    }
  }

  /**
   * Start transition
   */
  startTransition() {
    this.isTransitioning = true
    this.transitionProgress = 0

    const fromPage = this.pages[this.currentPage]
    const toPage = this.pages[this.targetPage]

    console.log(`🔄 TRANSITION STARTED: ${fromPage.name} → ${toPage.name}`)
    console.log('🎬 Transition material uniforms:', {
      tScene1: this.transitionMaterial.uniforms.tScene1.value,
      tScene2: this.transitionMaterial.uniforms.tScene2.value,
      tDisplacement: this.transitionMaterial.uniforms.tDisplacement.value,
      uProgress: this.transitionMaterial.uniforms.uProgress.value
    })

    fromPage.onExit()
  }

  /**
   * Render a specific page to its render target
   */
  renderPageToTarget(pageIndex) {
    const page = this.pages[pageIndex]
    if (!page) return

    // Set background and environment for this page
    const originalBackground = this.scene.background
    const originalEnvironment = this.scene.environment

    // ALWAYS explicitly set background and environment (no conditionals!)
    // This prevents background "bleeding" between pages during transitions
    this.scene.background = page.background
    this.scene.environment = page.environment

    // Hide all other pages, but respect user's layer visibility settings
    this.pages.forEach((p, i) => {
      p.objects.forEach(obj => {
        if (i === pageIndex) {
          // Show this page's objects ONLY if user hasn't hidden them
          const userHasHidden = obj.userData && obj.userData.userHidden
          obj.visible = !userHasHidden
        } else {
          // Hide objects from other pages
          obj.visible = false
        }
      })
    })

    // Render to target
    this.renderer.setRenderTarget(page.renderTarget)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // Restore
    this.scene.background = originalBackground
    this.scene.environment = originalEnvironment
  }

  /**
   * Update transition (call in animation loop)
   * Handles auto-snap behavior when user stops scrolling
   */
  update(deltaTime) {
    if (!this.isTransitioning) return

    // Check if user stopped scrolling (sticky/snap behavior)
    const timeSinceScroll = Date.now() - this.lastScrollTime

    if (timeSinceScroll >= this.autoSnapDelay) {
      // User hasn't scrolled for 2 seconds - smoothly snap to nearest page
      const snapSpeed = 0.003 // Very slow snap animation (~5 seconds to complete)

      if (this.transitionProgress >= this.snapThreshold) {
        // >= 50% progress → Smoothly complete to next page
        this.transitionProgress += snapSpeed

        if (this.transitionProgress >= 1.0) {
          this.transitionProgress = 1.0
          this.completeTransition()
          console.log('📍 Snapped FORWARD to next page')
        }
      } else {
        // < 50% progress → Smoothly cancel back to original page
        this.transitionProgress -= snapSpeed

        if (this.transitionProgress <= 0) {
          this.transitionProgress = 0
          this.cancelTransition()
          console.log('📍 Snapped BACK to original page')
        }
      }

      // Update shader during snap animation
      if (this.transitionMaterial) {
        this.transitionMaterial.uniforms.uProgress.value = Math.max(0, Math.min(1, this.transitionProgress))
      }
    }
  }

  /**
   * Complete transition
   */
  completeTransition() {
    const toPage = this.pages[this.targetPage]

    this.currentPage = this.targetPage
    this.isTransitioning = false
    this.transitionProgress = 0

    toPage.onEnter()

    // Notify page change
    if (this.onPageChange) {
      this.onPageChange(this.currentPage)
    }

    console.log(`✅ Transition complete: Now on ${toPage.name}`)
  }

  /**
   * Cancel transition - user scrolled back, revert to original page
   */
  cancelTransition() {
    const fromPage = this.pages[this.currentPage]

    // Reset to original page
    this.isTransitioning = false
    this.transitionProgress = 0
    this.scrollProgress = 0

    console.log(`↩️ Transition cancelled: Staying on ${fromPage.name}`)
  }

  /**
   * Render transition (call instead of normal render during transition)
   */
  render() {
    if (this.isTransitioning) {
      // Render both pages to their render targets
      this.renderPageToTarget(this.currentPage)
      this.renderPageToTarget(this.targetPage)

      // Update transition shader textures
      this.transitionMaterial.uniforms.tScene1.value = this.renderTargets[this.currentPage].texture
      this.transitionMaterial.uniforms.tScene2.value = this.renderTargets[this.targetPage].texture

      // Render transition quad to screen
      this.renderer.setRenderTarget(null)
      this.renderer.clear()
      this.renderer.render(this.transitionScene, this.transitionCamera)
    } else {
      // Normal rendering - render current page directly to screen
      const page = this.pages[this.currentPage]
      if (!page) return

      // Set page background/environment (DON'T restore after - keep it!)
      this.scene.background = page.background
      this.scene.environment = page.environment

      // Show only current page objects (respect user visibility settings)
      this.pages.forEach((p, i) => {
        p.objects.forEach(obj => {
          if (i === this.currentPage) {
            // Show this page's objects ONLY if user hasn't hidden them
            const userHasHidden = obj.userData && obj.userData.userHidden
            obj.visible = !userHasHidden
          } else {
            // Hide objects from other pages
            obj.visible = false
          }
        })
      })

      // Render to screen (with post-processing if composer available)
      this.renderer.setRenderTarget(null)

      if (this.composer) {
        // Use post-processing composer for bloom, FXAA, color grading
        this.composer.render()
      } else {
        // Fallback to direct rendering without post-processing
        this.renderer.clear()
        this.renderer.render(this.scene, this.camera)
      }
    }
  }

  /**
   * Handle window resize
   */
  handleResize(width, height) {
    this.renderTargets.forEach(rt => {
      rt.setSize(width, height)
    })
  }

  /**
   * Dispose
   */
  dispose() {
    window.removeEventListener('wheel', this.onWheel)

    this.renderTargets.forEach(rt => rt.dispose())

    if (this.displacementTexture) {
      this.displacementTexture.dispose()
    }

    if (this.transitionMaterial) {
      this.transitionMaterial.dispose()
    }

    console.log('🗑️ RenderTargetTransition disposed')
  }
}
