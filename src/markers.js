import * as THREE from "three";
import { latLonToVector3 } from "./geo.js";

export function createMarker({ lat, lon, earthRadius, color = 0xffcc00, name = null }) {
  const group = new THREE.Group();
  
  // Get the position on the surface
  const surfacePos = latLonToVector3(lat, lon, earthRadius);
  
  // Create a location pin/pointer effect
  // Main pin head (sphere at surface)
  const pinHeadGeom = new THREE.SphereGeometry(earthRadius * 0.02, 16, 16);
  const pinHeadMat = new THREE.MeshBasicMaterial({ color });
  const pinHead = new THREE.Mesh(pinHeadGeom, pinHeadMat);
  pinHead.position.copy(surfacePos);
  group.add(pinHead);
  
  // Pin point (line going outward from surface)
  const dir = surfacePos.clone().normalize();
  const pinLength = earthRadius * 0.08;
  const pinEnd = surfacePos.clone().add(dir.clone().multiplyScalar(pinLength));
  
  const pinLineGeom = new THREE.BufferGeometry().setFromPoints([
    surfacePos.clone(),
    pinEnd
  ]);
  const pinLineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const pinLine = new THREE.Line(pinLineGeom, pinLineMat);
  group.add(pinLine);
  
  // Create a vertical stick/pin that goes above the surface
  const stickGeom = new THREE.CylinderGeometry(
    earthRadius * 0.003,
    earthRadius * 0.005,
    earthRadius * 0.1,
    8
  );
  const stickMat = new THREE.MeshBasicMaterial({ color });
  const stick = new THREE.Mesh(stickGeom, stickMat);
  
  // Position the stick - it should start at surface and go outward
  const stickPos = surfacePos.clone().add(dir.clone().multiplyScalar(earthRadius * 0.05));
  stick.position.copy(stickPos);
  
  // Orient the stick to point away from earth center
  stick.lookAt(stickPos.clone().add(dir));
  stick.rotateX(Math.PI / 2); // Rotate to align with the direction
  group.add(stick);
  
  // Add a pulsing circle on the surface to highlight the exact location
  const ringGeom = new THREE.RingGeometry(earthRadius * 0.015, earthRadius * 0.025, 32);
  const ringMat = new THREE.MeshBasicMaterial({ 
    color, 
    transparent: true, 
    opacity: 0.6,
    side: THREE.DoubleSide 
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.copy(surfacePos);
  ring.lookAt(surfacePos.clone().multiplyScalar(2));
  group.add(ring);
  
  // Add a smaller inner ring
  const innerRingGeom = new THREE.RingGeometry(earthRadius * 0.005, earthRadius * 0.012, 32);
  const innerRingMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.8,
    side: THREE.DoubleSide 
  });
  const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
  innerRing.position.copy(surfacePos);
  innerRing.lookAt(surfacePos.clone().multiplyScalar(2));
  group.add(innerRing);
  
  // Store for animation
  group.userData.ring = ring;
  group.userData.innerRing = innerRing;
  group.userData.pinHead = pinHead;
  group.userData.stick = stick;
  group.userData.surfacePos = surfacePos.clone();
  
  return group;
}

export function createLabel(text, lat, lon, earthRadius) {
  // Create a canvas for the label
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  
  // Background with rounded corners
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 16);
  ctx.fill();
  
  // Border
  ctx.strokeStyle = 'rgba(255, 204, 0, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 16);
  ctx.stroke();
  
  // Location icon (pin)
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('📍', 20, canvas.height / 2);
  
  // Text - show full name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'left';
  
  // Truncate text if too long
  let displayText = text;
  if (displayText.length > 30) {
    displayText = displayText.substring(0, 27) + '...';
  }
  ctx.fillText(displayText, 70, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  const spriteMat = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    depthTest: false,
  });
  
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.6, 0.15, 1);
  
  const pos = latLonToVector3(lat, lon, earthRadius * 1.08);
  sprite.position.copy(pos);
  
  return sprite;
}
