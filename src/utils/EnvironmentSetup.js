import * as THREE from 'three';

/**
 * Environment Setup for Igloo-style Scene
 * Cold, arctic atmosphere with proper lighting
 */
export class EnvironmentSetup {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
  }

  /**
   * Create arctic/winter environment
   */
  setupEnvironment() {
    // Background - cold gradient
    this.scene.background = this.createGradientBackground();

    // Fog - atmospheric depth
    this.scene.fog = new THREE.FogExp2(0xb8d8e8, 0.02);

    // Environment cube for reflections
    this.createEnvironmentCube();
  }

  /**
   * Create gradient background (cold winter sky)
   */
  createGradientBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;

    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 512);

    // Cold winter gradient: light blue to darker blue/grey
    gradient.addColorStop(0, '#d0e8f5');    // Top - light icy blue
    gradient.addColorStop(0.5, '#a8c9dd'); // Middle
    gradient.addColorStop(1, '#7a9db0');    // Bottom - darker blue-grey

    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }

  /**
   * Create environment cube for realistic reflections
   */
  createEnvironmentCube() {
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });

    const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
    this.scene.add(cubeCamera);

    // Create simple environment
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xc8dce8);

    // Update scene environment
    this.scene.environment = cubeRenderTarget.texture;

    return cubeCamera;
  }

  /**
   * Setup dramatic arctic lighting
   */
  setupLighting() {
    const lights = [];

    // 1. Ambient Light - soft overall illumination (reduced)
    const ambient = new THREE.AmbientLight(0xd8e8f0, 0.3);
    this.scene.add(ambient);
    lights.push(ambient);

    // 2. Main Directional Light (sun/moon) - more dramatic
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;

    // Shadow settings
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    dirLight.shadow.bias = -0.0001;

    this.scene.add(dirLight);
    lights.push(dirLight);

    // 3. Fill Light (bounce light from ice/snow)
    const fillLight = new THREE.DirectionalLight(0xa8d5e8, 0.4);
    fillLight.position.set(-5, 3, -5);
    this.scene.add(fillLight);
    lights.push(fillLight);

    // 4. Strong Rim Lights (like igloo.inc - white edge glow) - MORE INTENSE
    const rimLight1 = new THREE.DirectionalLight(0xffffff, 4.0);
    rimLight1.position.set(8, 8, -8);
    this.scene.add(rimLight1);
    lights.push(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0xe0f0ff, 3.0);
    rimLight2.position.set(-6, 6, -10);
    this.scene.add(rimLight2);
    lights.push(rimLight2);

    // 5. Accent Point Lights (strong cyan/blue glow) - reduced
    const pointLight1 = new THREE.PointLight(0x60e8ff, 2.5, 20);
    pointLight1.position.set(-8, 4, 8);
    this.scene.add(pointLight1);
    lights.push(pointLight1);

    const pointLight2 = new THREE.PointLight(0x40d0ff, 2.0, 18);
    pointLight2.position.set(8, 5, -5);
    this.scene.add(pointLight2);
    lights.push(pointLight2);

    // 6. Back Light (strong silhouette - igloo.inc style) - STRONGER
    const backLight = new THREE.DirectionalLight(0xffffff, 5.0);
    backLight.position.set(0, 10, -15);
    this.scene.add(backLight);
    lights.push(backLight);

    // 7. Hemisphere Light (sky and ground)
    const hemiLight = new THREE.HemisphereLight(0xd8f0f8, 0xa0b8c8, 0.8);
    this.scene.add(hemiLight);
    lights.push(hemiLight);

    return lights;
  }

  /**
   * Setup renderer for optimal quality
   */
  setupRenderer() {
    // Enable shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Tone mapping for HDR-like effect
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;

    // Output encoding
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Physical correct lights
    this.renderer.physicallyCorrectLights = true;
  }

  /**
   * Create snow particles effect
   */
  createSnowParticles(count = 500) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random position in a box
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

      // Random fall velocity
      velocities[i] = 0.01 + Math.random() * 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    return particles;
  }

  /**
   * Animate snow particles
   */
  animateSnow(particles) {
    const positions = particles.geometry.attributes.position;
    const velocities = particles.geometry.attributes.velocity;

    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i);
      y -= velocities.array[i];

      // Reset to top when falling below ground
      if (y < -2) {
        y = 20;
      }

      positions.setY(i, y);
    }

    positions.needsUpdate = true;
  }
}
