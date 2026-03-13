import * as THREE from "three";
import { latLonToVector3 } from "./geo.js";

export function createMarker({ lat, lon, earthRadius, color = 0x00ff00 }) {
  const geom = new THREE.SphereGeometry(earthRadius * 0.02, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color });

  const marker = new THREE.Mesh(geom, mat);

  const surfacePos = latLonToVector3(lat, lon, earthRadius * 1.01);
  marker.position.copy(surfacePos);

  // Orient it pointing away from the center (optional)
  marker.lookAt(surfacePos.clone().multiplyScalar(2));

  return marker;
}