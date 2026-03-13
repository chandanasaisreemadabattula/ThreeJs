import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function createAppScene({ canvasParent = document.body }) {
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  canvasParent.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 4);

  const controls = new OrbitControls(camera, renderer.domElement);
  
  // Google Earth-like controls
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false; // Like Google Earth, no panning
  controls.enableRotate = true;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 1.0;
  
  // Zoom limits - from surface to far out
  controls.minDistance = 1.3;  // Minimum zoom (closest to Earth)
  controls.maxDistance = 15;  // Maximum zoom (farthest)
  
  // Auto-rotate when idle (like Google Earth) - DISABLED
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.3;
  
  // Enable smooth zooming
  controls.zoomEasing = 0.25;
  controls.enableZooming = true;
  
  // Mouse wheel settings for smooth zoom
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  
  // Touch settings
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_ROTATE,
  };

  // Lights
  const ambientLight = new THREE.AmbientLight(0x333333, 0.5);
  scene.add(ambientLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 3, 5);
  scene.add(sun);

  // Resize handler
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", onResize);

  // Stop auto-rotate logic - DISABLED
  // let interactionTimeout;
  // controls.addEventListener('start', () => {
  //   controls.autoRotate = false;
  //   clearTimeout(interactionTimeout);
  // });
  // 
  // controls.addEventListener('end', () => {
  //   // Resume auto-rotate after 3 seconds of inactivity
  //   interactionTimeout = setTimeout(() => {
  //     controls.autoRotate = true;
  //   }, 3000);
  // });

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, controls, render };
}
