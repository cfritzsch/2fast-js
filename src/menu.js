const SETTINGS_KEY = "tooFast_settings_v1";

const DEFAULT_SETTINGS = {
  track: "maps/track.json",
  car: "cars/default.json",
  carColor: "#0a6e96",
  roofColor: "#1ea6db",
  playerName: "Player",
  gyroEnabled: false,
  gyroSensitivity: 1.0,
  showGhost: true,
  hudShowRpm: true,
  hudShowSpeed: true,
  hudShowMinimap: true,
  cameraZoom: 1
};

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    saved = {};
  }
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function initMenu({ onStart }) {
  const settings = loadSettings();

  const menuRoot = document.getElementById("menu");
  const startBtn = document.getElementById("menu-start");
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  const navButtons = Array.from(document.querySelectorAll("[data-target]"));
  const backButtons = Array.from(document.querySelectorAll("[data-back]"));

  const trackList = document.getElementById("track-list");
  const carList = document.getElementById("car-list");
  const carColor = document.getElementById("car-color");
  const roofColor = document.getElementById("roof-color");
  const carSwatch = document.getElementById("car-swatch");
  const roofSwatch = document.getElementById("roof-swatch");

  const playerName = document.getElementById("player-name");
  const gyroToggle = document.getElementById("gyro-enabled");
  const gyroSensitivity = document.getElementById("gyro-sensitivity");
  const gyroValue = document.getElementById("gyro-value");
  const optionsGhost = document.getElementById("options-ghost");
  const optionsHudRpm = document.getElementById("options-hud-rpm");
  const optionsHudSpeed = document.getElementById("options-hud-speed");
  const optionsHudMinimap = document.getElementById("options-hud-minimap");
  const optionsZoom = document.getElementById("options-zoom");

  function showPanel(id) {
    panels.forEach(panel => {
      panel.classList.toggle("is-active", panel.dataset.panel === id);
    });
  }

  function hideMenu() {
    menuRoot.classList.add("is-hidden");
  }

  function showMenu() {
    menuRoot.classList.remove("is-hidden");
    void populateTracks(trackList, settings);
  }

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => showPanel(btn.dataset.target));
  });
  backButtons.forEach(btn => {
    btn.addEventListener("click", () => showPanel("main"));
  });

  startBtn.addEventListener("click", () => {
    saveSettings(settings);
    hideMenu();
    if (onStart) onStart({ ...settings });
  });

  await populateTracks(trackList, settings);
  await populateCars(carList, settings);

  carColor.value = settings.carColor;
  roofColor.value = settings.roofColor;
  updateColorSwatches();

  carColor.addEventListener("input", () => {
    settings.carColor = carColor.value;
    saveSettings(settings);
    updateColorSwatches();
  });
  roofColor.addEventListener("input", () => {
    settings.roofColor = roofColor.value;
    saveSettings(settings);
    updateColorSwatches();
  });

  playerName.value = settings.playerName;
  playerName.addEventListener("input", () => {
    settings.playerName = playerName.value.trim() || DEFAULT_SETTINGS.playerName;
    saveSettings(settings);
  });

  gyroToggle.checked = settings.gyroEnabled;
  gyroSensitivity.value = settings.gyroSensitivity.toString();
  gyroValue.textContent = settings.gyroSensitivity.toFixed(2);

  gyroToggle.addEventListener("change", () => {
    settings.gyroEnabled = gyroToggle.checked;
    saveSettings(settings);
  });

  gyroSensitivity.addEventListener("input", () => {
    settings.gyroSensitivity = Number(gyroSensitivity.value);
    gyroValue.textContent = settings.gyroSensitivity.toFixed(2);
    saveSettings(settings);
  });

  optionsGhost.checked = settings.showGhost !== false;
  optionsHudRpm.checked = settings.hudShowRpm !== false;
  optionsHudSpeed.checked = settings.hudShowSpeed !== false;
  optionsHudMinimap.checked = settings.hudShowMinimap !== false;
  optionsZoom.value = String(
    typeof settings.cameraZoom === "number" ? settings.cameraZoom : 1
  );

  optionsGhost.addEventListener("change", () => {
    settings.showGhost = optionsGhost.checked;
    saveSettings(settings);
  });
  optionsHudRpm.addEventListener("change", () => {
    settings.hudShowRpm = optionsHudRpm.checked;
    saveSettings(settings);
  });
  optionsHudSpeed.addEventListener("change", () => {
    settings.hudShowSpeed = optionsHudSpeed.checked;
    saveSettings(settings);
  });
  optionsHudMinimap.addEventListener("change", () => {
    settings.hudShowMinimap = optionsHudMinimap.checked;
    saveSettings(settings);
  });
  optionsZoom.addEventListener("input", () => {
    settings.cameraZoom = Number(optionsZoom.value);
    saveSettings(settings);
  });

  showMenu();
  showPanel("main");

  function updateColorSwatches() {
    carSwatch.style.background = settings.carColor;
    roofSwatch.style.background = settings.roofColor;
  }

  return {
    showMenu,
    hideMenu,
    showPanel,
    getSettings: () => ({ ...settings })
  };
}

async function populateTracks(container, settings) {
  container.innerHTML = "";
  const files = await loadManifest("maps/manifest.json", ["track.json"]);
  const tracks = await Promise.all(files.map(async file => {
    const path = `maps/${file}`;
    const meta = await fetch(path).then(r => r.json());
    const imgPath = meta.imgPath
      ? path.substring(0, path.lastIndexOf("/") + 1) + meta.imgPath
      : null;
    return { path, name: meta.name || file, imgPath };
  }));

  tracks.forEach(track => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "track-card";
    card.dataset.path = track.path;
    card.innerHTML = `
      <div class="track-preview">
        ${track.imgPath ? `<img src="${track.imgPath}" alt="${track.name} preview" loading="lazy">` : ""}
      </div>
      <div class="track-info">
        <div class="track-name">${escapeHtml(track.name)}</div>
        ${formatBestTime(track.name)}
      </div>
    `;
    if (settings.track === track.path) card.classList.add("is-selected");
    card.addEventListener("click", () => {
      settings.track = track.path;
      saveSettings(settings);
      container.querySelectorAll(".track-card").forEach(el => el.classList.remove("is-selected"));
      card.classList.add("is-selected");
    });
    container.appendChild(card);
  });
}

async function populateCars(container, settings) {
  container.innerHTML = "";
  const files = await loadManifest("cars/manifest.json", ["default.json"]);
  const cars = await Promise.all(files.map(async file => {
    const path = `cars/${file}`;
    const data = await fetch(path).then(r => r.json());
    return { path, name: data.name || file.replace(".json", "") };
  }));

  cars.forEach(car => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "car-card";
    card.dataset.path = car.path;
    card.innerHTML = `
      <div class="car-title">${escapeHtml(car.name)}</div>
      <div class="car-chip">
        <span></span><span></span>
      </div>
    `;
    if (settings.car === car.path) card.classList.add("is-selected");
    card.addEventListener("click", () => {
      settings.car = car.path;
      saveSettings(settings);
      container.querySelectorAll(".car-card").forEach(el => el.classList.remove("is-selected"));
      card.classList.add("is-selected");
    });
    container.appendChild(card);
  });
}

async function loadManifest(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    const data = await res.json();
    if (Array.isArray(data)) return data;
  } catch {
    return fallback;
  }
  return fallback;
}

function getBestResult(trackName) {
  const raw = localStorage.getItem(`${trackName}_bestghost_v1`);
  if (!raw) return 0;
  try {
    const data = JSON.parse(raw);
    return {
      bestZeit: data.bestZeit || 0,
      carName: data.carName || ""
    };
  } catch {
    return 0;
  }
}

function formatTime(ms) {
  if (!ms) return "--:--:---";
  const total = Math.floor(ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(millis).padStart(3, "0")}`;
}

function formatBestTime(trackName) {
  const result = getBestResult(trackName);
  if (!result || !result.bestZeit) {
    return `<div class="track-time">${formatTime(0)}</div>`;
  }
  const carLabel = result.carName ? ` • ${escapeHtml(result.carName)}` : "";
  return `<div class="track-time">${formatTime(result.bestZeit)}${carLabel}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function settingsToCarColors(settings) {
  return {
    color: hexToRgb(settings.carColor),
    roofColor: hexToRgb(settings.roofColor)
  };
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
