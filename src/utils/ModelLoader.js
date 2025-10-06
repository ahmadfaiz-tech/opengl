import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

/**
 * 3D Model Loader for GLTF/GLB files
 * Handles loading external 3D models with material application
 */
export class ModelLoader {
  constructor(loadingManager = null) {
    // Make loadingManager optional
    if (loadingManager) {
      // If CustomLoadingManager, get the internal THREE.LoadingManager
      const manager = loadingManager.getManager ? loadingManager.getManager() : loadingManager;
      this.loader = new GLTFLoader(manager);
    } else {
      this.loader = new GLTFLoader();
    }
    this.loadedModels = {};
  }

  /**
   * Load igloo 3D model
   */
  async loadIgloo(path = '/models/igloo.glb', iceMaterial = null) {
    return new Promise((resolve, reject) => {
      console.log('🔍 Loading igloo model from:', path);

      this.loader.load(
        path,
        (gltf) => {
          console.log('✅ Igloo model loaded successfully!');
          console.log('GLTF object:', gltf);
          const model = gltf.scene;
          console.log('Model scene:', model);

          let meshCount = 0;

          // Apply materials and setup
          model.traverse((child) => {
            if (child.isMesh) {
              meshCount++;
              console.log(`Found mesh #${meshCount}:`, child.name);

              // Apply ice material if provided
              if (iceMaterial) {
                child.material = iceMaterial;
              } else {
                // Enhance existing material
                if (child.material) {
                  child.material.envMapIntensity = 2.5;
                  child.material.roughness = 0.3;
                  child.material.metalness = 0.1;
                }
              }

              // Enable shadows
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          console.log(`Total meshes found: ${meshCount}`);

          // Center model at origin
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);

          // Get model size for scaling reference
          const size = box.getSize(new THREE.Vector3());
          console.log('Model size:', size);
          console.log('Model position after centering:', model.position);

          this.loadedModels['igloo'] = model;
          resolve(model);
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = Math.floor((progress.loaded / progress.total) * 100);
            console.log(`📥 Loading igloo model: ${percent}% (${progress.loaded}/${progress.total} bytes)`);
          } else {
            console.log(`📥 Loading igloo model: ${progress.loaded} bytes loaded...`);
          }
        },
        (error) => {
          console.error('❌ GLTFLoader error:', error);
          console.error('Error type:', error.constructor.name);
          console.error('Error message:', error.message);
          console.error('Failed path:', path);
          reject(error);
        }
      );
    });
  }

  /**
   * Create ice material for model
   */
  createIceMaterial(textures = {}) {
    const materialConfig = {
      color: 0xb8d4e0,
      transmission: 0.3,
      thickness: 0.5,
      roughness: 0.3,
      metalness: 0.1,
      ior: 1.31,
      reflectivity: 0.6,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
      emissive: 0x4080a0,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      envMapIntensity: 2.5
    };

    // Apply textures if available
    if (textures.normal) {
      materialConfig.normalMap = textures.normal;
      materialConfig.normalScale = new THREE.Vector2(0.5, 0.5);
    }

    if (textures.roughness) {
      materialConfig.roughnessMap = textures.roughness;
    }

    return new THREE.MeshPhysicalMaterial(materialConfig);
  }

  /**
   * Apply ice material to all meshes in a model
   */
  applyIceMaterial(model, textures = {}) {
    const iceMaterial = this.createIceMaterial(textures);

    model.traverse((child) => {
      if (child.isMesh) {
        child.material = iceMaterial;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return model;
  }

  /**
   * Scale model to desired size
   */
  scaleModel(model, targetHeight = 3) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = targetHeight / size.y;

    model.scale.setScalar(scale);
    console.log(`📏 Scaled model to ${targetHeight} units (scale: ${scale.toFixed(2)})`);

    return model;
  }
}
