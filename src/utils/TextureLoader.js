import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

/**
 * Advanced Texture & HDRI Loader
 * Handles all asset loading with fallbacks
 */
export class AdvancedTextureLoader {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.rgbeLoader = new RGBELoader();
    this.loadedTextures = {};
  }

  /**
   * Load HDRI environment map
   */
  async loadHDRI(path = '/hdri/arctic_env.hdr') {
    return new Promise((resolve, reject) => {
      console.log('🔍 Attempting to load HDRI:', path);

      this.rgbeLoader.load(
        path,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          console.log('✅ HDRI loaded successfully!');
          resolve(texture);
        },
        (progress) => {
          console.log('📥 HDRI loading progress:', Math.floor((progress.loaded / progress.total) * 100) + '%');
        },
        (error) => {
          console.error('❌ HDRI loading failed:', error);
          console.warn('⚠️  Using fallback gradient background');
          resolve(null); // Fallback to gradient
        }
      );
    });
  }

  /**
   * Load ice texture set (PBR)
   */
  async loadIceTextures() {
    const textures = {};

    try {
      // Try to load all ice texture maps
      const promises = {
        color: this.loadTexture('/textures/ice_color.jpg'),
        normal: this.loadTexture('/textures/ice_normal.jpg'),
        roughness: this.loadTexture('/textures/ice_roughness.jpg'),
        ao: this.loadTexture('/textures/ice_ao.jpg')
      };

      const results = await Promise.allSettled(Object.values(promises));
      const keys = Object.keys(promises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          textures[keys[index]] = result.value;
        }
      });

      return textures;
    } catch (error) {
      console.warn('Ice textures not found, using procedural materials');
      return {};
    }
  }

  /**
   * Load snow/ground textures
   */
  async loadSnowTextures() {
    const textures = {};

    try {
      const promises = {
        color: this.loadTexture('/textures/snow_color.jpg'),
        normal: this.loadTexture('/textures/snow_normal.jpg'),
        roughness: this.loadTexture('/textures/snow_roughness.jpg')
      };

      const results = await Promise.allSettled(Object.values(promises));
      const keys = Object.keys(promises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          textures[keys[index]] = result.value;
        }
      });

      return textures;
    } catch (error) {
      console.warn('Snow textures not found');
      return {};
    }
  }

  /**
   * Load single texture with error handling
   */
  loadTexture(path) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          // Configure texture
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;

          resolve(texture);
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Create procedural ice normal map (fallback)
   */
  createProceduralNormalMap(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Create noise pattern
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % size;
      const y = Math.floor((i / 4) / size);

      // Perlin-like noise approximation
      const noise = Math.random() * 0.3;
      const wave = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.2;

      const value = 128 + (noise + wave) * 127;

      data[i] = value;     // R
      data[i + 1] = value; // G
      data[i + 2] = 255;   // B (up vector)
      data[i + 3] = 255;   // A
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return texture;
  }

  /**
   * Create procedural roughness map (fallback)
   */
  createProceduralRoughnessMap(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Create varied roughness
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Ice is generally smooth but with some rough patches
      const roughness = 20 + Math.random() * 40; // 0.1-0.25 roughness

      data[i] = roughness;
      data[i + 1] = roughness;
      data[i + 2] = roughness;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return texture;
  }
}
