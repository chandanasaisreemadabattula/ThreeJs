import * as THREE from "three";
import { createAppScene } from "./scene.js";
import { vector3ToLatLon } from "./geo.js";
import { createMarker } from "./markers.js";
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

const { scene, camera, controls, render } = createAppScene({});

function createFallbackEarthTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size / 2; // 2:1 equirectangular
  const ctx = canvas.getContext("2d");

  // Ocean
  ctx.fillStyle = "#08315c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Simple "continents" blobs (not accurate, but makes the app usable without an image file)
  function blob(x, y, rx, ry, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const w = canvas.width, h = canvas.height;
  blob(w * 0.22, h * 0.52, w * 0.10, h * 0.18, "#2d6a3a");
  blob(w * 0.30, h * 0.35, w * 0.06, h * 0.10, "#3b7a43");
  blob(w * 0.52, h * 0.55, w * 0.14, h * 0.20, "#2f6f3c");
  blob(w * 0.62, h * 0.40, w * 0.09, h * 0.14, "#3b7a43");
  blob(w * 0.78, h * 0.55, w * 0.10, h * 0.16, "#2d6a3a");

  // Polar caps
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(0, 0, w, h * 0.06);
  ctx.fillRect(0, h * 0.94, w, h * 0.06);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

async function loadEarthTexture() {
  const loader = new THREE.TextureLoader();

  // Try local file first (public/textures/earth.jpg)
  const localUrl = "/textures/earth.jpg";
  const remoteUrl = "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg";

  const tryLoad = (url) =>
    new Promise((resolve, reject) => {
      loader.load(
        url,
        (tex) => resolve(tex),
        undefined,
        () => reject(new Error(`Failed to load texture: ${url}`))
      );
    });

  try {
    return await tryLoad(localUrl);
  } catch {
    try {
      return await tryLoad(remoteUrl);
    } catch {
      return createFallbackEarthTexture();
    }
  }
}

const earthGeom = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
const earth = new THREE.Mesh(earthGeom, earthMat);
scene.add(earth);

// Atmosphere (simple glow shell)
const atmoGeom = new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 64);
const atmoMat = new THREE.MeshBasicMaterial({
  color: 0x3399ff,
  transparent: true,
  opacity: 0.18,
  side: THREE.BackSide,
});
const atmosphere = new THREE.Mesh(atmoGeom, atmoMat);
scene.add(atmosphere);

// Stars background (simple solid color; you can replace with a star texture later)
scene.background = new THREE.Color(0x000000);

// Ensure orbit rotation feels centered on Earth
controls.target.set(0, 0, 0);
controls.update();

// Click to place marker
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
});

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

let flyState = null;
function flyToLatLon(lat, lon, { distance = 3.0, dropMarker = true } = {}) {
  const surface = latLonToVector3(lat, lon, EARTH_RADIUS);
  const dir = surface.clone().normalize();

  const targetCamPos = dir.clone().multiplyScalar(distance);
  const startCamPos = camera.position.clone();
  const startTarget = controls.target.clone();

  flyState = {
    t: 0,
    duration: 0.8, // seconds (approx; we advance with a fixed dt below)
    startCamPos,
    startTarget,
    endCamPos: targetCamPos,
    endTarget: surface.clone(),
    after: () => {
      if (dropMarker) {
        scene.add(
          createMarker({
            lat,
            lon,
            earthRadius: EARTH_RADIUS,
            color: 0xffcc00,
          })
        );
      }
    },
  };
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
    flyToLatLon(parsed.lat, parsed.lon);
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

      const btn = document.createElement("button");
      btn.className = "resultItem";
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        setStatus(`Going to ${lat.toFixed(4)}, ${lon.toFixed(4)}...`);
        flyToLatLon(lat, lon);
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
function animate() {
  requestAnimationFrame(animate);

  // Optional: subtle rotation
  earth.rotation.y += 0.0005;
  atmosphere.rotation.y += 0.0005;

  // Basic fly-to tween (no extra library)
  if (flyState) {
    // Approximate dt assuming ~60fps; good enough for UI tween
    const dt = 1 / 60;
    flyState.t = Math.min(1, flyState.t + dt / flyState.duration);
    const k = flyState.t * flyState.t * (3 - 2 * flyState.t); // smoothstep

    camera.position.lerpVectors(flyState.startCamPos, flyState.endCamPos, k);
    controls.target.lerpVectors(flyState.startTarget, flyState.endTarget, k);
    controls.update();

    if (flyState.t >= 1) {
      const done = flyState.after;
      flyState = null;
      done?.();
    }
  }

  render();
}
animate();

// Load texture last, so controls still work even if image is missing
loadEarthTexture().then((tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  earthMat.map = tex;
  earthMat.needsUpdate = true;
});