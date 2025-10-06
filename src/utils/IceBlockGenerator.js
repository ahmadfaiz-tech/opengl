import * as THREE from 'three';

/**
 * Ice Block Geometry Generator
 * Inspired by igloo.inc's procedural ice crystal growth algorithm
 */
export class IceBlockGenerator {
  constructor() {
    this.random = Math.random;
  }

  /**
   * Create a procedural ice block with variations
   */
  createIceBlock(options = {}) {
    const {
      baseShape = 'cube',
      size = 1,
      roughness = 0.3,
      subdivisions = 2,
      crystalGrowth = 0.15
    } = options;

    let geometry;

    // Start with base shape
    if (baseShape === 'cube') {
      geometry = new THREE.BoxGeometry(size, size, size, subdivisions, subdivisions, subdivisions);
    } else if (baseShape === 'cylinder') {
      geometry = new THREE.CylinderGeometry(size * 0.5, size * 0.5, size, 8, subdivisions);
    } else {
      geometry = new THREE.IcosahedronGeometry(size * 0.6, subdivisions);
    }

    // Apply ice crystal growth (deform vertices)
    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);

      // Add noise-based deformation (ice crystal growth)
      const noise = this.simplexNoise(vertex.x * 2, vertex.y * 2, vertex.z * 2);
      const deformation = noise * crystalGrowth * size;

      vertex.normalize().multiplyScalar(vertex.length() + deformation);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    // Add roughness to edges
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);

      const randomOffset = (this.random() - 0.5) * roughness * size * 0.1;
      vertex.x += randomOffset;
      vertex.y += randomOffset;
      vertex.z += randomOffset;

      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Create igloo dome structure (proper igloo shape)
   */
  createIceStructure(count = 60, textures = {}) {
    const blocks = [];
    const group = new THREE.Group();

    const iglooRadius = 3;
    const iglooHeight = 2.5;
    const layers = 8; // Number of horizontal layers
    const blocksPerLayer = [16, 14, 12, 10, 8, 6, 4, 2]; // Decreasing blocks per layer

    let blockIndex = 0;

    // Build igloo layer by layer (dome shape)
    for (let layer = 0; layer < layers; layer++) {
      const layerHeight = (layer / layers) * iglooHeight;
      const layerRadius = iglooRadius * Math.cos((layer / layers) * Math.PI / 2);
      const numBlocks = blocksPerLayer[layer];

      for (let i = 0; i < numBlocks; i++) {
        if (blockIndex >= count) break;

        const angle = (i / numBlocks) * Math.PI * 2;

        // Skip blocks for entrance (front of igloo)
        if (layer < 3 && i >= numBlocks / 2 - 1 && i <= numBlocks / 2 + 1) {
          continue; // Create entrance gap
        }

        // Ice block dimensions (wider and flatter for igloo style)
        const blockWidth = 0.6;
        const blockHeight = 0.35;
        const blockDepth = 0.4;

        const geometry = new THREE.BoxGeometry(blockWidth, blockHeight, blockDepth, 2, 2, 2);

        // Apply slight deformation
        const positions = geometry.attributes.position;
        const vertex = new THREE.Vector3();

        for (let j = 0; j < positions.count; j++) {
          vertex.fromBufferAttribute(positions, j);
          const noise = this.simplexNoise(vertex.x * 3, vertex.y * 3, vertex.z * 3);
          const deformation = noise * 0.05;
          vertex.x += deformation;
          vertex.y += deformation;
          vertex.z += deformation;
          positions.setXYZ(j, vertex.x, vertex.y, vertex.z);
        }

        geometry.computeVertexNormals();

        const material = this.createIceMaterial({ textures });
        const mesh = new THREE.Mesh(geometry, material);

        // Position block in dome
        const x = Math.cos(angle) * layerRadius;
        const z = Math.sin(angle) * layerRadius;
        const y = layerHeight - 1.5;

        mesh.position.set(x, y, z);

        // Rotate block to face center and tilt up for dome
        mesh.lookAt(0, y, 0);
        mesh.rotateX(Math.PI / 2);

        // Tilt outward for dome curve
        const tiltAngle = (layer / layers) * 0.3;
        mesh.rotateY(-tiltAngle);

        // Enable shadows
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        group.add(mesh);
        blocks.push(mesh);
        blockIndex++;
      }
    }

    return { group, blocks };
  }

  /**
   * Create realistic ice material with texture support
   */
  createIceMaterial(options = {}) {
    const {
      color = 0xb8d4e0,
      transmission = 0.3,  // Much less transparent
      thickness = 0.5,
      roughness = 0.3,
      metalness = 0.1,
      ior = 1.31,
      reflectivity = 0.6,
      clearcoat = 0.8,     // More clearcoat for glossy look
      clearcoatRoughness = 0.1,
      emissive = 0x4080a0, // Slight blue glow
      emissiveIntensity = 0.15,
      textures = {} // New: texture maps
    } = options;

    const materialConfig = {
      color: color,
      transmission: transmission,
      thickness: thickness,
      roughness: roughness,
      metalness: metalness,
      ior: ior,
      reflectivity: reflectivity,
      clearcoat: clearcoat,
      clearcoatRoughness: clearcoatRoughness,
      emissive: emissive,
      emissiveIntensity: emissiveIntensity,
      transparent: true,
      opacity: 1.0,  // Full opacity
      side: THREE.DoubleSide,
      envMapIntensity: 2.5
    };

    // Apply textures if available
    if (textures.color) {
      materialConfig.map = textures.color;
      materialConfig.map.repeat.set(2, 2);
    }

    if (textures.normal) {
      materialConfig.normalMap = textures.normal;
      materialConfig.normalMap.repeat.set(2, 2);
      materialConfig.normalScale = new THREE.Vector2(0.5, 0.5);
    }

    if (textures.roughness) {
      materialConfig.roughnessMap = textures.roughness;
      materialConfig.roughnessMap.repeat.set(2, 2);
    }

    if (textures.ao) {
      materialConfig.aoMap = textures.ao;
      materialConfig.aoMap.repeat.set(2, 2);
      materialConfig.aoMapIntensity = 0.3;
    }

    return new THREE.MeshPhysicalMaterial(materialConfig);
  }

  /**
   * Simple noise function (approximation of simplex noise)
   */
  simplexNoise(x, y, z) {
    const dot = (x * 12.9898 + y * 78.233 + z * 45.164);
    const noise = Math.sin(dot) * 43758.5453;
    return (noise - Math.floor(noise)) * 2 - 1;
  }

  /**
   * Create ice floor/ground
   */
  createIceGround(size = 20) {
    const geometry = new THREE.PlaneGeometry(size, size, 32, 32);

    // Add subtle waves to ground
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const wave = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.1;
      positions.setZ(i, wave);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshPhysicalMaterial({
      color: 0xe8f4f8,
      transmission: 0.3,
      thickness: 0.5,
      roughness: 0.2,
      metalness: 0.1,
      reflectivity: 0.8,
      envMapIntensity: 1.0
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;

    return ground;
  }
}
