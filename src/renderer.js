// renderer.js

let pixelPerfect = true; // kann später für Optionen genutzt werden

export function draw(ctx, canvas, player, map, now, options = {}) {
  prepareContext(ctx);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Zoom abhängig von Geschwindigkeit
  const minZoom = 4;
  const maxZoom = 8;
  let zoom = Math.max(minZoom, maxZoom - Math.abs(player.car.geschwindigkeit) / 15);

  // Zoom abhängig von Bildschirmgröße
  const zoomFactor = typeof options.zoomFactor === "number" ? options.zoomFactor : 1;
  zoom *= (canvas.width / 1000) * zoomFactor;
  
  applyCamera(ctx, canvas, player.car, zoom);

  drawMap(ctx, map);
   
  drawStartPositions(ctx, map);

  drawCheckpointsBottom(ctx, map.checkpoints);
  
  const showGhost = options.showGhost !== false;
  if (showGhost) {
    drawGhost(ctx, player, now);
  }
  drawCar(ctx, canvas, player.car, map, zoom);

  drawCheckpoints(ctx, map.checkpoints, player.car);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  
  drawHUD(ctx, canvas, player, map, now, options);
}


function prepareContext(ctx) {
  if (pixelPerfect) {
    ctx.imageSmoothingEnabled = false;
  }
}


function applyCamera(ctx, canvas, car, zoom) {
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-car.position.x, -car.position.y);
}


export function applyCameraLookAhead(ctx, canvas, car, zoom) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const speed = Math.abs(car.geschwindigkeit);
  const lookAhead = Math.min(30, speed * 0.5);

  const dirX = Math.cos(car.bewegungswinkel);
  const dirY = Math.sin(car.bewegungswinkel);

  const camX = car.position.x + dirX * lookAhead;
  const camY = car.position.y + dirY * lookAhead;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);

  ctx.translate(-camX, -camY);
}




function drawMap(ctx, map) {
  if (!map || !map.image) return;

  ctx.save();

  // Map-Pixel → Meter
  ctx.scale(map.metersPerPixel, map.metersPerPixel);
  ctx.drawImage(map.image, 0, 0);

  ctx.restore();
}



export function drawStartPositions(ctx, map) {
  ctx.save();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 0.3;

  const lineLength = 4;
  const wing = 4;
  map.startPositions.forEach(sp => {

    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(sp.angle);

    // Start Box
    ctx.beginPath();
    ctx.moveTo(lineLength*3/4 - wing, -lineLength/2);
    ctx.lineTo(lineLength*3/4, -lineLength/2);
    ctx.lineTo(lineLength*3/4, lineLength/2);
    ctx.lineTo(lineLength*3/4 - wing, lineLength/2);
    ctx.stroke();

    ctx.restore();
  });

  ctx.restore();
}



export function drawCheckpoints(ctx, checkpoints, car) {
  checkpoints.forEach(cp => {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 0.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cp.x1, cp.y1);
    ctx.lineTo(cp.x1 - (car.position.x - cp.x1) * 0.1, cp.y1 - (car.position.y - cp.y1) * 0.1);
    ctx.stroke();

    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(cp.x1 - (car.position.x - cp.x1) * 0.1, cp.y1 - (car.position.y - cp.y1) * 0.1);
    ctx.lineTo(cp.x2 - (car.position.x - cp.x2) * 0.1, cp.y2 - (car.position.y - cp.y2) * 0.1);
    ctx.stroke();

    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cp.x2 - (car.position.x - cp.x2) * 0.1, cp.y2 - (car.position.y - cp.y2) * 0.1);
    ctx.lineTo(cp.x2, cp.y2);
    ctx.stroke();
    ctx.lineCap = "butt";
  })
}

export function drawCheckpointsBottom(ctx, checkpoints) {
  drawCheckeredLine(ctx, checkpoints[0])
  checkpoints.forEach(cp => {
    // ctx.strokeStyle = "black";
    // ctx.lineWidth = 0.1;
    // ctx.setLineDash([0.5, 1]);
    // ctx.beginPath();
    // ctx.moveTo(cp.x1, cp.y1);
    // ctx.lineTo(cp.x2, cp.y2);
    // ctx.stroke();
    // ctx.setLineDash([]);
  })
}


function drawCheckeredLine(ctx, cp) {
  const dx = cp.x2 - cp.x1;
  const dy = cp.y2 - cp.y1;
  const length = Math.hypot(dx, dy);

  const dirX = dx / length;
  const dirY = dy / length;

  const normalX = -dirY;
  const normalY = dirX;

  const tile = 1.0;      // 1m Karogröße
  const width = 3.0;     // 3m Linienbreite (ergibt 3 Reihen)

  const halfW = width / 2;

  const uCount = Math.floor(length / tile);
  const vCount = Math.floor(width / tile);

  for (let u = 0; u < uCount; u++) {
    for (let v = 0; v < vCount; v++) {

      // Schachbrett-Muster
      const isWhite = (u + v) % 2 === 0;
      ctx.fillStyle = isWhite ? "white" : "black";

      // Startpunkt dieses Tiles
      const baseX =
        cp.x1 +
        dirX * u * tile +
        normalX * (v * tile - halfW);

      const baseY =
        cp.y1 +
        dirY * u * tile +
        normalY * (v * tile - halfW);

      // Vier Ecken des Karos
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + dirX * tile, baseY + dirY * tile);
      ctx.lineTo(
        baseX + dirX * tile + normalX * tile,
        baseY + dirY * tile + normalY * tile
      );
      ctx.lineTo(baseX + normalX * tile, baseY + normalY * tile);
      ctx.closePath();
      ctx.fill();
    }
  }
}




export function drawCheckpoint(ctx, cp, car) {
  ctx.strokeStyle = "black";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cp.x1, cp.y1);
  ctx.lineTo(cp.x1 - (car.position.x - cp.x1) * 0.1, cp.y1 - (car.position.y - cp.y1) * 0.1);
  ctx.stroke();

  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(cp.x1 - (car.position.x - cp.x1) * 0.1, cp.y1 - (car.position.y - cp.y1) * 0.1);
  ctx.lineTo(cp.x2 - (car.position.x - cp.x2) * 0.1, cp.y2 - (car.position.y - cp.y2) * 0.1);
  ctx.stroke();

  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cp.x2 - (car.position.x - cp.x2) * 0.1, cp.y2 - (car.position.y - cp.y2) * 0.1);
  ctx.lineTo(cp.x2, cp.y2);
  ctx.stroke();
}


// HUD

function drawHUD(ctx, canvas, player, map, now, options = {}) {
  ctx.save();
  ctx.resetTransform(); // Um in Bildschirmkoordinaten zu zeichnen

  drawCheckpointArrow(ctx, canvas, player.car, map.checkpoints[player.akCheckpoint]);
  if (options.hudShowRpm !== false) {
    drawRpmGauge(ctx, canvas, player.car);
  }
  if (options.hudShowSpeed !== false) {
    drawSpeedGear(ctx, canvas, player.car);
  }
  drawTimes(ctx, canvas, player, now);
  if (options.hudShowMinimap !== false) {
    drawMinimap(ctx, canvas, map, player.car);
  }

  ctx.restore();
}


function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const msr = Math.floor((ms % 1000) / 10);
  return `${m.toString().padStart(2, "0")}:${r
    .toString()
    .padStart(2, "0")}.${msr.toString().padStart(3, "0")}`;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}


function drawCheckpointArrow(ctx, canvas, car, checkpoint) {
  const cx = (checkpoint.x1 + checkpoint.x2) / 2;
  const cy = (checkpoint.y1 + checkpoint.y2) / 2;

  let dx = car.position.x - cx;
  let dy = car.position.y - cy;

  const distance = Math.hypot(dx, dy);
  dx /= distance;
  dy /= distance;

  const centerX = canvas.width / 2 - dx * Math.min(250, Math.max(distance*5, 50));
  const centerY = canvas.height / 2 - dy * Math.min(250, Math.max(distance*5, 50));

  const p1 = { x: centerX - dx * 20, y: centerY - dy * 20 };
  const p2 = {
    x: centerX + dx * 20 + dy * 10,
    y: centerY + dy * 20 - dx * 10,
  };
  const p3 = {
    x: centerX + dx * 20 - dy * 10,
    y: centerY + dy * 20 + dx * 10,
  };

  ctx.fillStyle = "rgb(230,10,10)";
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.fill();
}


export function drawRpmGauge(ctx, canvas, car) {
  // const cx = canvas.width - 160;
  // const cy = 140;
  // const radius = 100;
  const scaleFactor = 13 + Math.min(Math.max(canvas.width/50, 5), 15);
  const cx = canvas.width-scaleFactor*3.3;
  const cy = canvas.height-scaleFactor*3.8;
  const radius = scaleFactor*2.7;

  const minRpm = 1000;
  const maxRpm = 6000;

  // Hintergrund
  ctx.save();
  ctx.translate(cx, cy);

  ctx.lineWidth = scaleFactor/6;

  // Skala
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const angle = Math.PI + Math.PI * (1 - t);

    const x1 = Math.cos(angle) * (radius - 10);
    const y1 = Math.sin(angle) * (radius - 10);
    const x2 = Math.cos(angle) * radius;
    const y2 = Math.sin(angle) * radius;

    const r = Math.floor(255 * t);
    const g = Math.floor(255 * (1 - t));
    ctx.strokeStyle = `rgb(${r},${g},50)`;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Nadel
  let rpm = Math.max(minRpm, Math.min(maxRpm, car.upm));
  const norm = (rpm - minRpm) / (maxRpm - minRpm);
  const angle = -Math.PI * (1 - norm);

  ctx.strokeStyle = "red";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(angle) * (radius - 20),
             Math.sin(angle) * (radius - 20));
  ctx.stroke();

  // Zentrum
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}



function drawRpmGauge2(ctx, canvas, car) {
  let upm = car.upm;
  const scaleFactor = 13 + Math.min(Math.max(canvas.width/50, 5), 15);
  const gaugeLength = scaleFactor*5;
  //const cx = canvas.width - 60;
  const cx = canvas.width-scaleFactor*2;
  const cy = canvas.height-scaleFactor*4;
  const r1 = gaugeLength - 10;
  const r2 = gaugeLength + 10;

  // Skala
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + Math.PI * 0.028 * i;

    const x1 = cx + Math.cos(a) * r1;
    const y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2;
    const y2 = cy + Math.sin(a) * r2;

    const red = (i / 20) * 255;
    const green = 255 - (i * i) / 400 * 255;

    ctx.strokeStyle = `rgb(${red|0},${green|0},30)`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Zeiger
  upm = clamp(upm, 1000, 6000);
  const a = (upm - 1000) * -0.0003;

  const dx = Math.cos(a);
  const dy = -Math.sin(a);

  ctx.fillStyle = "rgb(230,10,10)";
  ctx.beginPath();
  ctx.moveTo(cx - dx * gaugeLength, cy - dy * gaugeLength);
  ctx.lineTo(cx + dy * gaugeLength/14, cy - dx * gaugeLength/14);
  ctx.lineTo(cx - dy * gaugeLength/14, cy + dx * gaugeLength/14);
  ctx.closePath();
  ctx.fill();
}


function drawSpeedGear(ctx, canvas, car) {
  const scaleFactor = 13 + Math.min(Math.max(canvas.width/50, 5), 15);
  ctx.fillStyle = "black";
  ctx.fillRect(canvas.width-scaleFactor*6, canvas.height-scaleFactor*3.2, scaleFactor*6-15, scaleFactor*3.2-15);

  ctx.fillStyle = "white";
  ctx.font = Math.floor(scaleFactor).toString() + "px monospace";

  const kmh = Math.floor(car.geschwindigkeit * 3.6);
  ctx.fillText(`${kmh.toString().padStart(3, " ")} km/h`, canvas.width-scaleFactor*5.7, canvas.height-5-scaleFactor);

  ctx.fillStyle = "rgb(230,10,10)";
  ctx.font = Math.floor(scaleFactor*2/3).toString() + "px monospace";
  ctx.fillText(car.gang > 0 ? "Gear: " + car.gang : "Gear: R", canvas.width-scaleFactor*6+20, canvas.height-18-scaleFactor*1.5);
}


function drawTimes(ctx, canvas, player, now) {
  const scaleFactor = 13 + Math.min(Math.max(canvas.width/50, 5), 15);
  ctx.fillStyle = "black";
  ctx.fillRect(20, 20, scaleFactor*6, scaleFactor*3.3);

  ctx.fillStyle = "white";
  ctx.font = Math.floor(scaleFactor*2/3).toString() + "px monospace";

  if (player.akRunde == 0) ctx.fillText("Time: --:--:---", 30, scaleFactor+18);
  else ctx.fillText("Time: " + formatTime(now - player.startZeit), 30, scaleFactor+18);
  ctx.fillText("Last: " + formatTime(player.lastZeit), 30, 2*scaleFactor+18);

  ctx.fillStyle = "rgb(0,200,0)";
  ctx.fillText("Best: " + formatTime(player.bestZeit), 30, 3*scaleFactor+18);
}


function drawMinimap(ctx, canvas, map, car) {
  const size = Math.max(Math.min(250, canvas.width/5), 80);
  const startX = 40;
  const startY = canvas.height-20-size;

  const scale =
    size /
    Math.max(map.width * map.metersPerPixel, map.height * map.metersPerPixel);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;

  for (let i = 0; i < map.checkpoints.length; i++) {
    const a = map.checkpoints[i];
    const b = map.checkpoints[(i + 1) % map.checkpoints.length];

    const ax = startX + (a.x1 + a.x2) * 0.5 * scale;
    const ay = startY + (a.y1 + a.y2) * 0.5 * scale;
    const bx = startX + (b.x1 + b.x2) * 0.5 * scale;
    const by = startY + (b.y1 + b.y2) * 0.5 * scale;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  // Auto
  const cx = startX + car.position.x * scale;
  const cy = startY + car.position.y * scale;

  ctx.fillStyle = car.color;
  ctx.fillRect(cx - 4, cy - 4, 8, 8);

  ctx.fillStyle = car.roofColor;
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
}


export function drawCarComplicated(ctx, canvas, car, map, zoom) {
  const pxPerMeter = 10*zoom / map.metersPerPixel;

  const X = canvas.width / 2;
  const Y = canvas.height / 2;

  const sin = Math.sin(car.winkel);
  const cos = Math.cos(car.winkel);

  const halfLength = (car.autotyp.length / 2) * pxPerMeter;
  const halfWidth  = (car.autotyp.width / 2) * pxPerMeter;

  // --- Eckpunkte Auto ---
  const V1 = {
    x: X - halfWidth * sin + halfLength * cos,
    y: Y + halfWidth * cos + halfLength * sin,
  };
  const V2 = {
    x: X - halfWidth * sin - halfLength * cos,
    y: Y + halfWidth * cos - halfLength * sin,
  };
  const V3 = {
    x: X - halfLength * cos + halfWidth * sin,
    y: Y - halfLength * sin - halfWidth * cos,
  };
  const V4 = {
    x: X + halfLength * cos + halfWidth * sin,
    y: Y + halfLength * sin - halfWidth * cos,
  };
  
  // --- Karosserie ---
  ctx.fillStyle = car.color;
  drawQuad(ctx, V1, V2, V3, V4);

  // --- Frontscheinwerfer ---
  ctx.strokeStyle = "yellow";
  ctx.beginPath();
  ctx.moveTo(V1.x, V1.y);
  ctx.lineTo(
    X - halfWidth * 0.6 * sin + halfLength * cos,
    Y + halfWidth * 0.6 * cos + halfLength * sin
  );
  ctx.moveTo(V4.x, V4.y);
  ctx.lineTo(
    X + halfLength * cos + halfWidth * sin * 0.6,
    Y + halfLength * sin - halfWidth * cos * 0.6
  );
  ctx.stroke();

  // --- Brems-/Rücklicht ---
  if (car.brems && car.geschwindigkeit > 0) ctx.strokeStyle = "rgb(250,100,100)";
  else if (car.geschwindigkeit < 0) ctx.strokeStyle = "white";
  else ctx.strokeStyle = "rgb(150,0,0)";

  ctx.beginPath();
  ctx.moveTo(V2.x, V2.y);
  ctx.lineTo(
    X - halfWidth * 0.6 * sin - halfLength * cos,
    Y + halfWidth * 0.6 * cos - halfLength * sin
  );
  ctx.moveTo(V3.x, V3.y);
  ctx.lineTo(
    X - halfLength * cos + halfWidth * sin * 0.6,
    Y - halfLength * sin - halfWidth * cos * 0.6
  );
  ctx.stroke();

  // --- Dach ---
  const roofHalfLength = (car.autotyp.length / 4) * pxPerMeter;
  const roofHalfWidth  = (car.autotyp.width / 3) * pxPerMeter;

  const R1 = {
    x: X - roofHalfWidth * sin + roofHalfLength * cos,
    y: Y + roofHalfWidth * cos + roofHalfLength * sin,
  };
  const R2 = {
    x: X - roofHalfWidth * sin - roofHalfLength * cos,
    y: Y + roofHalfWidth * cos - roofHalfLength * sin,
  };
  const R3 = {
    x: X - roofHalfLength * cos + roofHalfWidth * sin,
    y: Y - roofHalfLength * sin - roofHalfWidth * cos,
  };
  const R4 = {
    x: X + roofHalfLength * cos + roofHalfWidth * sin,
    y: Y + roofHalfLength * sin - roofHalfWidth * cos,
  };

  ctx.fillStyle = car.roofColor;
  drawQuad(ctx, R1, R2, R3, R4);
}

function drawQuad(ctx, a, b, c, d) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}


export function drawCar(ctx, canvas, car, map, zoom) {
  const length = car.autotyp.length;
  const width  = car.autotyp.width;

  const roofLength = length / 2;
  const roofWidth  = width / 1.5;

  ctx.save();

  // Weltposition!
  ctx.translate(car.position.x, car.position.y);
  ctx.rotate(car.winkel);

  // Karosserie
  ctx.fillStyle = car.color;
  ctx.fillRect(-length/2, -width/2, length, width);

  // Dach
  ctx.fillStyle = car.roofColor;
  ctx.fillRect(-roofLength/2, -roofWidth/2, roofLength, roofWidth);

  // Frontlichter
  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(length / 2, -width * 0.4);
  ctx.lineTo(length / 2, -width * 0.1);
  ctx.moveTo(length / 2, width * 0.4);
  ctx.lineTo(length / 2, width * 0.1);
  ctx.stroke();

  // Rücklichter / Bremslicht
  if (car.bremsstatus > 0 && car.geschwindigkeit > 0) {
    ctx.strokeStyle = "#ff6464";
  } else if (car.geschwindigkeit < 0) {
    ctx.strokeStyle = "#ffffff";
  } else {
    ctx.strokeStyle = "#990000";
  }

  ctx.beginPath();
  ctx.moveTo(-length / 2, -width * 0.4);
  ctx.lineTo(-length / 2, -width * 0.2);
  ctx.moveTo(-length / 2, width * 0.4);
  ctx.lineTo(-length / 2, width * 0.2);
  ctx.stroke();

  ctx.restore();
}

export function drawGhost(ctx, player, now) {
  if (!player.bestGhost) return;

  const t = now - player.startZeit;
  const g = player.bestGhost;

  // passenden Frameslot finden
  let i = 0;
  while (i < g.length - 1 && g[i + 1].t < t) i++;

  const a = g[i];
  const b = g[i + 1] || a;

  const f = (t - a.t) / (b.t - a.t || 1);

  const x = a.x + (b.x - a.x) * f;
  const y = a.y + (b.y - a.y) * f;
  const w = a.w + (b.w - a.w) * f;

  ctx.save();
  ctx.globalAlpha = 0.35;

  ctx.translate(x, y);
  ctx.rotate(w);

  ctx.fillStyle = "black";
  const length = player.car.autotyp.length;
  const width  = player.car.autotyp.width;
  ctx.fillRect(-length/2, -width/2, length, width);

  ctx.restore();
}




export function drawDebugHUD(ctx, canvas, car, map) {
  ctx.save();

  ctx.setTransform(1, 0, 0, 1, 0, 0); // unabhängig von Kamera

  ctx.font = "16px monospace";
  ctx.fillStyle = "white";
  ctx.textAlign = "left";

  const speed = car.geschwindigkeit.toFixed(2);
  const upm = car.upm;
  const gear = car.gang;

  const lines = [
    `Speed: ${speed} m/s`,
    `UPM:   ${upm}`,
    `Gear:  ${gear}`,
    `Angle: ${car.winkel.toFixed(2)}`,
    `MoveAn:${car.bewegungswinkel.toFixed(2)}`,
    `Rutsch:${car.rutschigkeit.toFixed(2)}`
  ];

  lines.forEach((l, i) => {
    ctx.fillText(l, 20, 30 + i * 20);
  });

  ctx.restore();

}
