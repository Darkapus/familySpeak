import { useRef } from "react";
import type { GameInputState } from "../engine/input.js";

const JOYSTICK_RADIUS = 44;
const LOOK_SENSITIVITY = 0.005;
const MAX_PITCH = Math.PI / 2 - 0.01;

/**
 * Contrôles tactiles mobiles : joystick virtuel (déplacement) + glisser pour regarder sur le
 * reste de l'écran + boutons casser/poser/sauter. Écrit directement dans le même GameInputState
 * partagé que les contrôles desktop, sans passer par le state React (pas de re-render par frame).
 */
export function TouchControls({ inputState }: { inputState: GameInputState }) {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickThumbRef = useRef<HTMLDivElement>(null);
  const joystickPointerId = useRef<number | null>(null);
  const joystickOrigin = useRef({ x: 0, y: 0 });

  const lookPointerId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  function onJoystickPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (joystickPointerId.current !== null) return;
    joystickPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = joystickBaseRef.current!.getBoundingClientRect();
    joystickOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function onJoystickPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== joystickPointerId.current) return;
    const dx = event.clientX - joystickOrigin.current.x;
    const dy = event.clientY - joystickOrigin.current.y;
    const dist = Math.min(Math.hypot(dx, dy), JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const nx = dist === 0 ? 0 : (Math.cos(angle) * dist) / JOYSTICK_RADIUS;
    const ny = dist === 0 ? 0 : (Math.sin(angle) * dist) / JOYSTICK_RADIUS;
    inputState.moveRight = nx;
    inputState.moveForward = -ny;
    if (joystickThumbRef.current) {
      joystickThumbRef.current.style.transform = `translate(${nx * JOYSTICK_RADIUS}px, ${ny * JOYSTICK_RADIUS}px)`;
    }
  }

  function onJoystickPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== joystickPointerId.current) return;
    joystickPointerId.current = null;
    inputState.moveForward = 0;
    inputState.moveRight = 0;
    if (joystickThumbRef.current) joystickThumbRef.current.style.transform = "translate(0px, 0px)";
  }

  function onLookPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (lookPointerId.current !== null) return;
    lookPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    lookLast.current = { x: event.clientX, y: event.clientY };
  }

  function onLookPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== lookPointerId.current) return;
    const dx = event.clientX - lookLast.current.x;
    const dy = event.clientY - lookLast.current.y;
    lookLast.current = { x: event.clientX, y: event.clientY };
    inputState.yaw -= dx * LOOK_SENSITIVITY;
    inputState.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, inputState.pitch - dy * LOOK_SENSITIVITY));
  }

  function onLookPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== lookPointerId.current) return;
    lookPointerId.current = null;
  }

  return (
    <>
      <div
        onPointerDown={onLookPointerDown}
        onPointerMove={onLookPointerMove}
        onPointerUp={onLookPointerUp}
        onPointerCancel={onLookPointerUp}
        className="absolute inset-0 touch-none"
      />
      <div
        ref={joystickBaseRef}
        onPointerDown={onJoystickPointerDown}
        onPointerMove={onJoystickPointerMove}
        onPointerUp={onJoystickPointerUp}
        onPointerCancel={onJoystickPointerUp}
        className="absolute bottom-6 left-6 h-28 w-28 touch-none rounded-full bg-white/20"
      >
        <div
          ref={joystickThumbRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50"
        />
      </div>
      <button
        onPointerDown={(event) => {
          event.preventDefault();
          inputState.jumpPressed = true;
        }}
        onPointerUp={() => {
          inputState.jumpPressed = false;
        }}
        onPointerCancel={() => {
          inputState.jumpPressed = false;
        }}
        aria-label="Sauter"
        className="absolute bottom-6 right-28 h-16 w-16 touch-none rounded-full bg-white/20 text-2xl text-white"
      >
        ⬆
      </button>
      <button
        onPointerDown={(event) => {
          event.preventDefault();
          inputState.breakRequested = true;
        }}
        aria-label="Casser"
        className="absolute bottom-28 right-6 h-16 w-16 touch-none rounded-full bg-white/20 text-2xl"
      >
        ⛏️
      </button>
      <button
        onPointerDown={(event) => {
          event.preventDefault();
          inputState.placeRequested = true;
        }}
        aria-label="Poser"
        className="absolute bottom-6 right-6 h-16 w-16 touch-none rounded-full bg-white/20 text-2xl"
      >
        🧱
      </button>
      <button
        onPointerDown={(event) => {
          event.preventDefault();
          inputState.homeRequested = true;
        }}
        aria-label="Définir mon repère ici"
        className="absolute right-3 top-3 h-11 w-11 touch-none rounded-full bg-white/20 text-lg"
      >
        🚩
      </button>
    </>
  );
}
