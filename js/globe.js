// js/globe.js
// Globe 3D interactif (Three.js) — adaptation vanilla JS du composant React
// "Globe — Originkit" fourni par l'utilisateur. Exposé en ES module ; s'enregistre
// sur window.HandiplageGlobe pour être utilisable depuis les scripts classiques
// (js/usagers-map.js) une fois le module chargé.
//
// API : window.HandiplageGlobe.create(container, options) → { destroy(), setMarkers(markers) }
// `options` reprend les props du composant d'origine (speed, dots, fill, fillColor,
// scale, stopOnHover, markerConfig, direction, initialLatitude, initialLongitude,
// oceanColor, outlineColor, showOutline, graticuleColor, showGrid, outlineWidth,
// dragSpeed, detail) + un ajout : onMarkerHover(marker|null, clientX, clientY).
// markerConfig.markers accepte un champ optionnel `label` par marker, transmis
// à onMarkerHover pour afficher une info-bulle.

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  SphereGeometry,
  MeshBasicMaterial,
  Color,
  Mesh,
  Group,
  InstancedMesh,
  Matrix4,
  Raycaster,
  Vector2,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
  CanvasTexture,
  SRGBColorSpace,
} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { geoEquirectangular, geoPath } from 'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm';

const LAND_DATA_URL = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/50m/physical/ne_50m_land.json';

// Cache mémoire du GeoJSON des terres — évite de le retélécharger à chaque
// ouverture de l'onglet Carte pendant la session.
let _landFeaturesCache = null;
async function _loadLandFeatures() {
  if (_landFeaturesCache) return _landFeaturesCache;
  const response = await fetch(LAND_DATA_URL);
  if (!response.ok) throw new Error('Échec du chargement des données terrestres');
  _landFeaturesCache = await response.json();
  return _landFeaturesCache;
}

function parseColorToRgba(input) {
  if (!input || input.trim() === '') return { r: 0, g: 0, b: 0, a: 0 };
  const str = input.trim();
  const rgbaMatch = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, parseFloat(rgbaMatch[1]))) / 255;
    const g = Math.max(0, Math.min(255, parseFloat(rgbaMatch[2]))) / 255;
    const b = Math.max(0, Math.min(255, parseFloat(rgbaMatch[3]))) / 255;
    const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1;
    return { r, g, b, a };
  }
  const hex = str.replace(/^#/, '');
  if (hex.length === 8) {
    return { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255, a: parseInt(hex.slice(6, 8), 16) / 255 };
  }
  if (hex.length === 6) {
    return { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255, a: 1 };
  }
  if (hex.length === 4) {
    return { r: parseInt(hex[0] + hex[0], 16) / 255, g: parseInt(hex[1] + hex[1], 16) / 255, b: parseInt(hex[2] + hex[2], 16) / 255, a: parseInt(hex[3] + hex[3], 16) / 255 };
  }
  if (hex.length === 3) {
    return { r: parseInt(hex[0] + hex[0], 16) / 255, g: parseInt(hex[1] + hex[1], 16) / 255, b: parseInt(hex[2] + hex[2], 16) / 255, a: 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function mapLinear(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function mapSpeedUiToInternal(ui) {
  if (ui === 0) return 0;
  return mapLinear(Math.max(0, Math.min(10, ui)), 0, 10, 0, 0.9);
}
function mapDensityUiToSpacing(ui) { return mapLinear(Math.max(1, Math.min(10, ui)), 1, 10, 24, 8); }
function mapScaleUiToMultiplier(ui) { return mapLinear(Math.max(1, Math.min(20, ui)), 1, 20, 0.2, 2); }
function mapDotSizeUiToMultiplier(ui) { return mapLinear(Math.max(1, Math.min(10, ui)), 1, 10, 0.1, 0.5); }
function mapMarkerDotSizeUiToMultiplier(ui) { return mapLinear(Math.max(0, Math.min(100, ui)), 0, 100, 0.1, 2.5); }
function normalizeSmoothing(ui) { return Math.max(0, Math.min(1, ui / 10)); }
function mapDragSpeedUiToSensitivity(ui) { return mapLinear(Math.max(0, Math.min(10, ui)), 0, 10, 0.001, 0.02); }
function mapDetailToStepSize(ui) { return mapLinear(Math.max(1, Math.min(10, ui)), 1, 10, 10, 1); }

function simplifyRing(ring, detail) {
  if (ring.length < 2) return ring;
  if (detail >= 10) return ring;
  const stepSize = Math.max(1, Math.floor(mapDetailToStepSize(detail)));
  const simplified = [ring[0]];
  for (let i = stepSize; i < ring.length - 1; i += stepSize) {
    simplified.push(ring[Math.min(i, ring.length - 1)]);
  }
  const lastPoint = ring[ring.length - 1];
  const firstPoint = ring[0];
  const isClosed = Math.abs(lastPoint[0] - firstPoint[0]) < 1e-4 && Math.abs(lastPoint[1] - firstPoint[1]) < 1e-4;
  if (!isClosed) simplified.push(lastPoint);
  return simplified.length >= 2 ? simplified : ring;
}

function latLngToPosition(lat, lng) {
  const latRad = lat * (Math.PI / 180);
  const lngRad = lng * (Math.PI / 180);
  return {
    x: Math.cos(latRad) * Math.sin(lngRad),
    y: Math.sin(latRad),
    z: Math.cos(latRad) * Math.cos(lngRad),
  };
}

function pointsToTube(points, radius) {
  const curve = new CatmullRomCurve3(points);
  return new TubeGeometry(curve, points.length * 2, radius, 8, false);
}

/**
 * Crée un globe dans `container` et démarre son rendu.
 * Retourne { destroy(), setMarkers(markers) }.
 */
export function create(container, options = {}) {
  const {
    speed = 2,
    smoothing = 8,
    dots = { color: '#ffffff', size: 5, density: 8, allDots: false },
    fill = 'dots',
    fillColor = '#ffffff',
    scale = 8,
    stopOnHover = true,
    markerConfig = { markers: [], color: '#00f7ff', size: 40 },
    direction = 'left',
    initialLatitude = 23,
    initialLongitude = -23,
    oceanColor = '#000000',
    outlineColor = '#ffffff',
    showOutline = true,
    graticuleColor = '#D4D4D4',
    showGrid = true,
    outlineWidth = 1,
    dragSpeed = 5,
    detail = 5,
    onMarkerHover = null,
    onMarkerClick = null,
    onError = null,
  } = options;

  const containerEl = document.createElement('div');
  containerEl.style.position = 'relative';
  containerEl.style.width = '100%';
  containerEl.style.height = '100%';
  container.appendChild(containerEl);

  const gridWidth = 1;
  const smoothingN = normalizeSmoothing(smoothing);
  const baseRotationSpeed = mapSpeedUiToInternal(speed);
  const rotationSpeed = direction === 'left' ? -baseRotationSpeed : baseRotationSpeed;
  const dotSpacing = mapDensityUiToSpacing(dots.density);
  const dotSizeMultiplier = mapDotSizeUiToMultiplier(dots.size);
  const markerRadiusMultiplier = mapMarkerDotSizeUiToMultiplier(markerConfig.size);
  const scaleMultiplier = mapScaleUiToMultiplier(scale);
  const allDots = dots.allDots;

  const containerWidth = containerEl.clientWidth || 800;
  const containerHeight = containerEl.clientHeight || 600;

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, containerWidth / containerHeight, 0.1, 1e3);
  const baseRadius = 1;
  const globeRadius = baseRadius * scaleMultiplier;
  const cameraDistance = 2.5 / scaleMultiplier;
  const MIN_ZOOM = 1;
  // Borne dynamique : la caméra ne doit jamais franchir la surface du globe
  // (marge de 15 %), quelle que soit la valeur de `scale` fournie.
  const MAX_ZOOM = Math.max(1.5, (cameraDistance / globeRadius) / 1.15);
  let zoom = 1;
  function applyCamera() {
    camera.position.set(0, 0, cameraDistance / zoom);
    camera.lookAt(0, 0, 0);
  }
  applyCamera();

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(containerWidth, containerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (SRGBColorSpace) renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.cursor = 'grab';
  containerEl.appendChild(canvas);

  const oceanRgba = parseColorToRgba(oceanColor);
  const outlineRgba = parseColorToRgba(outlineColor);
  const dotRgba = parseColorToRgba(dots.color);
  const graticuleRgba = parseColorToRgba(graticuleColor);
  const fillRgba = parseColorToRgba(fillColor);

  const oceanGeometry = new SphereGeometry(globeRadius, 64, 64);
  const oceanMaterial = new MeshBasicMaterial({
    color: new Color(oceanColor || 0x000000),
    transparent: oceanRgba.a < 1 || oceanRgba.a === 0,
    opacity: oceanRgba.a,
  });
  const oceanMesh = new Mesh(oceanGeometry, oceanMaterial);
  scene.add(oceanMesh);

  const continentOutlineGroup = new Group();
  const graticuleGroup = new Group();

  if (showGrid && graticuleColor && graticuleRgba.a > 0) {
    const graticuleMaterial = new MeshBasicMaterial({
      color: new Color(graticuleColor),
      transparent: graticuleRgba.a < 1 || graticuleRgba.a === 0,
      opacity: graticuleRgba.a,
    });
    const gridSpacing = 15;
    const addGraticuleLine = (points) => {
      if (points.length < 2) return;
      const radius = (gridWidth / 10) * 0.01;
      const tubeMesh = new Mesh(pointsToTube(points, radius), graticuleMaterial);
      tubeMesh.renderOrder = 0;
      graticuleGroup.add(tubeMesh);
    };
    for (let lat = -90; lat <= 90; lat += gridSpacing) {
      const points = [];
      for (let i = 0; i <= 64; i++) {
        const lng = (i / 64) * 360 - 180;
        const pos = latLngToPosition(lat, lng);
        points.push(new Vector3(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius));
      }
      addGraticuleLine(points);
    }
    for (let lng = -180; lng < 180; lng += gridSpacing) {
      const points = [];
      for (let i = 0; i <= 64; i++) {
        const lat = (i / 64) * 180 - 90;
        const pos = latLngToPosition(lat, lng);
        points.push(new Vector3(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius));
      }
      addGraticuleLine(points);
    }
  }

  let dotInstances = null;
  let markerMeshes = [];

  const globeGroup = new Group();
  globeGroup.rotation.y = (initialLongitude * Math.PI) / 180;
  globeGroup.rotation.x = (initialLatitude * Math.PI) / 180;
  scene.add(globeGroup);
  globeGroup.add(oceanMesh);
  if (showGrid && graticuleColor && graticuleRgba.a > 0) globeGroup.add(graticuleGroup);
  globeGroup.add(continentOutlineGroup);

  let currentMarkers = (markerConfig.markers || []).slice();

  function updateMarkers() {
    markerMeshes.forEach((mesh) => globeGroup.remove(mesh));
    markerMeshes = [];
    if (!currentMarkers.length) return;
    const markerSize = 0.01 * markerRadiusMultiplier;
    const markerGeometry = new SphereGeometry(markerSize, 16, 16);
    const markerColorObj = new Color(markerConfig.color || '#ffffff');
    currentMarkers.forEach((marker) => {
      if (!marker || typeof marker.lat !== 'number' || typeof marker.lng !== 'number') return;
      const pos = latLngToPosition(marker.lat, marker.lng);
      const markerMaterial = new MeshBasicMaterial({ color: markerColorObj });
      const markerMesh = new Mesh(markerGeometry, markerMaterial);
      markerMesh.position.set(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius);
      markerMesh.userData.marker = marker;
      globeGroup.add(markerMesh);
      markerMeshes.push(markerMesh);
    });
    applyMarkerScale();
    renderer.render(scene, camera);
  }

  // Compense le zoom caméra pour que les points gardent une taille à l'écran
  // à peu près constante au lieu de grossir démesurément en se rapprochant.
  function applyMarkerScale() {
    const s = 1 / zoom;
    markerMeshes.forEach((mesh) => mesh.scale.setScalar(s));
  }

  async function loadWorldData() {
    try {
      const landFeatures = await _loadLandFeatures();

      if (showOutline && outlineColor && outlineRgba.a > 0) {
        const outlineMaterial = new MeshBasicMaterial({
          color: new Color(outlineColor),
          transparent: outlineRgba.a < 1,
          opacity: outlineRgba.a,
          depthTest: true,
          depthWrite: true,
        });
        const processRing = (ring) => {
          if (ring.length < 2) return;
          const simplifiedRing = simplifyRing(ring, detail);
          const points = simplifiedRing.map(([lng, lat]) => {
            const pos = latLngToPosition(lat, lng);
            return new Vector3(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius);
          });
          if (points.length > 0 && points[0].distanceTo(points[points.length - 1]) > 0.001) {
            points.push(points[0].clone());
          }
          if (points.length < 2) return;
          const radius = (outlineWidth / 10) * 0.01;
          const tubeMesh = new Mesh(pointsToTube(points, radius), outlineMaterial);
          tubeMesh.renderOrder = 0;
          continentOutlineGroup.add(tubeMesh);
        };
        landFeatures.features.forEach((feature) => {
          const featureType = (feature.properties?.featurecla || feature.properties?.type || '').toLowerCase();
          const featureName = (feature.properties?.name || '').toLowerCase();
          if (['graticule', 'grid', 'line'].some((k) => featureType.includes(k) || featureName.includes(k))) return;
          const geometry = feature.geometry;
          if (!geometry || !geometry.coordinates) return;
          if (geometry.type === 'Polygon' && geometry.coordinates.length > 0) {
            processRing(geometry.coordinates[0]);
          } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((polygon) => { if (polygon.length > 0) processRing(polygon[0]); });
          }
        });
      }

      const bitmapWidth = 2048;
      const bitmapHeight = 1024;
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = bitmapWidth;
      offscreenCanvas.height = bitmapHeight;
      const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas non supporté');
      const rasterProjection = geoEquirectangular().fitSize([bitmapWidth, bitmapHeight], { type: 'Sphere' });
      const rasterPath = geoPath().projection(rasterProjection).context(ctx);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, bitmapWidth, bitmapHeight);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      landFeatures.features.forEach((feature) => rasterPath(feature));
      ctx.fill();
      const pixels = ctx.getImageData(0, 0, bitmapWidth, bitmapHeight).data;
      const isOnLand = (lng, lat) => {
        const x = Math.round(((lng + 180) / 360) * bitmapWidth) % bitmapWidth;
        const y = Math.max(0, Math.min(bitmapHeight - 1, Math.round(((90 - lat) / 180) * bitmapHeight)));
        return pixels[(y * bitmapWidth + x) * 4] > 128;
      };

      if (fill === 'solid') {
        const texW = 1024, texH = 512;
        const fillCanvas = document.createElement('canvas');
        fillCanvas.width = texW;
        fillCanvas.height = texH;
        const fctx = fillCanvas.getContext('2d');
        const img = fctx.createImageData(texW, texH);
        const data = img.data;
        const fr = Math.round(fillRgba.r * 255), fg = Math.round(fillRgba.g * 255), fb = Math.round(fillRgba.b * 255), fa = Math.round((fillRgba.a || 1) * 255);
        for (let ty = 0; ty < texH; ty++) {
          for (let tx = 0; tx < texW; tx++) {
            const u = tx / texW, v = ty / texH;
            let lng = (u - 0.25) * 360;
            lng = ((((lng + 180) % 360) + 360) % 360) - 180;
            const lat = (v - 0.5) * 180;
            const idx = (ty * texW + tx) * 4;
            if (allDots || isOnLand(lng, lat)) {
              data[idx] = fr; data[idx + 1] = fg; data[idx + 2] = fb; data[idx + 3] = fa;
            } else {
              data[idx + 3] = 0;
            }
          }
        }
        fctx.putImageData(img, 0, 0);
        const fillTexture = new CanvasTexture(fillCanvas);
        fillTexture.flipY = false;
        fillTexture.needsUpdate = true;
        const fillMaterial = new MeshBasicMaterial({ map: fillTexture, transparent: true });
        dotInstances = new Mesh(new SphereGeometry(globeRadius * 1.002, 64, 64), fillMaterial);
        globeGroup.add(dotInstances);
      } else {
        const dotCoordinates = [];
        const baseStep = dotSpacing * 0.08;
        for (let lat = -90; lat <= 90; lat += baseStep) {
          const cosLat = Math.cos((Math.abs(lat) * Math.PI) / 180);
          const lngStep = cosLat > 0.01 ? baseStep / Math.max(0.3, cosLat) : 360;
          for (let lng = -180; lng < 180; lng += lngStep) {
            if (allDots || isOnLand(lng, lat)) dotCoordinates.push([lng, lat]);
          }
        }
        if (dotCoordinates.length > 0) {
          const dotGeometry = new SphereGeometry(0.01 * dotSizeMultiplier, 4, 4);
          const dotMaterial = new MeshBasicMaterial({
            color: new Color(dots.color || '#999999'),
            transparent: dotRgba.a < 1 || dotRgba.a === 0,
            opacity: dotRgba.a,
          });
          const instanced = new InstancedMesh(dotGeometry, dotMaterial, dotCoordinates.length);
          const matrix = new Matrix4();
          dotCoordinates.forEach(([lng, lat], i) => {
            const pos = latLngToPosition(lat, lng);
            matrix.makeScale(1, 1, 1);
            matrix.setPosition(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius);
            instanced.setMatrixAt(i, matrix);
          });
          instanced.instanceMatrix.needsUpdate = true;
          dotInstances = instanced;
          globeGroup.add(dotInstances);
        }
      }

      updateMarkers();
      renderer.render(scene, camera);
      canvas.style.opacity = '1';
    } catch (err) {
      console.error('[Globe]', err);
      if (onError) onError(err);
    }
  }

  // ── Rotation / interaction ──────────────────────────────────────────────
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity .3s';

  const initialLongitudeRad = (initialLongitude * Math.PI) / 180;
  const initialLatitudeRad = (initialLatitude * Math.PI) / 180;
  const rotation = { x: initialLongitudeRad, y: initialLatitudeRad };
  const targetRotation = { x: initialLongitudeRad, y: initialLatitudeRad };
  const velocity = { x: 0, y: 0 };
  let isDragging = false;
  let isHovering = false;
  let lastMouseX = 0, lastMouseY = 0;
  let animationFrameId = null;
  let destroyed = false;
  const lerpFactor = smoothingN === 0 ? 1 : mapLinear(smoothingN, 0, 1, 0.4, 0.03);
  const velocityDecay = mapLinear(smoothingN, 0, 1, 0.7, 0.96);

  function animate() {
    if (destroyed) return;
    let needsRender = false;
    const threshold = 0.01;
    if (!isDragging && rotationSpeed !== 0 && (!stopOnHover || !isHovering)) {
      targetRotation.x += rotationSpeed * 0.01;
    }
    if (!isDragging && smoothingN > 0) {
      if (Math.abs(velocity.x) > threshold || Math.abs(velocity.y) > threshold) {
        targetRotation.x += velocity.x;
        targetRotation.y += velocity.y;
        targetRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotation.y));
        velocity.x *= velocityDecay;
        velocity.y *= velocityDecay;
      } else {
        velocity.x = 0; velocity.y = 0;
      }
    }
    const dx = targetRotation.x - rotation.x;
    const dy = targetRotation.y - rotation.y;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold || rotationSpeed !== 0 || isDragging) {
      rotation.x += dx * lerpFactor;
      rotation.y += dy * lerpFactor;
      rotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.y));
      needsRender = true;
    }
    if (needsRender || rotationSpeed !== 0 || isDragging) {
      globeGroup.rotation.y = rotation.x;
      globeGroup.rotation.x = rotation.y;
      renderer.render(scene, camera);
    }
    const hasVelocity = Math.abs(velocity.x) > threshold || Math.abs(velocity.y) > threshold;
    const hasLerpDelta = Math.abs(dx) > threshold || Math.abs(dy) > threshold;
    if (isDragging || rotationSpeed !== 0 || hasVelocity || hasLerpDelta) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      animationFrameId = null;
    }
  }
  function startAnimation() {
    if (animationFrameId === null) animationFrameId = requestAnimationFrame(animate);
  }
  if (rotationSpeed !== 0) startAnimation();

  const raycaster = new Raycaster();
  const mouse = new Vector2();

  function markerAtClient(clientX, clientY) {
    if (!markerMeshes.length) return null;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(markerMeshes)[0];
    return hit ? hit.object.userData.marker : null;
  }

  // Centre le globe sur (lat, lng) et zoome — dérivé de la composition de
  // rotations Three.js (ordre Euler XYZ, roll nul) pour amener le point
  // exactement face à la caméra : yaw = -lng, pitch = lat.
  function focusOn(marker, targetZoom) {
    targetRotation.x = -(marker.lng * Math.PI / 180);
    targetRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, marker.lat * Math.PI / 180));
    velocity.x = 0; velocity.y = 0;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
    applyCamera();
    applyMarkerScale();
    startAnimation();
  }

  function handleMouseDown(event) {
    isDragging = true;
    velocity.x = 0; velocity.y = 0;
    lastMouseX = event.clientX; lastMouseY = event.clientY;
    const downX = event.clientX, downY = event.clientY;
    let moved = 0;
    canvas.style.cursor = 'grabbing';
    startAnimation();
    const handleMouseMoveDrag = (moveEvent) => {
      const sensitivity = mapDragSpeedUiToSensitivity(dragSpeed);
      const dx = moveEvent.clientX - lastMouseX;
      const dy = moveEvent.clientY - lastMouseY;
      moved += Math.abs(dx) + Math.abs(dy);
      targetRotation.x += dx * sensitivity;
      targetRotation.y += dy * sensitivity;
      targetRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotation.y));
      velocity.x = dx * sensitivity * 0.3;
      velocity.y = dy * sensitivity * 0.3;
      lastMouseX = moveEvent.clientX; lastMouseY = moveEvent.clientY;
    };
    const handleMouseUp = (upEvent) => {
      document.removeEventListener('mousemove', handleMouseMoveDrag);
      document.removeEventListener('mouseup', handleMouseUp);
      isDragging = false;
      canvas.style.cursor = 'grab';
      // Clic (pas glissé) sur un marqueur → centre + zoome dessus
      if (moved < 4 && Math.abs(upEvent.clientX - downX) < 4 && Math.abs(upEvent.clientY - downY) < 4) {
        const marker = markerAtClient(upEvent.clientX, upEvent.clientY);
        if (marker) {
          focusOn(marker, Math.max(zoom, MAX_ZOOM * 0.9));
          if (onMarkerClick) onMarkerClick(marker, upEvent.clientX, upEvent.clientY);
        }
      }
    };
    document.addEventListener('mousemove', handleMouseMoveDrag);
    document.addEventListener('mouseup', handleMouseUp);
  }
  canvas.addEventListener('mousedown', handleMouseDown);

  function handleWheel(event) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0012);
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    applyCamera();
    applyMarkerScale();
    renderer.render(scene, camera);
  }
  canvas.addEventListener('wheel', handleWheel, { passive: false });

  let hoveredMarker = null;
  function handleMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (stopOnHover) {
      isHovering = raycaster.intersectObject(oceanMesh).length > 0;
    }

    if (onMarkerHover) {
      const hit = markerMeshes.length ? raycaster.intersectObjects(markerMeshes)[0] : null;
      const marker = hit ? hit.object.userData.marker : null;
      canvas.style.cursor = (marker && !isDragging) ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
      if (marker !== hoveredMarker) {
        hoveredMarker = marker;
        onMarkerHover(marker, event.clientX, event.clientY);
      } else if (marker) {
        onMarkerHover(marker, event.clientX, event.clientY);
      }
    }
  }
  canvas.addEventListener('mousemove', handleMouseMove);
  function handleMouseLeave() {
    isHovering = false;
    if (onMarkerHover && hoveredMarker) { hoveredMarker = null; onMarkerHover(null, 0, 0); }
  }
  canvas.addEventListener('mouseleave', handleMouseLeave);

  const resizeObserver = new ResizeObserver(() => {
    const newWidth = containerEl.clientWidth || 800;
    const newHeight = containerEl.clientHeight || 600;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
    applyCamera();
    renderer.render(scene, camera);
  });
  resizeObserver.observe(containerEl);

  loadWorldData();

  function destroy() {
    destroyed = true;
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mouseleave', handleMouseLeave);
    canvas.removeEventListener('wheel', handleWheel);
    resizeObserver.disconnect();
    renderer.dispose();
    if (containerEl.parentNode) containerEl.parentNode.removeChild(containerEl);
  }

  function setMarkers(markers) {
    currentMarkers = (markers || []).slice();
    updateMarkers();
  }

  return { destroy, setMarkers };
}

if (typeof window !== 'undefined') {
  window.HandiplageGlobe = { create };
}
