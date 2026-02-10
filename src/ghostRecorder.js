export function recordGhostFrame(player, now) {
  //if (player.status !== "driving") return;

  const t = now - player.startZeit;

  // save every 200 ms -> enough when shown with interpolation
  if (player.currentGhost.length == 0 || (t - player.currentGhost[player.currentGhost.length - 1].t > 200)) {
    player.currentGhost.push({
        t,
        x: player.car.position.x,
        y: player.car.position.y,
        w: player.car.winkel
    });
  }
}

export function saveBestGhost(bestZeit, ghost, map, carName) {
  const KEY = map.name + "_bestghost_v1";
  localStorage.setItem(KEY, JSON.stringify({
    bestZeit,
    ghost,
    carName
  }));
}

export function loadBestGhost(map) {
  const KEY = map.name + "_bestghost_v1";
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}
