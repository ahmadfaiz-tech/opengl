import * as THREE from 'three';

/**
 * Arctic Terrain/Mountains Generator
 * Creates background environment similar to igloo.inc
 */
export class TerrainGenerator {
  /**
   * Create distant mountains for background
   */
  createMountains() {
    const group = new THREE.Group();

    // Create 3 layers of mountains (depth)
    for (let layer = 0; layer < 3; layer++) {
      const geometry = this.createMountainGeometry(layer);

      const material = new THREE.MeshStandardMaterial({
        color: layer === 0 ? 0x9db8c8 : (layer === 1 ? 0xb8cdd8 : 0xd0e0e8),
        roughness: 0.9,
        metalness: 0.1,
        fog: true
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Position layers at different depths
      mesh.position.z = -20 - (layer * 15);
      mesh.position.y = -5 + (layer * 2);
      mesh.scale.y = 0.8 - (layer * 0.2);

      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }

  /**
   * Generate mountain geometry with peaks
   */
  createMountainGeometry(seed = 0) {
    const width = 100;
    const segments = 64;

    const geometry = new THREE.PlaneGeometry(width, 20, segments, 32);

    // Rotate to stand vertical
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    // Create mountain peaks
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);

      const x = vertex.x;
      const z = vertex.z;

      // Multiple sine waves for varied peaks
      let height = 0;
      height += Math.sin(x * 0.05 + seed) * 8;
      height += Math.sin(x * 0.1 + seed * 1.5) * 4;
      height += Math.sin(x * 0.2 + seed * 2) * 2;

      // Add noise
      height += (Math.random() - 0.5) * 1;

      // Fade out at edges
      const edgeFactor = 1 - Math.abs(x / (width / 2));
      height *= edgeFactor;

      // Only affect vertices above ground
      if (z > 0) {
        vertex.y = height * (z / 20);
      }

      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.computeVertexNormals();
    return geometry;
  }

  /**
   * Create snowy ground terrain (more detailed than flat)
   */
  createTerrain(size = 50) {
    const geometry = new THREE.PlaneGeometry(size, size, 128, 128);

    const positions = geometry.attributes.position;

    // Add rolling hills and drifts
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // Snow drifts pattern
      let height = 0;
      height += Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5;
      height += Math.sin(x * 0.3) * Math.cos(y * 0.2) * 0.2;
      height += Math.sin(x * 0.5) * Math.cos(y * 0.4) * 0.1;

      // Add random variation
      height += (Math.random() - 0.5) * 0.1;

      positions.setZ(i, height);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xe8f4f8,
      roughness: 0.95,
      metalness: 0.05,
      fog: true
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -2.5;
    terrain.receiveShadow = true;

    return terrain;
  }

  /**
   * Create atmospheric fog planes (depth layers)
   */
  createFogLayers() {
    const group = new THREE.Group();

    for (let i = 0; i < 5; i++) {
      const geometry = new THREE.PlaneGeometry(100, 30);
      const material = new THREE.MeshBasicMaterial({
        color: 0xc8dce8,
        transparent: true,
        opacity: 0.05 + (i * 0.02),
        side: THREE.DoubleSide,
        fog: false
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -15 - (i * 10);
      mesh.position.y = -3 + Math.random() * 2;

      group.add(mesh);
    }

    return group;
  }
}
