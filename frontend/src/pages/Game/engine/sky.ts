import * as THREE from "three";
import { GAME_WORLD_HEIGHT, GAME_WORLD_SEED } from "@familyspeak/shared";

/**
 * Ambiance purement cliente et déterministe : cycle jour/nuit, nuages et météo sont calculés à
 * partir de l'horloge murale (Date.now()) et de la seed du monde, sans le moindre aller-retour
 * réseau — tous les joueurs voient donc le même ciel au même instant sans synchronisation.
 */

/** Durée d'un cycle jour/nuit complet, en millisecondes réelles. Volontairement courte pour
 * qu'un enfant voie le ciel changer pendant une session — facile à raccourcir pour les tests. */
export const DAY_CYCLE_MS = 12 * 60 * 1000;

/** Durée d'une fenêtre météo : l'état (pluie ou non) est tiré une fois par fenêtre, pas en continu. */
export const WEATHER_PERIOD_MS = 4 * 60 * 1000;
const WEATHER_TRANSITION_SECONDS = 5;
const RAIN_CHANCE = 0.3;

const SKY_DAY_COLOR = new THREE.Color(0x87ceeb);
const SKY_NIGHT_COLOR = new THREE.Color(0x0a1128);
const CLOUD_CLEAR_COLOR = new THREE.Color(0xffffff);
const CLOUD_STORM_COLOR = new THREE.Color(0x4b4b52);
const SUN_COLOR = 0xfff3c4;

const SUN_DISTANCE = 300;
const SUN_RADIUS = 9;

const CLOUD_COUNT = 12;
const CLOUD_CLUSTER_MIN_BOXES = 3;
const CLOUD_CLUSTER_MAX_BOXES = 4;
const CLOUD_HEIGHT_ABOVE_TERRAIN = 15;
const CLOUD_FIELD_RADIUS = 130; // rayon (autour du joueur) sur lequel les nuages dérivent/bouclent
const CLOUD_DRIFT_SPEED = 1.2; // unités monde / seconde

const RAIN_DROP_COUNT = 350;
const RAIN_FIELD_RADIUS = 35;
const RAIN_COLUMN_HEIGHT = 25;
const RAIN_FALL_SPEED = 22;
const RAIN_SEGMENT_LENGTH = 0.6;
const RAIN_MAX_OPACITY = 0.55;

/** Même technique de hash que `hashLatticePoint` (packages/shared/src/game.ts) : déterministe,
 * réparti uniformément dans [0,1), pas besoin d'être cryptographique. */
function hashToUnit(seed: number, index: number): number {
  let h = Math.imul(seed ^ index, 374761393);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function weatherWindowIsRainy(windowIndex: number): boolean {
  return hashToUnit(GAME_WORLD_SEED, windowIndex) < RAIN_CHANCE;
}

/** Enroule une valeur dans [-radius, radius) — utilisé pour faire "boucler" les nuages qui
 * dérivent autour du joueur sans jamais les faire dépendre des coordonnées monde canoniques. */
function wrapSigned(value: number, radius: number): number {
  const size = radius * 2;
  return (((value + radius) % size) + size) % size - radius;
}

interface CloudInstance {
  group: THREE.Group;
  baseOffsetX: number;
  offsetZ: number;
  offsetY: number;
  driftX: number;
}

export class SkySystem {
  readonly ambientLight: THREE.AmbientLight;
  readonly sunLight: THREE.DirectionalLight;
  private readonly sunMesh: THREE.Mesh;
  private readonly cloudMaterial: THREE.MeshLambertMaterial;
  private readonly clouds: CloudInstance[] = [];
  private readonly rainGeometry: THREE.BufferGeometry;
  private readonly rainMaterial: THREE.LineBasicMaterial;
  private readonly rainLines: THREE.LineSegments;
  private readonly rainLocalX: Float32Array;
  private readonly rainLocalZ: Float32Array;
  private readonly rainLocalY: Float32Array;
  private readonly rainPositions: Float32Array;
  private rainAmount = 0; // 0 = ciel clair, 1 = pluie battante — interpolé pour un fondu doux

  constructor(private readonly scene: THREE.Scene) {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.7);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS, 12, 12);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: SUN_COLOR });
    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(this.sunMesh);

    this.cloudMaterial = new THREE.MeshLambertMaterial({ color: CLOUD_CLEAR_COLOR.clone() });
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const group = this.buildCloudCluster(i);
      scene.add(group);
      this.clouds.push({
        group,
        baseOffsetX: wrapSigned((hashToUnit(GAME_WORLD_SEED, i * 3) - 0.5) * 2 * CLOUD_FIELD_RADIUS, CLOUD_FIELD_RADIUS),
        offsetZ: wrapSigned((hashToUnit(GAME_WORLD_SEED, i * 3 + 1) - 0.5) * 2 * CLOUD_FIELD_RADIUS, CLOUD_FIELD_RADIUS),
        offsetY: hashToUnit(GAME_WORLD_SEED, i * 3 + 2) * 4,
        driftX: 0,
      });
    }

    this.rainLocalX = new Float32Array(RAIN_DROP_COUNT);
    this.rainLocalZ = new Float32Array(RAIN_DROP_COUNT);
    this.rainLocalY = new Float32Array(RAIN_DROP_COUNT);
    for (let i = 0; i < RAIN_DROP_COUNT; i++) {
      this.rainLocalX[i] = (hashToUnit(GAME_WORLD_SEED, 1000 + i * 3) - 0.5) * 2 * RAIN_FIELD_RADIUS;
      this.rainLocalZ[i] = (hashToUnit(GAME_WORLD_SEED, 1000 + i * 3 + 1) - 0.5) * 2 * RAIN_FIELD_RADIUS;
      this.rainLocalY[i] = hashToUnit(GAME_WORLD_SEED, 1000 + i * 3 + 2) * RAIN_COLUMN_HEIGHT;
    }
    this.rainPositions = new Float32Array(RAIN_DROP_COUNT * 2 * 3);
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute("position", new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMaterial = new THREE.LineBasicMaterial({
      color: 0xaec6f2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
    scene.add(this.rainLines);
  }

  private buildCloudCluster(index: number): THREE.Group {
    const group = new THREE.Group();
    const boxCount =
      CLOUD_CLUSTER_MIN_BOXES +
      Math.floor(hashToUnit(GAME_WORLD_SEED, index * 7) * (CLOUD_CLUSTER_MAX_BOXES - CLOUD_CLUSTER_MIN_BOXES + 1));
    for (let i = 0; i < boxCount; i++) {
      const w = 4 + hashToUnit(GAME_WORLD_SEED, index * 7 + i * 2) * 4;
      const d = 4 + hashToUnit(GAME_WORLD_SEED, index * 7 + i * 2 + 1) * 4;
      const geometry = new THREE.BoxGeometry(w, 1.5, d);
      const mesh = new THREE.Mesh(geometry, this.cloudMaterial);
      mesh.position.set(
        (hashToUnit(GAME_WORLD_SEED, index * 11 + i * 2) - 0.5) * 6,
        (hashToUnit(GAME_WORLD_SEED, index * 11 + i * 2 + 1) - 0.5) * 1.5,
        (hashToUnit(GAME_WORLD_SEED, index * 13 + i * 2) - 0.5) * 6,
      );
      group.add(mesh);
    }
    return group;
  }

  /** À appeler une fois par frame, avant le rendu. `wallClockMs` doit venir de Date.now() (pas
   * performance.now()) pour que le cycle jour/nuit et la météo restent identiques pour tout le
   * monde sans synchronisation réseau. */
  update(wallClockMs: number, dt: number, playerX: number, playerY: number, playerZ: number): void {
    const dayProgress = (wallClockMs % DAY_CYCLE_MS) / DAY_CYCLE_MS;
    const angle = dayProgress * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.35).normalize();
    const sunHeight = sunDir.y;

    this.sunLight.position.set(
      playerX + sunDir.x * SUN_DISTANCE,
      playerY + sunDir.y * SUN_DISTANCE,
      playerZ + sunDir.z * SUN_DISTANCE,
    );
    this.sunLight.target.position.set(playerX, playerY, playerZ);
    this.sunLight.target.updateMatrixWorld();
    this.sunMesh.position.copy(this.sunLight.position);
    this.sunMesh.visible = sunHeight > 0.02;

    const dayFactor = THREE.MathUtils.clamp((sunHeight + 0.2) / 1.2, 0, 1);
    this.sunLight.intensity = dayFactor * 0.8;
    this.ambientLight.intensity = 0.15 + dayFactor * 0.55;
    this.scene.background = SKY_NIGHT_COLOR.clone().lerp(SKY_DAY_COLOR, dayFactor);

    const windowIndex = Math.floor(wallClockMs / WEATHER_PERIOD_MS);
    const targetRain = weatherWindowIsRainy(windowIndex) ? 1 : 0;
    const maxDelta = dt / WEATHER_TRANSITION_SECONDS;
    this.rainAmount += THREE.MathUtils.clamp(targetRain - this.rainAmount, -maxDelta, maxDelta);

    this.cloudMaterial.color.copy(CLOUD_CLEAR_COLOR).lerp(CLOUD_STORM_COLOR, this.rainAmount);
    for (const cloud of this.clouds) {
      cloud.driftX += dt * CLOUD_DRIFT_SPEED;
      const x = wrapSigned(cloud.baseOffsetX + cloud.driftX, CLOUD_FIELD_RADIUS);
      cloud.group.position.set(
        playerX + x,
        GAME_WORLD_HEIGHT + CLOUD_HEIGHT_ABOVE_TERRAIN + cloud.offsetY,
        playerZ + cloud.offsetZ,
      );
    }

    this.rainMaterial.opacity = this.rainAmount * RAIN_MAX_OPACITY;
    if (this.rainAmount > 0.01) {
      for (let i = 0; i < RAIN_DROP_COUNT; i++) {
        this.rainLocalY[i]! -= RAIN_FALL_SPEED * dt;
        if (this.rainLocalY[i]! < 0) this.rainLocalY[i]! += RAIN_COLUMN_HEIGHT;
        const worldX = playerX + this.rainLocalX[i]!;
        const worldZ = playerZ + this.rainLocalZ[i]!;
        const topY = playerY + this.rainLocalY[i]!;
        const base = i * 6;
        this.rainPositions[base] = worldX;
        this.rainPositions[base + 1] = topY;
        this.rainPositions[base + 2] = worldZ;
        this.rainPositions[base + 3] = worldX;
        this.rainPositions[base + 4] = topY - RAIN_SEGMENT_LENGTH;
        this.rainPositions[base + 5] = worldZ;
      }
      this.rainGeometry.attributes.position!.needsUpdate = true;
    }
  }

  dispose(): void {
    this.scene.remove(this.ambientLight, this.sunLight, this.sunLight.target, this.sunMesh, this.rainLines);
    this.sunMesh.geometry.dispose();
    (this.sunMesh.material as THREE.Material).dispose();
    this.cloudMaterial.dispose();
    for (const cloud of this.clouds) {
      this.scene.remove(cloud.group);
      for (const child of cloud.group.children) {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      }
    }
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
  }
}
