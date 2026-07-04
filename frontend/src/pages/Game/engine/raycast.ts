export interface VoxelRaycastHit {
  /** Case solide touchée. */
  x: number;
  y: number;
  z: number;
  /** Case vide juste avant l'impact (celle où poser un nouveau bloc). */
  px: number;
  py: number;
  pz: number;
}

/**
 * Parcours de grille voxel façon DDA (Amanatides & Woo) : avance case par case le long du rayon
 * plutôt que de raycaster contre le mesh fusionné (qui n'a pas de correspondance 1:1 avec les
 * cases logiques une fois les faces cachées supprimées par le culling).
 */
export function raycastVoxels(
  origin: readonly [number, number, number],
  direction: readonly [number, number, number],
  maxDistance: number,
  isSolid: (x: number, y: number, z: number) => boolean,
): VoxelRaycastHit | null {
  let x = Math.floor(origin[0]);
  let y = Math.floor(origin[1]);
  let z = Math.floor(origin[2]);
  const [dx, dy, dz] = direction;

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  function nextBoundaryT(o: number, d: number, step: number, cell: number): number {
    if (d === 0) return Infinity;
    const boundary = step > 0 ? cell + 1 : cell;
    return (boundary - o) / d;
  }
  function deltaT(d: number): number {
    return d === 0 ? Infinity : Math.abs(1 / d);
  }

  let tMaxX = nextBoundaryT(origin[0], dx, stepX, x);
  let tMaxY = nextBoundaryT(origin[1], dy, stepY, y);
  let tMaxZ = nextBoundaryT(origin[2], dz, stepZ, z);
  const tDeltaX = deltaT(dx);
  const tDeltaY = deltaT(dy);
  const tDeltaZ = deltaT(dz);

  let prevX = x;
  let prevY = y;
  let prevZ = z;
  let traveled = 0;

  while (traveled <= maxDistance) {
    if (isSolid(x, y, z)) {
      return { x, y, z, px: prevX, py: prevY, pz: prevZ };
    }
    prevX = x;
    prevY = y;
    prevZ = z;
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      traveled = tMaxX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      traveled = tMaxY;
      tMaxY += tDeltaY;
    } else {
      z += stepZ;
      traveled = tMaxZ;
      tMaxZ += tDeltaZ;
    }
  }
  return null;
}
