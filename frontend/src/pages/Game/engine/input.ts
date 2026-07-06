import { GAME_BLOCK_TYPES, type GameBlockType } from "@familyspeak/shared";

/**
 * État d'entrée unifié : rempli soit par les contrôles clavier/souris desktop, soit par les
 * contrôles tactiles mobiles (joystick + glisser-regarder + boutons), lu chaque frame par la
 * boucle de rendu sans se soucier de la source. `breakRequested`/`placeRequested` sont à
 * consommer (remettre à false) une fois lus, façon "edge-triggered".
 */
export interface GameInputState {
  moveForward: number;
  moveRight: number;
  yaw: number;
  pitch: number;
  jumpPressed: boolean;
  breakRequested: boolean;
  placeRequested: boolean;
  homeRequested: boolean;
  selectedBlockType: GameBlockType;
}

export function createInputState(): GameInputState {
  return {
    moveForward: 0,
    moveRight: 0,
    yaw: 0,
    pitch: 0,
    jumpPressed: false,
    breakRequested: false,
    placeRequested: false,
    homeRequested: false,
    selectedBlockType: GAME_BLOCK_TYPES[0],
  };
}

const DIGIT_KEY_CODES = [
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
];

const MAX_PITCH = Math.PI / 2 - 0.01;
const MOUSE_SENSITIVITY = 0.0025;

export function attachDesktopControls(canvas: HTMLCanvasElement, state: GameInputState) {
  const heldKeys = new Set<string>();
  let pointerLocked = false;

  function onKeyDown(event: KeyboardEvent) {
    heldKeys.add(event.code);
    if (event.code === "Space") event.preventDefault();
    if (event.code === "KeyH") state.homeRequested = true;
    const digitIndex = DIGIT_KEY_CODES.indexOf(event.code);
    if (digitIndex !== -1 && digitIndex < GAME_BLOCK_TYPES.length) {
      state.selectedBlockType = GAME_BLOCK_TYPES[digitIndex]!;
    }
  }
  function onKeyUp(event: KeyboardEvent) {
    heldKeys.delete(event.code);
  }
  function onClick() {
    canvas.requestPointerLock();
  }
  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
  }
  function onMouseMove(event: MouseEvent) {
    if (!pointerLocked) return;
    state.yaw -= event.movementX * MOUSE_SENSITIVITY;
    state.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch - event.movementY * MOUSE_SENSITIVITY));
  }
  function onMouseDown(event: MouseEvent) {
    if (!pointerLocked) return;
    if (event.button === 0) state.breakRequested = true;
    if (event.button === 2) state.placeRequested = true;
  }
  function onContextMenu(event: Event) {
    event.preventDefault();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("click", onClick);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  window.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("contextmenu", onContextMenu);

  // Ne pilote moveForward/moveRight/jumpPressed que si le clavier a un rôle à jouer ce
  // frame-ci (touche tenue, ou relâchée à l'instant) : sur un appareil tactile, le clavier
  // ne touche jamais à ces champs, ce qui laisse les contrôles tactiles (TouchControls) les
  // piloter sans que ce polling ne les écrase à chaque frame.
  let keyboardWasActive = false;
  function update() {
    let forward = 0;
    let right = 0;
    if (heldKeys.has("KeyW")) forward += 1;
    if (heldKeys.has("KeyS")) forward -= 1;
    if (heldKeys.has("KeyD")) right += 1;
    if (heldKeys.has("KeyA")) right -= 1;
    const keyboardActive = heldKeys.size > 0;
    if (keyboardActive || keyboardWasActive) {
      const length = Math.hypot(forward, right);
      state.moveForward = length > 0 ? forward / length : 0;
      state.moveRight = length > 0 ? right / length : 0;
      state.jumpPressed = heldKeys.has("Space");
    }
    keyboardWasActive = keyboardActive;
  }

  function dispose() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("click", onClick);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    window.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("contextmenu", onContextMenu);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  return { update, dispose };
}

/** Transforme l'intention de déplacement locale (avant/droite) en vecteur monde selon le yaw caméra. */
export function inputToWorldMove(state: GameInputState): { moveX: number; moveZ: number } {
  const sinYaw = Math.sin(state.yaw);
  const cosYaw = Math.cos(state.yaw);
  return {
    moveX: -sinYaw * state.moveForward + cosYaw * state.moveRight,
    moveZ: -cosYaw * state.moveForward - sinYaw * state.moveRight,
  };
}
