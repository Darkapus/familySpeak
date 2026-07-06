import * as THREE from "three";
import { PLAYER_HEIGHT } from "./player.js";

const AVATAR_RADIUS = 0.3;
const AVATAR_COLOR = 0xff9800;

function createNameSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(text);
  const boxWidth = Math.min(canvas.width, metrics.width + 32);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect((canvas.width - boxWidth) / 2, canvas.height / 2 - 22, boxWidth, 44);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.set(0, PLAYER_HEIGHT + 0.4, 0);
  return sprite;
}

export interface AvatarHandle {
  group: THREE.Group;
  dispose: () => void;
}

/** Avatar simple (capsule colorée + étiquette de nom) représentant un autre joueur en ligne. */
export function createAvatar(displayName: string): AvatarHandle {
  const group = new THREE.Group();

  const bodyGeometry = new THREE.CapsuleGeometry(AVATAR_RADIUS, PLAYER_HEIGHT - AVATAR_RADIUS * 2, 4, 8);
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: AVATAR_COLOR });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.set(0, PLAYER_HEIGHT / 2, 0);
  group.add(body);

  const nameSprite = createNameSprite(displayName);
  group.add(nameSprite);

  function dispose() {
    bodyGeometry.dispose();
    bodyMaterial.dispose();
    const spriteMaterial = nameSprite.material as THREE.SpriteMaterial;
    spriteMaterial.map?.dispose();
    spriteMaterial.dispose();
  }

  return { group, dispose };
}

const HOME_POLE_COLOR = 0x8d6e63;
const HOME_FLAG_COLOR = 0xe53935;
const HOME_POLE_HEIGHT = 2.2;

/** Marqueur du repère de spawn personnel d'un joueur (poteau + fanion + nom) — visuellement
 * distinct d'un avatar de joueur en ligne, visible même quand son propriétaire est déconnecté. */
export function createHomeMarker(displayName: string): AvatarHandle {
  const group = new THREE.Group();

  const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, HOME_POLE_HEIGHT, 6);
  const poleMaterial = new THREE.MeshLambertMaterial({ color: HOME_POLE_COLOR });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.set(0, HOME_POLE_HEIGHT / 2, 0);
  group.add(pole);

  const flagGeometry = new THREE.PlaneGeometry(0.6, 0.4);
  const flagMaterial = new THREE.MeshLambertMaterial({ color: HOME_FLAG_COLOR, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(flagGeometry, flagMaterial);
  flag.position.set(0.3, HOME_POLE_HEIGHT - 0.3, 0);
  group.add(flag);

  const nameSprite = createNameSprite(displayName);
  nameSprite.position.set(0, HOME_POLE_HEIGHT + 0.4, 0);
  group.add(nameSprite);

  function dispose() {
    poleGeometry.dispose();
    poleMaterial.dispose();
    flagGeometry.dispose();
    flagMaterial.dispose();
    const spriteMaterial = nameSprite.material as THREE.SpriteMaterial;
    spriteMaterial.map?.dispose();
    spriteMaterial.dispose();
  }

  return { group, dispose };
}
