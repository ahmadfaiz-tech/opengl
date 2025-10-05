# OpenGL 3D Interactive Website

Website 3D interaktif yang diinspirasi oleh [igloo.inc](https://igloo.inc), dibina menggunakan Three.js dan WebGL.

## 🚀 Tech Stack

- **Three.js** - Library 3D rendering untuk WebGL
- **Vite** - Build tool & development server
- **GSAP** - Library animasi
- **Custom GLSL Shaders** - Vertex & fragment shaders untuk visual effects

## 📁 Struktur Projek

```
opengl/
├── public/              # Static assets
│   ├── models/         # 3D models (.glb, .gltf)
│   └── textures/       # Texture files
├── src/
│   ├── components/     # Reusable 3D components
│   ├── shaders/        # Custom GLSL shaders
│   │   ├── vertexShader.glsl
│   │   └── fragmentShader.glsl
│   ├── utils/          # Helper functions
│   ├── scenes/         # Different 3D scenes
│   ├── main.js         # Entry point
│   └── style.css       # Styling
├── .vscode/
│   └── tasks.json      # VS Code tasks
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## 🎨 Features

- ✅ Interactive 3D scene dengan camera controls
- ✅ Custom WebGL shaders untuk visual effects
- ✅ Smooth animations menggunakan GSAP
- ✅ Loading screen dengan progress indicator
- ✅ Responsive design
- ✅ Auto-rotating 3D objects
- ✅ Particle system
- ✅ Dynamic lighting (ambient, directional, point lights)

## 🛠️ Installation

1. Install dependencies:
```bash
npm install
```

## 🏃 Running the Project

### Development Server

Jalankan development server:
```bash
npm run dev
```

Server akan berjalan di `http://localhost:3000` dan akan membuka browser secara automatik.

### Build untuk Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 📝 VS Code Tasks

Tekan `Ctrl+Shift+P` (atau `Cmd+Shift+P` di Mac) dan taip "Tasks: Run Task", kemudian pilih:

- **Run Dev Server** - Mulakan development server
- **Build Production** - Build projek untuk production
- **Preview Build** - Preview production build

## 🎯 Cara Menggunakan

1. Run `npm run dev`
2. Buka browser di `http://localhost:3000`
3. Interact dengan 3D scene:
   - **Drag** - Rotate camera
   - **Scroll** - Zoom in/out
   - **Auto-rotate** - Automatically enabled

## 🎨 Customization

### Modify Colors

Edit colors dalam `src/main.js`:
```javascript
uColor1: { value: new THREE.Color(0x00ffff) },  // Cyan
uColor2: { value: new THREE.Color(0xff00ff) },  // Magenta
```

### Adjust Shader Effects

Edit shader files:
- `src/shaders/vertexShader.glsl` - Vertex transformations
- `src/shaders/fragmentShader.glsl` - Color & lighting effects

### Change Animation Speed

Edit dalam `src/main.js`:
```javascript
this.controls.autoRotateSpeed = 0.5  // Adjust rotation speed
```

## 📚 Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [GSAP Documentation](https://gsap.com/docs/v3/)
- [Vite Documentation](https://vitejs.dev/)
- [WebGL Fundamentals](https://webglfundamentals.org/)

## 🌟 Inspired By

Website ini diinspirasi oleh [Igloo Inc](https://igloo.inc) - sebuah website interaktif 3D yang menakjubkan.

---

**Dicipta dengan ❤️ menggunakan Three.js & WebGL**
