import { saveBestGhost } from "./ghostRecorder.js";

function gearMulti(gear) {
  switch (gear) {
    case -1: return 3.5;  // Rückwärtsgang
    case 1: return 2.66;
    case 2: return 1.78;
    case 3: return 1.3;
    case 4: return 1.0;
    case 5: return 0.84;
    case 6: return 0.5;
    default: return 2.66;
  }
}

export function speedToUpm(car) {
  const speed = Math.abs(car.geschwindigkeit);

  const upm =
    Math.floor(
      speed /
      Radradius *
      gearMulti(car.gang) *
      Differential *
      30 /
      Math.PI
    );

  car.upm = upm;
  return upm;
}

export function autoGear(car) {
  if (car.geschwindigkeit >= 0) {
    if (car.gang === -1) car.gang = 1;

    if (car.upm < 1000) car.upm = 1000;

    if (car.upm > 5500 && car.gang < 5) car.gang++;
    if (car.upm < 3200 && car.gang > 1) car.gang--;
  } else {
    car.gang = -1;
  }
}

export function upmToTorque(car) {
  const table = car.autotyp.drehmomenttabelle;

  let i = 0;
  while (table[i].upm <= car.upm) {
    i++;
  }
  i--;

  const t1 = table[i];
  const t2 = table[i + 1];

  const diff =
    (car.upm - t1.upm) /
    (t2.upm - t1.upm);

  const torque =
    t1.drehmoment * (1 - diff) +
    t2.drehmoment * diff;

  return Math.floor(torque);
}

export function getDrehmoment(car) {
  speedToUpm(car);   // Geschwindigkeit → UPM
  autoGear(car);     // UPM → Gangwechsel
  return upmToTorque(car); // UPM → Drehmoment
}



export function getTileAt(map, tx, ty) {
  // harte Bounds wie früher
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) {
    return map.tiles[0]; // Default Tile
  }

  const idx = map.materialIndex[ty * map.width + tx];

  if (idx == null || map.tiles[idx] == null) {
    return map.tiles[0];
  }

  return map.tiles[idx];
}

function updateTilePhysics(car, map) {
  const tx = Math.floor(car.position.x / map.metersPerPixel);
  const ty = Math.floor(car.position.y / map.metersPerPixel);

  const tile = getTileAt(map, tx, ty);

  car.rutschigkeit = tile.rutsch / 100;
  car.bremswirkung = tile.brems / 1000;
}

const Luftwiderstand = 0.5;
const Rollwiderstand = 18;
const Bremswiderstand = 26000;
const Effizienz = 0.7;
const Differential = 3.42;
const Radradius = 0.33;

export function updatePhysics(player, map, dt) {
  const car = player.car;

  updateTilePhysics(car, map)

  // === Kräfte ===
  // Drehmoment -> Motorkraft
  const drehmoment = getDrehmoment(car);
  const Fmotor =
    drehmoment *
    car.gasstatus *
    gearMulti(car.gear) *
    Differential *
    Effizienz /
    Radradius *
    car.autotyp.motorkraft;

  const Fluft =
    -Luftwiderstand *
    car.autotyp.luftwiderstand *
    car.geschwindigkeit *
    Math.abs(car.geschwindigkeit);

  const Froll =
    -Rollwiderstand *
    (10 + car.geschwindigkeit) * // base Rollwiderstand = 10 * Rollwiderstand
    (1 + car.bremswirkung);

  const Fbrems =
    -car.bremsstatus *
    Bremswiderstand *
    car.autotyp.bremswiderstand;

  let Fges;
  if (car.geschwindigkeit >= 0) {
    Fges = Fmotor + Fluft + Froll + Fbrems;
  } else {
    Fges = -Fmotor + Fluft + Froll - Fbrems;
  }

  // === Kollisionsabfrage setzt Rutschigkeit & Bremswirkung ===
  // checkCollision(car, map);

  // === Rutschfaktor ===
  const v = Math.abs(car.geschwindigkeit);
  let rutschfaktor = 0.7 / ((v * v + 150) / 150);
  rutschfaktor *= car.rutschigkeit;

  // === Winkelbeschleunigung abbauen ===
  car.winkelbeschleunigung -=
    car.winkelbeschleunigung * (rutschfaktor / 2);

  if (Math.abs(car.winkelbeschleunigung) < 0.05) {
    car.winkelbeschleunigung = 0;
  }

  // === Beschleunigung ===
  const beschleunigung = Fges / car.autotyp.masse;

  // Richtungswechsel -> Switch Gas - Bremse
  if (car.geschwindigkeit != 0 && car.geschwindigkeit + dt * beschleunigung != 0) {
    if (Math.sign(car.geschwindigkeit + dt * beschleunigung) != Math.sign(Math.sign(car.geschwindigkeit) + 0.0)) {
      // Wechsel Gas und Bremse, auch wenn kein Tastenwechsel erfolgte
      if ((car.geschwindigkeit + dt * beschleunigung) > 0) {
        car.gasstatus = car.arrowUpKeyPressed;
        car.bremsstatus = car.arrowDownKeyPressed;
      } else {
        car.gasstatus = car.arrowDownKeyPressed;
        car.bremsstatus = car.arrowUpKeyPressed;
      }
    }
  }
  
  // === Geschwindigkeit ===
  if (car.geschwindigkeit == 0 && car.arrowDownKeyPressed) {
    car.geschwindigkeit -= dt * beschleunigung; // Rückwärts fahren aus dem Stand
  } else {
    car.geschwindigkeit += dt * beschleunigung;
  }
  if (Math.abs(car.geschwindigkeit) < 0.5 && (car.arrowUpKeyPressed == 0 && car.arrowDownKeyPressed == 0)) {
    car.geschwindigkeit = 0;
  }

  // === Kurvenphysik (kritisch!) ===
  let winkelgeschwindigkeit;

  if (car.lenkeinschlag === 0) {
    winkelgeschwindigkeit = car.winkelbeschleunigung * dt;
  } else {
    const kurvenradius =
      car.autotyp.radstand /
      Math.sin(car.lenkeinschlag) *
      ((v * v + 500) / 500);       // Radius ist Geschwindigkeitsabhängig -> Untersteuern

    winkelgeschwindigkeit =
      v / kurvenradius +
      car.winkelbeschleunigung * dt;
  }

  // === Rutschdämpfung ===
  car.geschwindigkeit *=
    (Math.cos(car.bewegungswinkel - car.winkel) + 49) / 50;

  // === Blickwinkel ===
  car.winkel += winkelgeschwindigkeit * dt;

  // === Bewegungswinkel (DER DRIFT!) ===
  car.bewegungswinkel -=
    (car.bewegungswinkel - car.winkel) * rutschfaktor;

  // === Alte Position -> für Kollision
  car.lastPosition.x = car.position.x;
  car.lastPosition.y = car.position.y;

  // === Position (Originalformel!) ===
  car.position.x +=
    Math.cos(car.bewegungswinkel) *
    car.geschwindigkeit *
    dt;

  car.position.y +=
    Math.sin(car.bewegungswinkel) *
    car.geschwindigkeit *
    dt;
}


// Kollision

function segmentIntersection(A, B, C, D) {
  const r = { x: B.x - A.x, y: B.y - A.y };
  const s = { x: D.x - C.x, y: D.y - C.y };

  const denom = r.x * s.y - r.y * s.x;
  if (denom === 0) return null; // parallel

  const uNumerator = (C.x - A.x) * r.y - (C.y - A.y) * r.x;
  const tNumerator = (C.x - A.x) * s.y - (C.y - A.y) * s.x;

  const t = tNumerator / denom;
  const u = uNumerator / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return t; // Prozent auf A->B
  }

  return null;
}

function isCorrectDirection(A, B, C, D) {
  const cpDir = { x: D.x - C.x, y: D.y - C.y };
  const moveDir = { x: B.x - A.x, y: B.y - A.y };

  return cpDir.x * moveDir.y - cpDir.y * moveDir.x > 0;
}

export function checkCheckpointCrossing(player, map, frameStartTime, dt) {
  const car = player.car;
  const cp = map.checkpoints[player.akCheckpoint];

  const A = car.lastPosition;
  const B = car.position;
  const C = {x: cp.x1, y: cp.y1};
  const D = {x: cp.x2, y: cp.y2};

  const t = segmentIntersection(A, B, C, D);

  if (t !== null) {
  // if (t !== null && isCorrectDirection(A, B, C, D)) {
    // Interpolierte Zeit an der Checkpoint durchfahren wurde
    const crossingTime = frameStartTime + t * dt * 1000;

    handleCheckpointHit(player, map, crossingTime);
  }
}

function handleCheckpointHit(player, map, crossingTime) {
  const isStartFinish = player.akCheckpoint === 0;

  if (isStartFinish) {
    const lapTime = crossingTime - player.startZeit;

    if (player.akRunde > 0) {  // Nur zählen, wenns 'ne ganze Runde war und nicht nur der erste Teil bis zur Linie
      player.lastZeit = lapTime;

      if (lapTime < player.bestZeit || player.bestZeit === 0) {
        player.bestZeit = lapTime;
        player.bestGhost = [...player.currentGhost];
        saveBestGhost(player.bestZeit, player.bestGhost, map);
      }
    }
    player.currentGhost = [];
    player.startZeit = crossingTime;
    player.akRunde = player.akRunde + 1;
  }

  // Nächsten Checkpoint aktivieren
  player.akCheckpoint =
    (player.akCheckpoint + 1) % map.checkpoints.length;
}

export function needsResetting(car, map) {
  const tx = Math.floor(car.position.x / map.metersPerPixel);
  const ty = Math.floor(car.position.y / map.metersPerPixel);

  // Außerhalb Map
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) {
    return true;
  }

  const idx = map.materialIndex[ty * map.width + tx];
  const tile = map.tiles[idx] ?? map.tiles[0];

  return tile.solide === 3;
}

function getResetTarget(player, map) {
  if (player.akRunde === 0) {
    const s = map.startPositionSP;
    return {
      x: s.x,
      y: s.y,
      angle: s.angle
    };
  }

  let prevCheckpoint = player.akCheckpoint-1;
  if (prevCheckpoint == -1) {
    prevCheckpoint = map.checkpoints.length;
  }
  const cp = map.checkpoints[prevCheckpoint];

  // Mittelpunkt des Checkpoints
  const x = (cp.x1 + cp.x2) / 2;
  const y = (cp.y1 + cp.y2) / 2;

  // Blickrichtung entlang der Checkpoint-Linie
  const dx = cp.x2 - cp.x1;
  const dy = cp.y2 - cp.y1;
  const angle = Math.atan2(dy, dx) + Math.PI/2;

  return { x, y, angle };
}


export function startReset(player, map, now) {
  const car = player.car;
  const target = getResetTarget(player, map);

  player.status = "resetting";

  player.reset.startTime = now;
  player.reset.from.x = car.position.x;
  player.reset.from.y = car.position.y;
  player.reset.to.x = target.x;
  player.reset.to.y = target.y;

  player.reset.fromAngle = car.winkel;
  player.reset.toAngle = target.angle;

  // Physik stoppen
  car.geschwindigkeit = 0;
  car.upm = 0;
}

export function updateReset(player, now) {
  const r = player.reset;
  const car = player.car;

  const t = (now - r.startTime) / r.duration;

  if (t >= 1) {
    // Reset fertig
    car.position.x = r.to.x;
    car.position.y = r.to.y;
    car.winkel = r.toAngle;

    car.bewegungswinkel = car.winkel;

    player.status = "driving";
    return;
  }

  // Smoothstep statt linear (fühlt sich viel besser an)
  const s = t * t * (3 - 2 * t);

  car.position.x = r.from.x + (r.to.x - r.from.x) * s;
  car.position.y = r.from.y + (r.to.y - r.from.y) * s;

  car.winkel = lerpAngle(r.fromAngle, r.toAngle, s);
}

function lerpAngle(a, b, t) {
  let diff = b - a;

  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff >  Math.PI) diff -= Math.PI * 2;

  return a + diff * t;
}
