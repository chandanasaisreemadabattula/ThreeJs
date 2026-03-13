import * as THREE from "three";
import { createAppScene } from "./scene.js";
import { vector3ToLatLon } from "./geo.js";
import { createMarker, createLabel } from "./markers.js";
import { latLonToVector3 } from "./geo.js";

function showBlockingMessage(title, details) {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.inset = "12px";
  el.style.display = "grid";
  el.style.placeItems = "center";
  el.style.zIndex = "99999";
  el.style.pointerEvents = "auto";

  const card = document.createElement("div");
  card.style.maxWidth = "720px";
  card.style.width = "100%";
  card.style.borderRadius = "14px";
  card.style.padding = "16px 18px";
  card.style.background = "rgba(0,0,0,0.75)";
  card.style.backdropFilter = "blur(10px)";
  card.style.color = "#fff";
  card.style.font = "14px/1.5 system-ui, sans-serif";
  card.style.border = "1px solid rgba(255,255,255,0.16)";

  const h = document.createElement("div");
  h.textContent = title;
  h.style.fontWeight = "700";
  h.style.fontSize = "16px";
  h.style.marginBottom = "8px";

  const p = document.createElement("div");
  p.textContent = details;
  p.style.opacity = "0.95";

  card.appendChild(h);
  card.appendChild(p);
  el.appendChild(card);
  document.body.appendChild(el);
}

// If opened directly (file://), ES module deps won't load correctly.
if (location.protocol === "file:") {
  showBlockingMessage(
    "This Three.js app must be opened via Vite (not by double-clicking index.html).",
    "Run: npm run dev  → then open the Local URL shown in the terminal (for example http://localhost:5174/)."
  );
}

const EARTH_RADIUS = 1;

const { scene, camera, controls, render, renderer } = createAppScene({});

// Custom atmosphere shader for realistic glow
const atmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const atmosphereFragmentShader = `
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec3 viewDirection = normalize(-vPosition);
  float rim = 1.0 - max(0.0, dot(viewDirection, vNormal));
  rim = pow(rim, 3.0);
  vec3 atmosphereColor = vec3(0.3, 0.6, 1.0);
  gl_FragColor = vec4(atmosphereColor, rim * 0.6);
}
`;

// Create atmosphere glow
const atmosphereGeom = new THREE.SphereGeometry(EARTH_RADIUS * 1.2, 64, 64);
const atmosphereMat = new THREE.ShaderMaterial({
  vertexShader: atmosphereVertexShader,
  fragmentShader: atmosphereFragmentShader,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
});
const atmosphere = new THREE.Mesh(atmosphereGeom, atmosphereMat);
scene.add(atmosphere);

// Create Earth with improved materials
const earthGeom = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
const earthMat = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  shininess: 25,
  specular: new THREE.Color(0x333333),
});
const earth = new THREE.Mesh(earthGeom, earthMat);
scene.add(earth);

// Create cloud layer
const cloudGeom = new THREE.SphereGeometry(EARTH_RADIUS * 1.01, 64, 64);
const cloudMat = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
});
const clouds = new THREE.Mesh(cloudGeom, cloudMat);
scene.add(clouds);

// Create glow layer (inner atmosphere)
const glowGeom = new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 64, 64);
const glowMat = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
      gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity * 0.5;
    }
  `,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
});
const glow = new THREE.Mesh(glowGeom, glowMat);
scene.add(glow);

// Create starfield background
function createStarfield() {
  const starsGeometry = new THREE.BufferGeometry();
  const starCount = 5000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  
  for (let i = 0; i < starCount * 3; i += 3) {
    const radius = 100 + Math.random() * 400;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    positions[i] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i + 2] = radius * Math.cos(phi);
    
    const brightness = 0.5 + Math.random() * 0.5;
    colors[i] = brightness;
    colors[i + 1] = brightness;
    colors[i + 2] = brightness + Math.random() * 0.2;
  }
  
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const starsMaterial = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });
  
  return new THREE.Points(starsGeometry, starsMaterial);
}

const starfield = createStarfield();
scene.add(starfield);

// Add ambient light for better visibility
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

// Directional light (sun)
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(5, 3, 5);
scene.add(sun);

// Subtle fill light from opposite side
const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
fillLight.position.set(-5, -3, -5);
scene.add(fillLight);

// Ensure orbit rotation feels centered on Earth
controls.target.set(0, 0, 0);
controls.update();

// Click to place marker with info
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", (e) => {
  // Don't treat clicks on the search UI as globe clicks
  const searchRoot = document.getElementById("searchRoot");
  if (searchRoot && searchRoot.contains(e.target)) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObject(earth);
  if (!hits.length) return;

  const hitPoint = hits[0].point;
  const { lat, lon } = vector3ToLatLon(hitPoint);

  const marker = createMarker({
    lat,
    lon,
    earthRadius: EARTH_RADIUS,
    color: 0x00ff00,
  });
  scene.add(marker);
  
  // Show coordinates
  showCoordinates(lat, lon);
});

function showCoordinates(lat, lon) {
  const coordDisplay = document.getElementById('coordDisplay');
  if (coordDisplay) {
    coordDisplay.textContent = `${lat.toFixed(4)}° ${lon.toFixed(4)}°`;
  }
}

// Fly-to animation with smooth easing
let flyState = null;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function flyToLatLon(lat, lon, { distance = 2.5, dropMarker = true, locationName = null } = {}) {
  const surface = latLonToVector3(lat, lon, EARTH_RADIUS);
  const dir = surface.clone().normalize();

  // Calculate camera position - look at the location from the side
  const targetCamPos = dir.clone().multiplyScalar(distance);
  
  // Adjust camera angle for better view
  const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  targetCamPos.add(tangent.multiplyScalar(0.3));

  const startCamPos = camera.position.clone();
  const startTarget = controls.target.clone();

  flyState = {
    t: 0,
    duration: 1.5,
    startCamPos,
    startTarget,
    endCamPos: targetCamPos,
    endTarget: surface.clone(),
    after: () => {
      if (dropMarker) {
        const marker = createMarker({
          lat,
          lon,
          earthRadius: EARTH_RADIUS,
          color: 0xffcc00,
          name: locationName
        });
        scene.add(marker);
        
        // Add label for searched location
        if (locationName) {
          addLocationLabel(lat, lon, locationName);
        }
      }
    },
  };
}

function addLocationLabel(lat, lon, name) {
  const label = createLabel(name, lat, lon, EARTH_RADIUS);
  scene.add(label);
}

// Search UI (Nominatim) + fly-to
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchStatus = document.getElementById("searchStatus");
const searchResults = document.getElementById("searchResults");

function setStatus(text) {
  if (searchStatus) searchStatus.textContent = text || "";
}

function clearResults() {
  if (searchResults) searchResults.innerHTML = "";
}

function tryParseLatLon(text) {
  // Accept "lat lon" or "lat,lon"
  const m = text.trim().match(/^(-?\d+(\.\d+)?)\s*[, ]\s*(-?\d+(\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[3]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

async function doSearch() {
  const q = (searchInput?.value || "").trim();
  clearResults();
  if (!q) {
    setStatus("Type a place name or: lat lon");
    return;
  }

  const parsed = tryParseLatLon(q);
  if (parsed) {
    setStatus(`Going to ${parsed.lat.toFixed(4)}, ${parsed.lon.toFixed(4)}...`);
    flyToLatLon(parsed.lat, parsed.lon, {
      distance: 2.5,
      dropMarker: true,
      locationName: `${parsed.lat.toFixed(2)}, ${parsed.lon.toFixed(2)}`
    });
    return;
  }

  setStatus("Searching...");
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "5");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      setStatus("No results.");
      return;
    }

    setStatus(`Found ${data.length} result(s). Click one to fly there.`);

    for (const item of data) {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      const label = item.display_name || `${lat}, ${lon}`;
      // Shorten label for display
      const shortLabel = label.split(',').slice(0, 2).join(',');

      const btn = document.createElement("button");
      btn.className = "resultItem";
      btn.type = "button";
      btn.textContent = shortLabel;
      btn.addEventListener("click", () => {
        setStatus(`Going to ${lat.toFixed(4)}, ${lon.toFixed(4)}...`);
        flyToLatLon(lat, lon, { 
          distance: 2.5, 
          dropMarker: true,
          locationName: shortLabel
        });
      });
      searchResults?.appendChild(btn);
    }
  } catch (err) {
    setStatus(`Search failed. (${err?.message || "unknown error"})`);
  }
}

searchBtn?.addEventListener("click", doSearch);
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Earth rotation - DISABLED (no auto rotation)
  // earth.rotation.y += 0.0002;
  
  // Clouds rotate slightly faster - DISABLED
  // clouds.rotation.y += 0.0003;
  
  // Atmosphere and glow rotation - DISABLED
  // atmosphere.rotation.y += 0.0001;
  // glow.rotation.y += 0.0001;

  // Very slow starfield rotation for dynamism - DISABLED
  // starfield.rotation.y += 0.00002;

  // Fly-to animation with smooth easing
  if (flyState) {
    const dt = 1 / 60;
    flyState.t = Math.min(1, flyState.t + dt / flyState.duration);
    const k = easeInOutCubic(flyState.t);

    camera.position.lerpVectors(flyState.startCamPos, flyState.endCamPos, k);
    controls.target.lerpVectors(flyState.startTarget, flyState.endTarget, k);
    controls.update();

    if (flyState.t >= 1) {
      const done = flyState.after;
      flyState = null;
      done?.();
    }
  }

  // Update coordinates display
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = ray.intersectObject(earth);
  if (hits.length > 0) {
    const { lat, lon } = vector3ToLatLon(hits[0].point);
    showCoordinates(lat, lon);
  }

  render();
}

// Load textures
async function loadEarthTextures() {
  const textureLoader = new THREE.TextureLoader();
  
  // Earth texture URLs
  const earthTextures = [
    '/textures/earth.jpg',
    'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  ];
  
  const cloudTextures = [
    'https://threejs.org/examples/textures/planets/earth_clouds_1024.png',
  ];
  
  const bumpTextures = [
    'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg',
  ];
  
  const specularTextures = [
    'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg',
  ];

  // Try to load Earth texture
  for (const url of earthTextures) {
    try {
      const tex = await new Promise((resolve, reject) => {
        textureLoader.load(url, resolve, undefined, () => reject());
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      earthMat.map = tex;
      earthMat.needsUpdate = true;
      break;
    } catch (e) {
      console.log('Failed to load:', url);
    }
  }

  // Try to load cloud texture
  for (const url of cloudTextures) {
    try {
      const tex = await new Promise((resolve, reject) => {
        textureLoader.load(url, resolve, undefined, () => reject());
      });
      cloudMat.map = tex;
      cloudMat.needsUpdate = true;
      break;
    } catch (e) {
      console.log('Failed to load clouds:', url);
    }
  }

  // Try to load bump map
  for (const url of bumpTextures) {
    try {
      const tex = await new Promise((resolve, reject) => {
        textureLoader.load(url, resolve, undefined, () => reject());
      });
      earthMat.bumpMap = tex;
      earthMat.bumpScale = 0.05;
      earthMat.needsUpdate = true;
      break;
    } catch (e) {
      console.log('Failed to load bump:', url);
    }
  }

  // Try to load specular map
  for (const url of specularTextures) {
    try {
      const tex = await new Promise((resolve, reject) => {
        textureLoader.load(url, resolve, undefined, () => reject());
      });
      earthMat.specularMap = tex;
      earthMat.needsUpdate = true;
      break;
    } catch (e) {
      console.log('Failed to load specular:', url);
    }
  }
}

// Add coordinate display to HUD
function addCoordDisplay() {
  const hud = document.querySelector('.hud');
  if (hud) {
    const coordDiv = document.createElement('div');
    coordDiv.id = 'coordDisplay';
    coordDiv.style.marginTop = '8px';
    coordDiv.style.fontFamily = 'monospace';
    coordDiv.style.color = '#88ff88';
    coordDiv.textContent = '0.0000° 0.0000°';
    hud.appendChild(coordDiv);
  }
}

addCoordDisplay();
animate();
loadEarthTextures();
