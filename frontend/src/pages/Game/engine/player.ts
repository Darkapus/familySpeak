export const PLAYER_HALF_WIDTH = 0.3;
export const PLAYER_HALF_DEPTH = 0.3;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;

const GRAVITY = 20;
const JUMP_SPEED = 8;
const MOVE_SPEED = 4.5;
/** Hauteur de marche franchissable automatiquement sans sauter (comme dans Minecraft), pour ne
 * pas rester bloqué contre chaque terrasse d'un bloc du terrain généré. */
const STEP_HEIGHT = 1.05;

export interface PlayerPhysicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
}

export function createPlayerPhysicsState(x: number, y: number, z: number): PlayerPhysicsState {
  return { x, y, z, vx: 0, vy: 0, vz: 0, grounded: false };
}

type IsSolidFn = (x: number, y: number, z: number) => boolean;

function collidesAt(x: number, y: number, z: number, isSolid: IsSolidFn): boolean {
  const minX = Math.floor(x - PLAYER_HALF_WIDTH);
  const maxX = Math.floor(x + PLAYER_HALF_WIDTH);
  const minY = Math.floor(y);
  const maxY = Math.floor(y + PLAYER_HEIGHT);
  const minZ = Math.floor(z - PLAYER_HALF_DEPTH);
  const maxZ = Math.floor(z + PLAYER_HALF_DEPTH);
  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (isSolid(bx, by, bz)) return true;
      }
    }
  }
  return false;
}

/**
 * Avance la physique du joueur d'un pas dt (secondes). Résolution de collision naïve par axe
 * (AABB vs grille) : en cas de collision sur un axe, on annule le mouvement sur cet axe plutôt
 * que de calculer un point de contact exact — accepté comme simplification pour ce mode de jeu.
 * Un franchissement de marche automatique (STEP_HEIGHT) évite de rester bloqué contre les
 * terrasses d'un bloc générées par le terrain.
 */
export function stepPlayer(
  state: PlayerPhysicsState,
  input: { moveX: number; moveZ: number; jump: boolean },
  dt: number,
  isSolid: IsSolidFn,
): PlayerPhysicsState {
  let vx = input.moveX * MOVE_SPEED;
  let vz = input.moveZ * MOVE_SPEED;
  let vy = state.vy - GRAVITY * dt;
  if (input.jump && state.grounded) {
    vy = JUMP_SPEED;
  }

  let { x, y, z } = state;
  let grounded = false;

  const targetX = x + vx * dt;
  if (!collidesAt(targetX, y, z, isSolid)) {
    x = targetX;
  } else if (!collidesAt(targetX, y + STEP_HEIGHT, z, isSolid)) {
    x = targetX;
    y += STEP_HEIGHT;
  } else {
    vx = 0;
  }

  const targetZ = z + vz * dt;
  if (!collidesAt(x, y, targetZ, isSolid)) {
    z = targetZ;
  } else if (!collidesAt(x, y + STEP_HEIGHT, targetZ, isSolid)) {
    z = targetZ;
    y += STEP_HEIGHT;
  } else {
    vz = 0;
  }

  const targetY = y + vy * dt;
  if (collidesAt(x, targetY, z, isSolid)) {
    if (vy < 0) grounded = true;
    vy = 0;
  } else {
    y = targetY;
  }

  return { x, y, z, vx, vy, vz, grounded };
}
