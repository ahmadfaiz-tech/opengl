import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Optimization inspired by igloo.inc
    rollupOptions: {
      output: {
        // Manual chunks for better caching and smaller initial bundle
        manualChunks(id) {
          // Separate Three.js into its own chunk (largest library)
          if (id.includes('three')) {
            // Split Three.js core from addons
            if (id.includes('three/examples')) {
              return 'three-addons'
            }
            return 'three-core'
          }

          // Separate GSAP into its own chunk
          if (id.includes('gsap')) {
            return 'gsap'
          }

          // All other node_modules into vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },

        // Optimize chunk file names for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },

    // Increase chunk size warning limit (expected for 3D apps)
    chunkSizeWarningLimit: 1000,

    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    }
  },
  server: {
    port: 3001,
    open: true
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['three', 'gsap']
  }
})
