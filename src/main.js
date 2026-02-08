import { updatePhysics, checkCheckpointCrossing, needsResetting, startReset, updateReset } from "./physics.js";
import { loadMap, loadCarType, createPlayer } from "./loader.js";
import { draw } from "./renderer.js";
import { loadBestGhost, recordGhostFrame} from "./ghostRecorder.js";
import { setupKeyboardInput, setupGyroInput, setupTouchInput, getSteerInput, applySteering } from "./input.js";


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

async function init() {
  // Load map image + tile info
  map = await loadMap("maps/track.json");

  // Load car type info
  player.car.autotyp = await loadCarType("cars/default.json");

  const saved = loadBestGhost(map);
  if (saved) {
    player.bestZeit = saved.bestZeit;
    player.bestGhost = saved.ghost;
  }

  const start = map.startPositionSP;

  player.car.position.x = start.x;
  player.car.position.y = start.y;
  player.car.winkel = start.angle;
  player.car.bewegungswinkel = start.angle;
  player.startZeit = performance.now();
  setupKeyboardInput(player);
  // setupGyroInput(player);
  setupTouchInput(player);

  requestAnimationFrame(loop);
}

function loop(time) {
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
  
  draw(ctx, canvas, player, map, time);
  
  requestAnimationFrame(loop);
}

init();
