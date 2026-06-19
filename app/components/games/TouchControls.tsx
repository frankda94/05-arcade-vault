"use client";

import { useRef } from "react";

export type TouchButtonMode = "hold" | "repeat" | "tap";

export interface TouchButtonConfig {
  code: string;
  label: string;
  mode: TouchButtonMode;
}

export interface TouchControlsProps {
  dpad: {
    up?: TouchButtonConfig;
    down?: TouchButtonConfig;
    left?: TouchButtonConfig;
    right?: TouchButtonConfig;
  };
  actions: TouchButtonConfig[];
}

const REPEAT_DELAY = 500;
const REPEAT_INTERVAL = 33;

function dispatchKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

function TouchButton({ config }: { config: TouchButtonConfig }) {
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const pressedRef = useRef(false);

  const clearTimers = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const press = () => {
    if (pressedRef.current) return;
    pressedRef.current = true;
    dispatchKey("keydown", config.code);

    if (config.mode === "tap") {
      dispatchKey("keyup", config.code);
      pressedRef.current = false;
      return;
    }

    if (config.mode === "repeat") {
      timeoutRef.current = window.setTimeout(() => {
        intervalRef.current = window.setInterval(() => {
          dispatchKey("keydown", config.code);
        }, REPEAT_INTERVAL);
      }, REPEAT_DELAY);
    }
  };

  const release = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    clearTimers();
    if (config.mode !== "tap") {
      dispatchKey("keyup", config.code);
    }
  };

  const isInside = (touch: React.Touch, el: Element) => {
    const rect = el.getBoundingClientRect();
    return (
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom
    );
  };

  return (
    <button
      type="button"
      className="touch-btn"
      aria-label={config.label}
      onTouchStart={(e) => {
        e.preventDefault();
        press();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        release();
      }}
      onTouchCancel={(e) => {
        e.preventDefault();
        release();
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        if (touch && !isInside(touch, e.currentTarget)) release();
      }}
    >
      {config.label}
    </button>
  );
}

export default function TouchControls({ dpad, actions }: TouchControlsProps) {
  return (
    <div className="touch-controls">
      <div className="touch-dpad">
        <div className="touch-dpad-row">
          <span className="touch-dpad-spacer" />
          {dpad.up ? (
            <TouchButton config={dpad.up} />
          ) : (
            <span className="touch-dpad-spacer" />
          )}
          <span className="touch-dpad-spacer" />
        </div>
        <div className="touch-dpad-row">
          {dpad.left ? (
            <TouchButton config={dpad.left} />
          ) : (
            <span className="touch-dpad-spacer" />
          )}
          <span className="touch-dpad-spacer" />
          {dpad.right ? (
            <TouchButton config={dpad.right} />
          ) : (
            <span className="touch-dpad-spacer" />
          )}
        </div>
        <div className="touch-dpad-row">
          <span className="touch-dpad-spacer" />
          {dpad.down ? (
            <TouchButton config={dpad.down} />
          ) : (
            <span className="touch-dpad-spacer" />
          )}
          <span className="touch-dpad-spacer" />
        </div>
      </div>
      {actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((a) => (
            <TouchButton key={a.code} config={a} />
          ))}
        </div>
      )}
    </div>
  );
}
