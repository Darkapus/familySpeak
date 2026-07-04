import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  GAME_WORLD_HEIGHT,
  GAME_WORLD_SIZE_X,
  GAME_WORLD_SIZE_Z,
  isWithinGameWorldBounds,
  terrainHeightAt,
  type GameBlockType,
  type GamePlayerStateDTO,
  type ServerToClientEvent,
} from "@familyspeak/shared";
import { fetchWorld } from "../../api/game.js";
import { useWebSocket } from "../../hooks/useWebSocket.js";
import { useWsStore } from "../../store/ws.js";
import { WorldGrid, buildTerrainMeshes, disposeTerrainMeshes } from "./engine/scene.js";
import { attachDesktopControls, createInputState, inputToWorldMove } from "./engine/input.js";
import { createPlayerPhysicsState, stepPlayer, PLAYER_EYE_HEIGHT } from "./engine/player.js";
import { raycastVoxels } from "./engine/raycast.js";
import { createAvatar, type AvatarHandle } from "./engine/avatar.js";
import { TouchControls } from "./components/TouchControls.js";
import { BlockPalette } from "./components/BlockPalette.js";

const isTouchDevice =
  typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const SPAWN_X = GAME_WORLD_SIZE_X / 2;
const SPAWN_Z = GAME_WORLD_SIZE_Z / 2;
const MAX_DT = 1 / 20;
const MAX_REACH = 6;
const MOVE_SEND_INTERVAL_MS = 100;
const AVATAR_LERP_SPEED = 10;

interface RemoteAvatarState {
  avatar: AvatarHandle;
  target: { x: number; y: number; z: number; yaw: number };
  render: { x: number; y: number; z: number; yaw: number };
}

interface GameApi {
  applyBlockChange: (x: number, y: number, z: number, blockType: GameBlockType | null) => void;
  setInitialPlayers: (players: GamePlayerStateDTO[]) => void;
  upsertPlayer: (player: GamePlayerStateDTO) => void;
  removePlayer: (userId: string) => void;
  movePlayer: (payload: { userId: string; x: number; y: number; z: number; yaw: number; pitch: number }) => void;
}

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const gameApiRef = useRef<GameApi | null>(null);
  const inputStateRef = useRef(createInputState());

  const wsSend = useWsStore((s) => s.send);
  const isConnected = useWsStore((s) => s.isConnected);
  const wsSendRef = useRef(wsSend);
  wsSendRef.current = wsSend;

  const handleGameEvent = useCallback((event: ServerToClientEvent) => {
    switch (event.type) {
      case "game:snapshot":
        gameApiRef.current?.setInitialPlayers(event.payload.players);
        return;
      case "game:player-joined":
        gameApiRef.current?.upsertPlayer(event.payload);
        return;
      case "game:player-left":
        gameApiRef.current?.removePlayer(event.payload.userId);
        return;
      case "game:player-moved":
        gameApiRef.current?.movePlayer(event.payload);
        return;
      case "game:block-changed":
        gameApiRef.current?.applyBlockChange(
          event.payload.x,
          event.payload.y,
          event.payload.z,
          event.payload.blockType,
        );
        return;
      default:
        return;
    }
  }, []);

  useWebSocket(handleGameEvent);

  useEffect(() => {
    if (!isConnected) return;
    wsSend?.({ type: "game:join", payload: {} });
    return () => {
      wsSend?.({ type: "game:leave", payload: {} });
    };
  }, [isConnected, wsSend]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let animationFrameId = 0;
    let terrainMeshes: Map<GameBlockType, THREE.Mesh> | null = null;
    let grid: WorldGrid | null = null;
    let playerState = createPlayerPhysicsState(SPAWN_X, GAME_WORLD_HEIGHT, SPAWN_Z);
    let controls: ReturnType<typeof attachDesktopControls> | null = null;
    const inputState = inputStateRef.current;
    const remoteAvatars = new Map<string, RemoteAvatarState>();

    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 block h-full w-full cursor-pointer";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
    camera.rotation.order = "YXZ";
    camera.position.set(SPAWN_X + 30, GAME_WORLD_HEIGHT + 15, SPAWN_Z + 30);
    camera.lookAt(SPAWN_X, GAME_WORLD_HEIGHT / 3, SPAWN_Z);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(1, 1.5, 0.5);
    scene.add(sun);

    function resize() {
      const { clientWidth, clientHeight } = container!;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    function rebuildTerrainMeshes() {
      if (!grid) return;
      if (terrainMeshes) {
        for (const mesh of terrainMeshes.values()) scene.remove(mesh);
        disposeTerrainMeshes(terrainMeshes.values());
      }
      terrainMeshes = buildTerrainMeshes(grid);
      for (const mesh of terrainMeshes.values()) scene.add(mesh);
    }

    function removeRemoteAvatar(userId: string) {
      const existing = remoteAvatars.get(userId);
      if (!existing) return;
      scene.remove(existing.avatar.group);
      existing.avatar.dispose();
      remoteAvatars.delete(userId);
    }

    function addRemoteAvatar(player: GamePlayerStateDTO) {
      removeRemoteAvatar(player.userId);
      const avatar = createAvatar(player.displayName);
      avatar.group.position.set(player.x, player.y, player.z);
      scene.add(avatar.group);
      remoteAvatars.set(player.userId, {
        avatar,
        target: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
        render: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
      });
    }

    gameApiRef.current = {
      applyBlockChange(x, y, z, blockType) {
        if (!grid) return;
        grid.setBlock(x, y, z, blockType);
        rebuildTerrainMeshes();
      },
      setInitialPlayers(players) {
        for (const userId of remoteAvatars.keys()) removeRemoteAvatar(userId);
        for (const player of players) addRemoteAvatar(player);
      },
      upsertPlayer(player) {
        addRemoteAvatar(player);
      },
      removePlayer(userId) {
        removeRemoteAvatar(userId);
      },
      movePlayer(payload) {
        const existing = remoteAvatars.get(payload.userId);
        if (!existing) return;
        existing.target.x = payload.x;
        existing.target.y = payload.y;
        existing.target.z = payload.z;
        existing.target.yaw = payload.yaw;
      },
    };

    const forwardDirection = new THREE.Vector3();

    function handleBlockInteractions() {
      if (!grid) return;
      if (!inputState.breakRequested && !inputState.placeRequested) return;

      camera.getWorldDirection(forwardDirection);
      const hit = raycastVoxels(
        [camera.position.x, camera.position.y, camera.position.z],
        [forwardDirection.x, forwardDirection.y, forwardDirection.z],
        MAX_REACH,
        (x, y, z) => grid!.isSolid(x, y, z),
      );

      if (hit) {
        if (inputState.breakRequested) {
          grid.setBlock(hit.x, hit.y, hit.z, null);
          rebuildTerrainMeshes();
          wsSendRef.current?.({ type: "game:break", payload: { x: hit.x, y: hit.y, z: hit.z } });
        } else if (inputState.placeRequested && isWithinGameWorldBounds(hit.px, hit.py, hit.pz)) {
          grid.setBlock(hit.px, hit.py, hit.pz, inputState.selectedBlockType);
          rebuildTerrainMeshes();
          wsSendRef.current?.({
            type: "game:place",
            payload: { x: hit.px, y: hit.py, z: hit.pz, blockType: inputState.selectedBlockType },
          });
        }
      }

      inputState.breakRequested = false;
      inputState.placeRequested = false;
    }

    let lastTime = performance.now();
    let lastMoveSentAt = 0;

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, MAX_DT);
      lastTime = now;

      if (grid && controls) {
        controls.update();
        const { moveX, moveZ } = inputToWorldMove(inputState);
        playerState = stepPlayer(
          playerState,
          { moveX, moveZ, jump: inputState.jumpPressed },
          dt,
          (x, y, z) => grid!.isSolid(x, y, z),
        );
        camera.position.set(playerState.x, playerState.y + PLAYER_EYE_HEIGHT, playerState.z);
        camera.rotation.y = inputState.yaw;
        camera.rotation.x = inputState.pitch;

        handleBlockInteractions();

        if (now - lastMoveSentAt >= MOVE_SEND_INTERVAL_MS) {
          lastMoveSentAt = now;
          wsSendRef.current?.({
            type: "game:move",
            payload: { x: playerState.x, y: playerState.y, z: playerState.z, yaw: inputState.yaw, pitch: inputState.pitch },
          });
        }
      }

      const lerpAlpha = Math.min(1, dt * AVATAR_LERP_SPEED);
      for (const { avatar, target, render } of remoteAvatars.values()) {
        render.x += (target.x - render.x) * lerpAlpha;
        render.y += (target.y - render.y) * lerpAlpha;
        render.z += (target.z - render.z) * lerpAlpha;
        render.yaw += (target.yaw - render.yaw) * lerpAlpha;
        avatar.group.position.set(render.x, render.y, render.z);
        avatar.group.rotation.y = render.yaw;
      }

      renderer.render(scene, camera);
    }
    animate();

    fetchWorld().then(({ blocks }) => {
      if (cancelled) return;
      grid = WorldGrid.fromDeltas(blocks);
      rebuildTerrainMeshes();

      const spawnGroundY = terrainHeightAt(Math.floor(SPAWN_X), Math.floor(SPAWN_Z)) + 1;
      playerState = createPlayerPhysicsState(SPAWN_X, spawnGroundY, SPAWN_Z);
      controls = attachDesktopControls(canvas, inputState);

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls?.dispose();
      if (terrainMeshes) disposeTerrainMeshes(terrainMeshes.values());
      for (const userId of remoteAvatars.keys()) removeRemoteAvatar(userId);
      renderer.dispose();
      container.removeChild(canvas);
      gameApiRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50">Chargement du monde…</div>
      )}
      {!isLoading && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 bg-white/80" />
          <div className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/80" />
        </div>
      )}
      {!isLoading && isTouchDevice && <TouchControls inputState={inputStateRef.current} />}
      {!isLoading && <BlockPalette inputState={inputStateRef.current} />}
    </div>
  );
}
