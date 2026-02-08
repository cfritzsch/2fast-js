export function setupKeyboardInput(player) {
  let keyboardSteer = 0;
  window.addEventListener("keydown", e => {
    if (e.key === "ArrowUp" && player.car.geschwindigkeit >= 0) player.car.gasstatus = 1;
    if (e.key === "ArrowUp" && player.car.geschwindigkeit <  0) player.car.bremsstatus = 1;
    if (e.key === "ArrowUp") player.car.arrowUpKeyPressed = 1;
    if (e.key === "w" && player.car.geschwindigkeit >= 0) player.car.gasstatus = 1;
    if (e.key === "w" && player.car.geschwindigkeit <  0) player.car.bremsstatus = 1;
    if (e.key === "w") player.car.arrowUpKeyPressed = 1;
    if (e.key === "ArrowDown" && player.car.geschwindigkeit > 0) player.car.bremsstatus = 1;
    if (e.key === "ArrowDown" && player.car.geschwindigkeit <= 0) player.car.gasstatus = 1;
    if (e.key === "ArrowDown") player.car.arrowDownKeyPressed = 1;
    if (e.key === "s" && player.car.geschwindigkeit > 0) player.car.bremsstatus = 1;
    if (e.key === "s" && player.car.geschwindigkeit <= 0) player.car.gasstatus = 1;
    if (e.key === "s") player.car.arrowDownKeyPressed = 1;
    if (e.key === "ArrowLeft") player.input.keyboard.steer = -1; //player.car.lenkeinschlag = -0.6;
    if (e.key === "a") player.input.keyboard.steer = -1; //player.car.lenkeinschlag = -0.6;
    if (e.key === "ArrowRight") player.input.keyboard.steer = 1; //player.car.lenkeinschlag = 0.6;
    if (e.key === "d") player.input.keyboard.steer = 1; //player.car.lenkeinschlag = 0.6;
    player.input.keyboard.active = true;  // Use keyboard input from here onwards
    player.input.mobile.active = false;
  });

  window.addEventListener("keyup", e => {
    if (e.key === "ArrowUp" && player.car.geschwindigkeit >= 0) player.car.gasstatus = 0;
    if (e.key === "ArrowUp" && player.car.geschwindigkeit <  0) player.car.bremsstatus = 0;
    if (e.key === "ArrowUp") player.car.arrowUpKeyPressed = 0;
    if (e.key === "w" && player.car.geschwindigkeit >= 0) player.car.gasstatus = 0;
    if (e.key === "w" && player.car.geschwindigkeit <  0) player.car.bremsstatus = 0;
    if (e.key === "w") player.car.arrowUpKeyPressed = 0;
    if (e.key === "ArrowDown" && player.car.geschwindigkeit >= 0) player.car.bremsstatus = 0;
    if (e.key === "ArrowDown" && player.car.geschwindigkeit <  0) player.car.gasstatus = 0;
    if (e.key === "ArrowDown") player.car.arrowDownKeyPressed = 0;
    if (e.key === "s" && player.car.geschwindigkeit >= 0) player.car.bremsstatus = 0;
    if (e.key === "s" && player.car.geschwindigkeit <  0) player.car.gasstatus = 0;
    if (e.key === "s") player.car.arrowDownKeyPressed = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") player.input.keyboard.steer = 0; //player.car.lenkeinschlag = 0;
    if (e.key === "a" || e.key === "d") player.input.keyboard.steer = 0; //player.car.lenkeinschlag = 0;
  });
}


export function setupTouchInput(player) {
  window.addEventListener("touchstart", e => {
    player.car.gasstatus = 1;  // Auto-gas
    player.car.arrowUpKeyPressed = 1;
    player.car.bremsstatus = 0;
    player.input.keyboard.active = false;
    player.input.mobile.touchActive = true;  // Use mobile input from here onwards
    updateTouchSteer(e);
  });

  window.addEventListener("touchmove", e => {
    updateTouchSteer(e);
  });

  window.addEventListener("touchend", () => {
    player.input.mobile.touchActive = false;
    player.input.mobile.touchSteer = 0;
  });

  function updateTouchSteer(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const half = window.innerWidth / 2;

    player.input.mobile.touchSteer = x < half ? -1 : 1;
  }
}


export function setupGyroInput(player) {
  if (DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission();  // iOS needs to request permissions
  }
  window.addEventListener("deviceorientation", e => {
    if (e.gamma == null) return;

    // gamma: -90 .. +90 (links/rechts neigen)
    const deadZone = 3;

    let steer = 0;
    if (Math.abs(e.gamma) > deadZone) {
      steer = e.gamma / 30;      // Empfindlichkeit
      steer = Math.max(-1, Math.min(1, steer));
    }

    player.input.mobile.gyroSteer = steer;
    player.input.mobile.gyroActive = Math.abs(steer) > 0.02;

    if (player.input.mobile.gyroActive) {
      player.input.keyboard.active = false;
    }
  });
}


export function getSteerInput(player) {
  if (player.input.keyboard.active) return player.input.keyboard.steer;
  
  if (player.input.mobile.touchActive) {
    return player.input.mobile.touchSteer;      // Touch hat Vorrang
  } else if (player.input.mobile.gyroActive) {
    return player.input.mobile.gyroSteer;       // sonst Gyro
  }
  return 0;
}


export function applySteering(car, input, dt) {
  // input = -1, 0, 1

  const maxLenk = 0.6; // rad
  const target = input * maxLenk;

  // smooth approach (Arcade Feeling)
  car.lenkeinschlag += (target - car.lenkeinschlag) * (dt * 8);
}
