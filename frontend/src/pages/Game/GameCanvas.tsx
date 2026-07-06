import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  GAME_WORLD_HEIGHT,
  GAME_WORLD_SIZE_X,
  GAME_WORLD_SIZE_Z,
  isWithinGameWorldBounds,
  wrapCoord,
  type GameBlockType,
  type GamePlayerStateDTO,
  type PlayerHomeDTO,
  type ServerToClientEvent,
} from "@familyspeak/shared";
import { fetchWorldInfo } from "../../api/game.js";
import { useWebSocket } from "../../hooks/useWebSocket.js";
import { useWsStore } from "../../store/ws.js";
import { ChunkManager } from "./engine/chunkManager.js";
import { attachDesktopControls, createInputState, inputToWorldMove } from "./engine/input.js";
import { createPlayerPhysicsState, stepPlayer, PLAYER_EYE_HEIGHT } from "./engine/player.js";
import { raycastVoxels } from "./engine/raycast.js";
import { createAvatar, createHomeMarker, type AvatarHandle } from "./engine/avatar.js";
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
  setSpawn: (self: GamePlayerStateDTO) => void;
  setInitialPlayers: (players: GamePlayerStateDTO[]) => void;
  upsertPlayer: (player: GamePlayerStateDTO) => void;
  removePlayer: (userId: string) => void;
  movePlayer: (payload: { userId: string; x: number; y: number; z: number; yaw: number; pitch: number }) => void;
  upsertHomeMarker: (home: PlayerHomeDTO) => void;
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
        gameApiRef.current?.setSpawn(event.payload.self);
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
      case "game:home-set":
        gameApiRef.current?.upsertHomeMarker(event.payload);
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

    let animationFrameId = 0;
    let playerState = createPlayerPhysicsState(SPAWN_X, GAME_WORLD_HEIGHT, SPAWN_Z);
    let controls: ReturnType<typeof attachDesktopControls> | null = null;
    let hasClosedLoadingScreen = false;
    // Position de spawn réelle (repère personnel si défini, sinon spawn par défaut), reçue via
    // `game:snapshot` une fois connecté — tant qu'elle est inconnue, on charge par défaut autour
    // du centre du monde puis on se réoriente dès qu'elle arrive (généralement en une fraction de
    // seconde après la connexion).
    let pendingSpawn: { x: number; y: number; z: number; yaw: number; pitch: number } | null = null;
    const inputState = inputStateRef.current;
    const remoteAvatars = new Map<string, RemoteAvatarState>();
    const homeMarkers = new Map<string, AvatarHandle>();

    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 block h-full w-full cursor-pointer";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    const chunkManager = new ChunkManager(scene);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
    camera.rotation.order = "YXZ";
    camera.position.set(SPAWN_X, 40, SPAWN_Z);

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

    function upsertHomeMarker(home: PlayerHomeDTO) {
      const existing = homeMarkers.get(home.userId);
      if (existing) {
        scene.remove(existing.group);
        existing.dispose();
      }
      const marker = createHomeMarker(home.displayName);
      marker.group.position.set(home.x, home.y, home.z);
      scene.add(marker.group);
      homeMarkers.set(home.userId, marker);
    }

    gameApiRef.current = {
      applyBlockChange(x, y, z, blockType) {
        chunkManager.applyBlockChange(x, y, z, blockType);
      },
      setSpawn(self) {
        pendingSpawn = { x: self.x, y: self.y, z: self.z, yaw: self.yaw, pitch: self.pitch };
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
      upsertHomeMarker,
    };

    const forwardDirection = new THREE.Vector3();

    function handleBlockInteractions() {
      if (!inputState.breakRequested && !inputState.placeRequested) return;

      camera.getWorldDirection(forwardDirection);
      const hit = raycastVoxels(
        [camera.position.x, camera.position.y, camera.position.z],
        [forwardDirection.x, forwardDirection.y, forwardDirection.z],
        MAX_REACH,
        (x, y, z) => chunkManager.isSolid(x, y, z),
      );

      if (hit) {
        // Le monde boucle : la marche du rayon peut franchir une case négative ou ≥ taille près
        // d'un bord. On enroule (x/z seulement) avant toute édition pour toujours cibler la case
        // canonique côté serveur — une seule source de vérité dans world_blocks.
        const hitX = wrapCoord(hit.x, GAME_WORLD_SIZE_X);
        const hitZ = wrapCoord(hit.z, GAME_WORLD_SIZE_Z);
        const placeX = wrapCoord(hit.px, GAME_WORLD_SIZE_X);
        const placeZ = wrapCoord(hit.pz, GAME_WORLD_SIZE_Z);

        if (inputState.breakRequested) {
          chunkManager.applyBlockChange(hitX, hit.y, hitZ, null);
          wsSendRef.current?.({ type: "game:break", payload: { x: hitX, y: hit.y, z: hitZ } });
        } else if (inputState.placeRequested && isWithinGameWorldBounds(placeX, hit.py, placeZ)) {
          chunkManager.applyBlockChange(placeX, hit.py, placeZ, inputState.selectedBlockType);
          wsSendRef.current?.({
            type: "game:place",
            payload: { x: placeX, y: hit.py, z: placeZ, blockType: inputState.selectedBlockType },
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

      if (controls) {
        controls.update();
        const { moveX, moveZ } = inputToWorldMove(inputState);
        playerState = stepPlayer(
          playerState,
          { moveX, moveZ, jump: inputState.jumpPressed },
          dt,
          (x, y, z) => chunkManager.isSolid(x, y, z),
        );
        camera.position.set(playerState.x, playerState.y + PLAYER_EYE_HEIGHT, playerState.z);
        camera.rotation.y = inputState.yaw;
        camera.rotation.x = inputState.pitch;

        handleBlockInteractions();

        if (inputState.homeRequested) {
          inputState.homeRequested = false;
          wsSendRef.current?.({
            type: "game:set-home",
            payload: { x: playerState.x, y: playerState.y, z: playerState.z, yaw: inputState.yaw, pitch: inputState.pitch },
          });
        }

        if (now - lastMoveSentAt >= MOVE_SEND_INTERVAL_MS) {
          lastMoveSentAt = now;
          wsSendRef.current?.({
            type: "game:move",
            payload: { x: playerState.x, y: playerState.y, z: playerState.z, yaw: inputState.yaw, pitch: inputState.pitch },
          });
        }
      }

      if (hasClosedLoadingScreen) {
        chunkManager.update(playerState.x, playerState.z);
      } else {
        // Avant de connaître le spawn réel (repère ou défaut), on charge par défaut autour du
        // centre du monde ; dès que `pendingSpawn` arrive, on recentre le chargement dessus.
        const focusX = pendingSpawn?.x ?? SPAWN_X;
        const focusZ = pendingSpawn?.z ?? SPAWN_Z;
        chunkManager.update(focusX, focusZ);

        if (pendingSpawn && chunkManager.isChunkLoadedAt(pendingSpawn.x, pendingSpawn.z)) {
          hasClosedLoadingScreen = true;
          playerState = createPlayerPhysicsState(pendingSpawn.x, pendingSpawn.y, pendingSpawn.z);
          inputState.yaw = pendingSpawn.yaw;
          inputState.pitch = pendingSpawn.pitch;
          controls = attachDesktopControls(canvas, inputState);
          setIsLoading(false);
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

    let cancelled = false;
    fetchWorldInfo()
      .then(({ homes }) => {
        if (cancelled) return;
        for (const home of homes) upsertHomeMarker(home);
      })
      .catch(() => {
        // Les repères ne sont qu'un confort d'affichage : la zone de spawn continue de se
        // charger via ChunkManager même si cet appel échoue.
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls?.dispose();
      chunkManager.dispose();
      for (const userId of remoteAvatars.keys()) removeRemoteAvatar(userId);
      for (const marker of homeMarkers.values()) marker.dispose();
      homeMarkers.clear();
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
