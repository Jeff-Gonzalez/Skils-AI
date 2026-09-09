import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createSceneBundle } from './scene.js';
import { BreathingSession } from './breathing.js';
import { Soundscape } from './audio.js';

const canvas = document.getElementById('scene-canvas');
const loadingScreen = document.getElementById('loading-screen');
const menuScreen = document.getElementById('menu-screen');
const endScreen = document.getElementById('end-screen');
const hud = document.getElementById('session-hud');

const patternSelect = document.getElementById('pattern-select');
const durationSelect = document.getElementById('duration-select');
const volumeRange = document.getElementById('volume-range');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const exitBtn = document.getElementById('exit-btn');
const restartBtn = document.getElementById('restart-btn');
const closeBtn = document.getElementById('close-btn');
const vrHint = document.getElementById('vr-hint');

const breathRing = document.getElementById('breath-ring');
const breathLabel = document.getElementById('breath-label');
const sessionTimerEl = document.getElementById('session-timer');
const endMessage = document.getElementById('end-message');

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;

// --- Escena procedural (bosque + lago al atardecer) ---
const { scene, camera, update: updateScene, breathingGuide } = createSceneBundle();

// --- Controles de escritorio / táctil ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 14;
controls.minPolarAngle = Math.PI * 0.15;
controls.maxPolarAngle = Math.PI * 0.55;
controls.target.set(0, 1.2, -1);
controls.update();

// --- Botón de entrada a Realidad Virtual (WebXR) ---
const vrButtonContainer = document.getElementById('vr-button-container');
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (supported) {
      vrHint.textContent = 'Visor de realidad virtual detectado: pulsa "Entrar en RV" durante la práctica.';
      vrButtonContainer.appendChild(VRButton.createButton(renderer));
    } else {
      vrHint.textContent = 'Tu navegador soporta WebXR, pero no se detectó un visor VR. Puedes practicar igualmente en pantalla.';
    }
  }).catch(() => {
    vrHint.textContent = 'Practica en pantalla arrastrando para mirar alrededor. Usa un navegador compatible con WebXR para RV.';
  });
} else {
  vrHint.textContent = 'Este navegador no soporta WebXR todavía. Puedes practicar en pantalla arrastrando para mirar alrededor.';
}

// --- Audio ---
const soundscape = new Soundscape();

// --- Estado de sesión ---
let breathingSession = null;
let sessionDurationTotal = 0;
let sessionSecondsLeft = 0;
let sessionActive = false;
let paused = false;
const clock = new THREE.Clock();

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function onPhaseChange(phase) {
  breathLabel.textContent = phase.name;
  breathRing.style.transitionDuration = `${phase.seconds}s`;
  breathRing.style.transform = `scale(${phase.scale})`;
  breathRing.style.background = `radial-gradient(circle, rgba(${hexToRgb(phase.color)}, 0.32), rgba(${hexToRgb(phase.color)}, 0.02) 70%)`;
  breathingGuide.setTarget(phase.scale, phase.color);
  soundscape.chime(phase.name === 'Inhala' ? 528 : phase.name === 'Exhala' ? 396 : 480);
}

function hexToRgb(hex) {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `${r}, ${g}, ${b}`;
}

async function startSession() {
  const patternKey = patternSelect.value;
  sessionDurationTotal = parseInt(durationSelect.value, 10);
  sessionSecondsLeft = sessionDurationTotal;

  await soundscape.start();
  soundscape.setVolume(volumeRange.value / 100);

  breathingSession = new BreathingSession(patternKey, onPhaseChange);
  sessionActive = true;
  paused = false;
  pauseBtn.textContent = '⏸';

  menuScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  sessionTimerEl.textContent = sessionDurationTotal > 0 ? formatTime(sessionSecondsLeft) : '∞';
}

function endSession(message) {
  sessionActive = false;
  breathingSession = null;
  hud.classList.add('hidden');
  endMessage.textContent = message || 'Tómate un momento antes de continuar con tu día. Nota cómo se siente tu cuerpo ahora mismo.';
  endScreen.classList.remove('hidden');
  soundscape.setVolume(0);
}

startBtn.addEventListener('click', startSession);
restartBtn.addEventListener('click', () => {
  endScreen.classList.add('hidden');
  menuScreen.classList.remove('hidden');
});
closeBtn.addEventListener('click', () => {
  endScreen.classList.add('hidden');
  menuScreen.classList.remove('hidden');
});
exitBtn.addEventListener('click', () => endSession('Sesión interrumpida. Puedes volver cuando lo necesites.'));

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  if (breathingSession) breathingSession.setPaused(paused);
  pauseBtn.textContent = paused ? '▶' : '⏸';
  soundscape.setVolume(paused ? 0 : volumeRange.value / 100);
});

volumeRange.addEventListener('input', () => {
  if (sessionActive && !paused) soundscape.setVolume(volumeRange.value / 100);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Bucle de animación (compatible con WebXR) ---
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.getElapsedTime();

  updateScene(elapsed, delta);
  controls.update();

  if (sessionActive && !paused) {
    breathingSession.update(delta);

    if (sessionDurationTotal > 0) {
      sessionSecondsLeft -= delta;
      if (sessionSecondsLeft <= 0) {
        endSession('Práctica completada. Respira una vez más antes de continuar.');
      } else {
        sessionTimerEl.textContent = formatTime(sessionSecondsLeft);
      }
    }
  }

  renderer.render(scene, camera);
});

// Primer frame listo: ocultar pantalla de carga y mostrar menú.
requestAnimationFrame(() => {
  loadingScreen.classList.add('hidden');
  menuScreen.classList.remove('hidden');
});
