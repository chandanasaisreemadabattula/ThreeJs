import * as THREE from "three";

export function latLonToVector3(latDeg,lonDeg,radius){
    const lat = THREE.MathUtils.degToRad(latDeg);
    const lon = THREE.MathUtils.degToRad(lonDeg);

    const x = radius * Math.cos(lat) * Math.sin(lon);
    const y = radius * Math.sin(lat);
    const z = radius * Math.cos(lat) * Math.cos(lon);

    return new THREE.Vector3(x,y,z);
}

export function vector3ToLatLon(vec3) {
    const r = vec3.length();
    const lat = Math.asin(vec3.y / r);
    const lon = Math.atan2(vec3.x, vec3.z);
  
    return {
      lat: THREE.MathUtils.radToDeg(lat),
      lon: THREE.MathUtils.radToDeg(lon),
    };
  }