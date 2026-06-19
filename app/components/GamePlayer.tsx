"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/data";
import { saveGameScore } from "@/lib/leaderboard";
import { createClient } from "@/utils/supabase/client";
import Asteroides from "./games/Asteroides";
import Tetris from "./games/Tetris";
import Snake from "./games/Snake";
import TouchControls, { type TouchControlsProps } from "./games/TouchControls";
import { useIsTouchDevice } from "@/lib/useIsTouchDevice";

const ASTEROIDES_TOUCH: TouchControlsProps = {
  dpad: {
    left: { code: "ArrowLeft", label: "◀", mode: "hold" },
    right: { code: "ArrowRight", label: "▶", mode: "hold" },
    up: { code: "ArrowUp", label: "▲", mode: "hold" },
  },
  actions: [{ code: "Space", label: "DISPARAR", mode: "tap" }],
};

const TETRIS_TOUCH: TouchControlsProps = {
  dpad: {
    left: { code: "ArrowLeft", label: "◀", mode: "repeat" },
    right: { code: "ArrowRight", label: "▶", mode: "repeat" },
    down: { code: "ArrowDown", label: "▼", mode: "repeat" },
  },
  actions: [
    { code: "ArrowUp", label: "ROTAR", mode: "tap" },
    { code: "Space", label: "CAÍDA", mode: "tap" },
  ],
};

const SNAKE_TOUCH: TouchControlsProps = {
  dpad: {
    up: { code: "ArrowUp", label: "▲", mode: "tap" },
    down: { code: "ArrowDown", label: "▼", mode: "tap" },
    left: { code: "ArrowLeft", label: "◀", mode: "tap" },
    right: { code: "ArrowRight", label: "▶", mode: "tap" },
  },
  actions: [],
};

export default function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const isAsteroides = game.id === "asteroides";
  const isTetris = game.id === "tetris";
  const isSnake = game.id === "snake";
  const isTouch = useIsTouchDevice();
  const touchConfig = isAsteroides
    ? ASTEROIDES_TOUCH
    : isTetris
      ? TETRIS_TOUCH
      : isSnake
        ? SNAKE_TOUCH
        : null;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);

  const [astScore, setAstScore] = useState(0);
  const [astLives, setAstLives] = useState(3);
  const [astLevel, setAstLevel] = useState(1);
  const [astPowerUp, setAstPowerUp] = useState(0);
  const [tetScore, setEngScore] = useState(0);
  const [tetLines, setEngLines] = useState(0);
  const [tetLevel, setEngLevel] = useState(1);
  const [snkScore, setSnkScore] = useState(0);
  const [snkLength, setSnkLength] = useState(3);
  const [snkLevel, setSnkLevel] = useState(1);
  const [resetSignal, setResetSignal] = useState(0);
  const [endSignal, setEndSignal] = useState(0);

  const displayScore = isAsteroides
    ? astScore
    : isTetris
      ? tetScore
      : isSnake
        ? snkScore
        : score;
  const displayLives = isAsteroides ? astLives : lives;
  const level = isAsteroides
    ? astLevel
    : isTetris
      ? tetLevel
      : isSnake
        ? snkLevel
        : Math.floor(score / 2500) + 1;

  useEffect(() => {
    if (isAsteroides || isTetris || isSnake || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isAsteroides, isTetris, isSnake, over, paused]);

  const endGame = () => setOver(true);
  const forceEnd = () => {
    if (isAsteroides || isTetris || isSnake) setEndSignal((s) => s + 1);
    else endGame();
  };
  const saveScore = async () => {
    if (isAsteroides) {
      await saveGameScore(createClient(), "asteroides", name, displayScore);
    } else if (isTetris) {
      await saveGameScore(createClient(), "tetris", name, displayScore);
    } else if (isSnake) {
      await saveGameScore(createClient(), "snake", name, displayScore);
    }
    setSaved(true);
  };

  const restart = () => {
    setScore(0);
    setLives(3);
    setAstScore(0);
    setAstLives(3);
    setAstLevel(1);
    setAstPowerUp(0);
    setEngScore(0);
    setEngLines(0);
    setEngLevel(1);
    setSnkScore(0);
    setSnkLength(3);
    setSnkLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    if (isAsteroides || isTetris || isSnake) setResetSignal((s) => s + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{displayScore.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">
              {isTetris ? "Líneas" : isSnake ? "Longitud" : "Vidas"}
            </div>
            <div className="v">
              {isTetris
                ? tetLines
                : isSnake
                  ? snkLength
                  : "♥ ".repeat(displayLives).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {isAsteroides && astPowerUp > 0 && (
            <div className="hud-stat">
              <div className="l">Power-up</div>
              <div className="v" style={{ color: "var(--cyan)" }}>
                3x {astPowerUp.toFixed(1)}s
              </div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={forceEnd}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            {isAsteroides ? (
              <Asteroides
                paused={paused}
                resetSignal={resetSignal}
                endSignal={endSignal}
                onScoreChange={setAstScore}
                onLivesChange={setAstLives}
                onLevelChange={setAstLevel}
                onPowerUpChange={setAstPowerUp}
                onGameOver={endGame}
              />
            ) : isTetris ? (
              <Tetris
                paused={paused}
                resetSignal={resetSignal}
                endSignal={endSignal}
                onScoreChange={setEngScore}
                onLinesChange={setEngLines}
                onLevelChange={setEngLevel}
                onTogglePause={() => setPaused((p) => !p)}
                onGameOver={endGame}
              />
            ) : isSnake ? (
              <Snake
                paused={paused}
                resetSignal={resetSignal}
                endSignal={endSignal}
                onScoreChange={setSnkScore}
                onLengthChange={setSnkLength}
                onLevelChange={setSnkLevel}
                onGameOver={endGame}
              />
            ) : (
              <>
                <div className="grid-floor"></div>
                <div className="enemy e1"></div>
                <div className="enemy e2"></div>
                <div className="enemy e3"></div>
                <div className="player-ship"></div>
              </>
            )}
          </div>
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        {isTouch && touchConfig && (
          <TouchControls
            dpad={touchConfig.dpad}
            actions={touchConfig.actions}
          />
        )}
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{displayScore.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={saveScore}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
