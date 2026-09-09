import * as THREE from 'three';

// Ruido pseudo-aleatorio barato (suma de senos) — evita depender de librerías externas de noise.
function terrainNoise(x, z) {
  return (
    Math.sin(x * 0.15) * 0.6 +
    Math.cos(z * 0.18) * 0.6 +
    Math.sin((x + z) * 0.05) * 1.1 +
    Math.sin(x * 0.4 + z * 0.3) * 0.15
  );
}

const LAKE_RADIUS = 9;
const SHORE_BLEND = 4;
const LAKE_LEVEL = -0.15;

function heightAt(x, z) {
  const r = Math.sqrt(x * x + z * z);
  const raw = terrainNoise(x, z);
  if (r < LAKE_RADIUS) return LAKE_LEVEL - 0.4;
  const t = THREE.MathUtils.clamp((r - LAKE_RADIUS) / SHORE_BLEND, 0, 1);
  const smooth = t * t * (3 - 2 * t);
  return THREE.MathUtils.lerp(LAKE_LEVEL - 0.1, raw, smooth);
}

function createSky() {
  const geometry = new THREE.SphereGeometry(200, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTopColor: { value: new THREE.Color(0x1b2a52) },
      uHorizonColor: { value: new THREE.Color(0xf3a466) },
      uBottomColor: { value: new THREE.Color(0x3a2418) },
      uSunDirection: { value: new THREE.Vector3(0.35, 0.25, -0.9).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uBottomColor;
      uniform vec3 uSunDirection;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        vec3 color = h > 0.0
          ? mix(uHorizonColor, uTopColor, pow(clamp(h, 0.0, 1.0), 0.55))
          : mix(uHorizonColor, uBottomColor, pow(clamp(-h, 0.0, 1.0), 0.7));
        float sun = pow(max(dot(normalize(vWorldPos), normalize(uSunDirection)), 0.0), 220.0);
        float glow = pow(max(dot(normalize(vWorldPos), normalize(uSunDirection)), 0.0), 8.0) * 0.35;
        color += vec3(1.0, 0.85, 0.6) * (sun * 1.4 + glow);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

function createTerrain() {
  const size = 90;
  const segments = 110;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const shoreColor = new THREE.Color(0xcdb383);
  const grassNear = new THREE.Color(0x6a8f4e);
  const grassFar = new THREE.Color(0x3c5c34);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = heightAt(x, z);
    position.setY(i, y);

    const r = Math.sqrt(x * x + z * z);
    const shoreT = THREE.MathUtils.clamp((r - LAKE_RADIUS) / (SHORE_BLEND + 2), 0, 1);
    const farT = THREE.MathUtils.clamp((r - 20) / 30, 0, 1);
    const c = shoreColor.clone().lerp(grassNear, shoreT).lerp(grassFar, farT * 0.8);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function createLake() {
  const geometry = new THREE.CircleGeometry(LAKE_RADIUS, 64);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x123a4a) },
      uShallow: { value: new THREE.Color(0xf0a35f) },
      uSky: { value: new THREE.Color(0xf3a466) },
      uSunDirection: { value: new THREE.Vector3(0.35, 0.25, -0.9).normalize() },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vElevation;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float waveHeight(float x, float z) {
        return sin(x * 0.7 + uTime * 0.6) * 0.035
             + sin(z * 0.5 - uTime * 0.4) * 0.03
             + sin((x + z) * 0.9 + uTime * 0.8) * 0.015;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = waveHeight(pos.x, pos.z);
        pos.y += wave;
        vElevation = wave;

        float dx = 0.7 * cos(pos.x * 0.7 + uTime * 0.6) * 0.035
                 + 0.9 * cos((pos.x + pos.z) * 0.9 + uTime * 0.8) * 0.015;
        float dz = 0.5 * cos(pos.z * 0.5 - uTime * 0.4) * 0.03
                 + 0.9 * cos((pos.x + pos.z) * 0.9 + uTime * 0.8) * 0.015;
        vec3 normal = normalize(vec3(-dx, 1.0, -dz));
        vWorldNormal = normalize(normalMatrix * normal);
        vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunDirection;
      varying vec2 vUv;
      varying float vElevation;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        float d = distance(vUv, vec2(0.5));
        vec3 baseColor = mix(uShallow, uDeep, smoothstep(0.0, 0.5, d));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 normal = normalize(vWorldNormal);
        float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);
        vec3 color = mix(baseColor, uSky, fresnel * 0.65);

        vec3 sunDir = normalize(uSunDirection);
        vec3 reflectDir = reflect(-sunDir, normal);
        float specular = pow(max(dot(reflectDir, viewDir), 0.0), 60.0);
        color += vec3(1.0, 0.85, 0.6) * specular * 1.4;

        float sparkle = smoothstep(0.4, 1.0, vElevation * 12.0);
        color += vec3(1.0, 0.9, 0.75) * sparkle * 0.5;

        gl_FragColor = vec4(color, 0.94);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = LAKE_LEVEL;
  return { mesh, material };
}

function createTrees() {
  const count = 70;
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.09, 1, 5);
  const canopyGeo = new THREE.ConeGeometry(0.55, 1.6, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f4d2a, roughness: 0.95 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
  trunks.castShadow = true;
  canopies.castShadow = true;

  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  const canopyColorVariants = [0x2f4d2a, 0x35572e, 0x274023, 0x3c5c34];

  while (placed < count && attempts < count * 20) {
    attempts++;
    const x = (Math.random() - 0.5) * 78;
    const z = (Math.random() - 0.5) * 78;
    const r = Math.sqrt(x * x + z * z);
    if (r < LAKE_RADIUS + SHORE_BLEND + 1.5) continue;
    if (r > 38) continue;

    const y = heightAt(x, z);
    const scale = 0.8 + Math.random() * 0.9;
    const rot = Math.random() * Math.PI * 2;

    dummy.position.set(x, y + (0.5 * scale), z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);

    dummy.position.set(x, y + (1 * scale) + 0.6 * scale, z);
    dummy.updateMatrix();
    canopies.setMatrixAt(placed, dummy.matrix);
    canopies.setColorAt(placed, new THREE.Color(canopyColorVariants[placed % canopyColorVariants.length]));

    placed++;
  }
  trunks.count = placed;
  canopies.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;

  const group = new THREE.Group();
  group.add(trunks, canopies);
  return group;
}

function createMountains() {
  const group = new THREE.Group();
  const count = 12;
  const baseColor = new THREE.Color(0x4a4560);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const radius = 48 + Math.random() * 18;
    const height = 10 + Math.random() * 16;
    const geo = new THREE.ConeGeometry(9 + Math.random() * 6, height, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: baseColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08),
      roughness: 1,
      fog: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.cos(angle) * radius, height / 2 - 3, Math.sin(angle) * radius);
    mesh.rotation.y = Math.random() * Math.PI;
    group.add(mesh);
  }
  return group;
}

function createFireflies() {
  const count = 140;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = LAKE_RADIUS + 2 + Math.random() * 26;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    positions[i * 3] = x;
    positions[i * 3 + 1] = 0.3 + Math.random() * 1.8 + heightAt(x, z);
    positions[i * 3 + 2] = z;
    seeds[i] = Math.random() * 100;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      varying float vFlicker;
      void main() {
        vec3 pos = position;
        pos.x += sin(uTime * 0.4 + aSeed) * 0.6;
        pos.y += sin(uTime * 0.8 + aSeed * 1.7) * 0.35;
        pos.z += cos(uTime * 0.35 + aSeed) * 0.6;
        vFlicker = 0.5 + 0.5 * sin(uTime * 2.2 + aSeed * 3.0);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (18.0 * vFlicker + 6.0) / -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vFlicker;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * vFlicker;
        vec3 color = mix(vec3(0.6, 0.9, 0.4), vec3(1.0, 0.95, 0.6), vFlicker);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  return new THREE.Points(geometry, material);
}

function makeBirdTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(25,22,20,0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, 16);
  ctx.quadraticCurveTo(16, 2, 32, 16);
  ctx.quadraticCurveTo(48, 2, 60, 16);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBirds() {
  const texture = makeBirdTexture();
  const group = new THREE.Group();
  const birds = [];
  const total = 4;
  for (let i = 0; i < total; i++) {
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.4, 0.7, 1);
    const bird = {
      sprite,
      radius: 22 + Math.random() * 14,
      height: 9 + Math.random() * 6,
      speed: 0.06 + Math.random() * 0.03,
      offset: Math.random() * Math.PI * 2,
      flapOffset: Math.random() * 10,
    };
    birds.push(bird);
    group.add(sprite);
  }
  return {
    group,
    update(time) {
      for (const b of birds) {
        const angle = time * b.speed + b.offset;
        b.sprite.position.set(
          Math.cos(angle) * b.radius,
          b.height + Math.sin(time * 0.2 + b.offset) * 1.2,
          Math.sin(angle) * b.radius
        );
        const flap = 1 + Math.sin(time * 6 + b.flapOffset) * 0.35;
        b.sprite.scale.set(1.4 * flap, 0.7, 1);
      }
    },
  };
}

function createBreathingGuide() {
  const geometry = new THREE.SphereGeometry(0.4, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf2b880,
    emissive: 0xf2b880,
    emissiveIntensity: 1.1,
    roughness: 0.3,
    metalness: 0,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 1.35, -1.5);

  const haloGeometry = new THREE.RingGeometry(0.55, 0.62, 48);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe7c2,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.rotation.x = -Math.PI / 2;
  mesh.add(halo);

  const light = new THREE.PointLight(0xf2b880, 2.2, 8, 2);
  light.position.copy(mesh.position);

  const state = {
    currentScale: 1,
    targetScale: 1,
    currentColor: new THREE.Color(0xf2b880),
    targetColor: new THREE.Color(0xf2b880),
  };

  return {
    mesh,
    light,
    halo,
    setTarget(scale, colorHex) {
      state.targetScale = scale;
      state.targetColor.set(colorHex);
    },
    update(delta) {
      const lerpSpeed = 1 - Math.pow(0.001, delta);
      state.currentScale = THREE.MathUtils.lerp(state.currentScale, state.targetScale, lerpSpeed);
      state.currentColor.lerp(state.targetColor, lerpSpeed);
      mesh.scale.setScalar(state.currentScale);
      material.color.copy(state.currentColor);
      material.emissive.copy(state.currentColor);
      light.color.copy(state.currentColor);
      halo.scale.setScalar(1 + (state.currentScale - 1) * 0.6);
    },
  };
}

export function createSceneBundle() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2c2032, 0.018);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 250);
  camera.position.set(0, 1.65, 9.5);
  camera.lookAt(0, 1.2, 0);

  scene.add(createSky());

  const hemi = new THREE.HemisphereLight(0xf3d9b1, 0x2a3320, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffb877, 1.4);
  sun.position.set(15, 12, -20);
  scene.add(sun);

  const terrain = createTerrain();
  scene.add(terrain);

  const lake = createLake();
  scene.add(lake.mesh);

  scene.add(createTrees());
  scene.add(createMountains());

  const fireflies = createFireflies();
  scene.add(fireflies);

  const birds = createBirds();
  scene.add(birds.group);

  const breathingGuide = createBreathingGuide();
  scene.add(breathingGuide.mesh);
  scene.add(breathingGuide.light);

  function update(time, delta) {
    lake.material.uniforms.uTime.value = time;
    fireflies.material.uniforms.uTime.value = time;
    birds.update(time);
    breathingGuide.update(delta);
  }

  return { scene, camera, update, breathingGuide, heightAt };
}
