import { updatePhysics, checkCheckpointCrossing, needsResetting, startReset, updateReset } from "./physics.js";
import { loadMap, loadCarType, createPlayer } from "./loader.js";
import { draw } from "./renderer.js";
import { loadBestGhost, recordGhostFrame} from "./ghostRecorder.js";
import { setupKeyboardInput, setupGyroInput, setupTouchInput, getSteerInput, applySteering } from "./input.js";
import { initMenu, settingsToCarColors, loadSettings, saveSettings } from "./menu.js";


const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

window.addEventListener("keydown", e => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }
});

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  ctx.imageSmoothingEnabled = false;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const player = createPlayer();

let map;
let frameStartTime = 0;
let started = false;
let loopStarted = false;
let paused = false;
let menuOpen = true;
let menuControls = null;
let inputSetup = false;
let rafId = null;
let pauseStartedAt = 0;
const isTouchDevice = () =>
  "ontouchstart" in window || navigator.maxTouchPoints > 0;

const pauseButton = document.getElementById("pause-button");
const pauseOverlay = document.getElementById("pause-overlay");
const pauseResume = document.getElementById("pause-resume");
const pauseRestart = document.getElementById("pause-restart");
const pauseMenu = document.getElementById("pause-menu");
const pauseGhost = document.getElementById("pause-ghost");
const pauseHudRpm = document.getElementById("pause-hud-rpm");
const pauseHudSpeed = document.getElementById("pause-hud-speed");
const pauseHudMinimap = document.getElementById("pause-hud-minimap");
const pauseZoom = document.getElementById("pause-zoom");

const zoomSteps = [1.3, 1.0, 0.8, 0.65];
let renderOptions = {
  showGhost: true,
  hudShowRpm: true,
  hudShowSpeed: true,
  hudShowMinimap: true,
  zoomFactor: 1.0
};

function setPauseVisible(visible) {
  pauseOverlay.classList.toggle("is-visible", visible);
}

function setPauseButtonVisible(visible) {
  pauseButton.classList.toggle("is-visible", visible && isTouchDevice());
}

function setPaused(nextPaused) {
  if (!started || menuOpen) return;
  paused = nextPaused;
  setPauseVisible(paused);
  if (paused) {
    pauseStartedAt = performance.now();
    frameStartTime = pauseStartedAt;
    syncPauseMenu();
  } else {
    const now = performance.now();
    const pauseDuration = now - pauseStartedAt;
    player.startZeit += pauseDuration;
    frameStartTime = now;
  }
}

function resetLap(now) {
  if (!map) return;
  const start = map.startPositionSP;

  player.car.position.x = start.x;
  player.car.position.y = start.y;
  player.car.lastPosition.x = start.x;
  player.car.lastPosition.y = start.y;
  player.car.winkel = start.angle;
  player.car.bewegungswinkel = start.angle;
  player.car.geschwindigkeit = 0;
  player.car.winkelbeschleunigung = 0;
  player.car.gasstatus = 0;
  player.car.bremsstatus = 0;
  player.car.lenkeinschlag = 0;
  player.car.arrowUpKeyPressed = 0;
  player.car.arrowDownKeyPressed = 0;
  player.car.gang = 1;
  player.car.upm = 0;

  player.input.keyboard.steer = 0;
  player.input.keyboard.active = false;
  player.input.mobile.touchActive = false;
  player.input.mobile.touchSteer = 0;
  player.input.mobile.gyroActive = false;
  player.input.mobile.gyroSteer = 0;

  player.akCheckpoint = 0;
  player.akRunde = 0;
  player.lastZeit = 0;
  player.startZeit = now;
  player.currentGhost = [];
  player.status = "driving";
}

function clearGame() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  loopStarted = false;
  started = false;
  paused = false;
  menuOpen = true;
  pauseStartedAt = 0;
  map = null;
  player.bestGhost = null;
  player.currentGhost = [];
  player.akCheckpoint = 0;
  player.akRunde = 0;
  player.lastZeit = 0;
  player.startZeit = 0;
  player.status = "driving";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderOptions = {
    showGhost: true,
    hudShowRpm: true,
    hudShowSpeed: true,
    hudShowMinimap: true,
    zoomFactor: 1.0
  };
}

async function startGame(settings) {
  started = true;
  menuOpen = false;
  paused = false;
  setPauseButtonVisible(true);
  setPauseVisible(false);
  pauseStartedAt = 0;

  // Load map image + tile info
  map = await loadMap(settings.track);

  // Load car type info
  player.car.autotyp = await loadCarType(settings.car);
  const colors = settingsToCarColors(settings);
  player.car.color = colors.color;
  player.car.roofColor = colors.roofColor;
  player.name = settings.playerName;

  player.bestZeit = 0;
  player.bestGhost = null;
  const saved = loadBestGhost(map);
  if (saved) {
    player.bestZeit = saved.bestZeit;
    player.bestGhost = saved.ghost;
  }

  const start = map.startPositionSP;

  player.akCheckpoint = 0;
  player.akRunde = 0;
  player.lastZeit = 0;
  player.currentGhost = [];
  player.status = "driving";

  player.car.position.x = start.x;
  player.car.position.y = start.y;
  player.car.lastPosition.x = start.x;
  player.car.lastPosition.y = start.y;
  player.car.winkel = start.angle;
  player.car.bewegungswinkel = start.angle;
  player.car.geschwindigkeit = 0;
  player.car.gasstatus = 0;
  player.car.bremsstatus = 0;
  player.car.lenkeinschlag = 0;
  player.car.arrowUpKeyPressed = 0;
  player.car.arrowDownKeyPressed = 0;
  player.startZeit = performance.now();
  if (!inputSetup) {
    setupKeyboardInput(player);
    setupTouchInput(player);
    inputSetup = true;
  }
  setupGyroInput(player, { sensitivity: settings.gyroSensitivity, enabled: settings.gyroEnabled });
  applyRenderSettings(settings);

  if (!loopStarted) {
    loopStarted = true;
    rafId = requestAnimationFrame(loop);
  }
}

function loop(time) {
  if (!map || menuOpen || paused) {
    if (menuOpen && !started) {
      return;
    }
    frameStartTime = time;
    if (map) {
      const renderTime = paused ? pauseStartedAt : time;
      draw(ctx, canvas, player, map, renderTime, renderOptions);
    }
    rafId = requestAnimationFrame(loop);
    return;
  }

  const dt = (time - frameStartTime) / 1000;
  //console.log(1/dt + ' fps')
  frameStartTime = time;

  if (player.status === "resetting") {
    updateReset(player, time);
  } else {

    const steerInput = getSteerInput(player);
    applySteering(player.car, steerInput, dt);

    updatePhysics(player, map, dt);

    checkCheckpointCrossing(player, map, frameStartTime, dt);

    if (needsResetting(player.car, map)) {
      startReset(player, map, time);
    }
  }
  recordGhostFrame(player, time);
  
  draw(ctx, canvas, player, map, time, renderOptions);
  
  rafId = requestAnimationFrame(loop);
}

window.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.preventDefault();
    setPaused(!paused);
  }
});

pauseButton.addEventListener("click", () => setPaused(!paused));
pauseResume.addEventListener("click", () => setPaused(false));
pauseRestart.addEventListener("click", () => {
  resetLap(performance.now());
  setPaused(false);
});
pauseMenu.addEventListener("click", () => {
  setPauseVisible(false);
  setPauseButtonVisible(false);
  clearGame();
  if (menuControls) {
    menuControls.showMenu();
    menuControls.showPanel("main");
  }
});

pauseGhost.addEventListener("change", () => {
  renderOptions.showGhost = pauseGhost.checked;
  persistPauseSettings();
});
pauseHudRpm.addEventListener("change", () => {
  renderOptions.hudShowRpm = pauseHudRpm.checked;
  persistPauseSettings();
});
pauseHudSpeed.addEventListener("change", () => {
  renderOptions.hudShowSpeed = pauseHudSpeed.checked;
  persistPauseSettings();
});
pauseHudMinimap.addEventListener("change", () => {
  renderOptions.hudShowMinimap = pauseHudMinimap.checked;
  persistPauseSettings();
});
pauseZoom.addEventListener("input", () => {
  const idx = Number(pauseZoom.value);
  renderOptions.zoomFactor = zoomSteps[idx] ?? 1.0;
  persistPauseSettings();
});

function applyRenderSettings(settings) {
  renderOptions.showGhost = settings.showGhost !== false;
  renderOptions.hudShowRpm = settings.hudShowRpm !== false;
  renderOptions.hudShowSpeed = settings.hudShowSpeed !== false;
  renderOptions.hudShowMinimap = settings.hudShowMinimap !== false;
  const zoomIndex = typeof settings.cameraZoom === "number" ? settings.cameraZoom : 1;
  renderOptions.zoomFactor = zoomSteps[zoomIndex] ?? 1.0;
  syncPauseMenu();
}

function syncPauseMenu() {
  pauseGhost.checked = renderOptions.showGhost;
  pauseHudRpm.checked = renderOptions.hudShowRpm;
  pauseHudSpeed.checked = renderOptions.hudShowSpeed;
  pauseHudMinimap.checked = renderOptions.hudShowMinimap;
  const zoomIndex = zoomSteps.indexOf(renderOptions.zoomFactor);
  pauseZoom.value = String(zoomIndex === -1 ? 1 : zoomIndex);
}

function persistPauseSettings() {
  const current = loadSettings();
  const zoomIndex = zoomSteps.indexOf(renderOptions.zoomFactor);
  saveSettings({
    ...current,
    showGhost: renderOptions.showGhost,
    hudShowRpm: renderOptions.hudShowRpm,
    hudShowSpeed: renderOptions.hudShowSpeed,
    hudShowMinimap: renderOptions.hudShowMinimap,
    cameraZoom: zoomIndex === -1 ? 1 : zoomIndex
  });
}

initMenu({ onStart: settings => {
  if (menuControls) {
    menuControls.hideMenu();
  } else {
    const menuRoot = document.getElementById("menu");
    if (menuRoot) menuRoot.classList.add("is-hidden");
  }
  startGame(settings);
} }).then(controls => {
  menuControls = controls;
  menuOpen = true;
});
