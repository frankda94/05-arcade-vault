"use client";

import { useEffect, useRef, useState } from "react";

export interface FroggerProps {
  paused: boolean; // true = el loop interno no actualiza ni dibuja nuevos frames
  resetSignal: number; // al incrementarse, reinicia el juego desde cero
  endSignal: number; // al incrementarse, fuerza game over inmediato (botón FIN)
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: () => void; // se dispara cuando lives llega a 0 (natural o forzado por FIN)
  skinKey?: string; // 'classic' (default) | 'retro' | 'neon'
}

// ── Skins ────────────────────────────────────────────────────────────────────
interface Skin {
  boardBg: string;
  goalZone: string;
  riverZone: string;
  safeZone: string;
  roadZone: string;
  goalEmptyFill: string;
  goalFullFill: string;
  goalOutline: string;
  goalFlag: string;
  carFill: string;
  carWheel: string;
  truckFill: string;
  truckCab: string;
  logFill: string;
  logGrain: string;
  turtleFill: string;
  frogBody: string;
  frogEye: string;
  frogPupil: string;
  hudText: string;
  hudLife: string;
  timerHigh: string;
  timerMid: string;
  timerLow: string;
  glow: boolean;
  retroHighlight: boolean;
}

const SKINS: Record<string, Skin> = {
  classic: {
    boardBg: "#000000",
    goalZone: "#0a3d0a",
    riverZone: "#062a3d",
    safeZone: "#0a3d0a",
    roadZone: "#1a1a1a",
    goalEmptyFill: "#0d4d0d",
    goalFullFill: "#1f6b1f",
    goalOutline: "#f5ff00",
    goalFlag: "#00ff88",
    carFill: "#ff3b3b",
    carWheel: "#222222",
    truckFill: "#9aa0a6",
    truckCab: "#555555",
    logFill: "#7a4a23",
    logGrain: "rgba(0,0,0,0.3)",
    turtleFill: "#00ff88",
    frogBody: "#39ff14",
    frogEye: "#ffffff",
    frogPupil: "#000000",
    hudText: "#ffffff",
    hudLife: "#39ff14",
    timerHigh: "#00ff88",
    timerMid: "#f5ff00",
    timerLow: "#ff3b3b",
    glow: false,
    retroHighlight: false,
  },
  retro: {
    boardBg: "#10101a",
    goalZone: "#1d5c3a",
    riverZone: "#1c4f66",
    safeZone: "#1d5c3a",
    roadZone: "#2b2b33",
    goalEmptyFill: "#246b3f",
    goalFullFill: "#3a9a5c",
    goalOutline: "#ffe066",
    goalFlag: "#7be3a8",
    carFill: "#e8745a",
    carWheel: "#3a3a3a",
    truckFill: "#b9c0c8",
    truckCab: "#7c8189",
    logFill: "#a8703f",
    logGrain: "rgba(0,0,0,0.25)",
    turtleFill: "#7be3a8",
    frogBody: "#7ee08a",
    frogEye: "#fff8e7",
    frogPupil: "#1a1a1a",
    hudText: "#fff8e7",
    hudLife: "#7ee08a",
    timerHigh: "#7be3a8",
    timerMid: "#ffe066",
    timerLow: "#e8745a",
    glow: false,
    retroHighlight: true,
  },
  neon: {
    boardBg: "#000000",
    goalZone: "#001a14",
    riverZone: "#00131f",
    safeZone: "#001a14",
    roadZone: "#0a0a14",
    goalEmptyFill: "#002b1f",
    goalFullFill: "#00ffaa",
    goalOutline: "#00fff7",
    goalFlag: "#ff00e6",
    carFill: "#ff1f6b",
    carWheel: "#0ff0fc",
    truckFill: "#00e5ff",
    truckCab: "#ff1f6b",
    logFill: "#ff8a00",
    logGrain: "rgba(255,255,255,0.25)",
    turtleFill: "#00ffaa",
    frogBody: "#39ff14",
    frogEye: "#00fff7",
    frogPupil: "#000000",
    hudText: "#00fff7",
    hudLife: "#39ff14",
    timerHigh: "#00ffaa",
    timerMid: "#fff700",
    timerLow: "#ff1f6b",
    glow: true,
    retroHighlight: false,
  },
};

const SKIN_ORDER = ["classic", "retro", "neon"] as const;

// ── Grid ─────────────────────────────────────────────────────────────────────
const COLS = 16;
const ROWS = 14;

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const JUMP_DURATION = 120; // ms
const ROUND_TIME_START = 15; // s
const ROUND_TIME_STEP = 1; // s menos por nivel, con mínimo
const ROUND_TIME_MIN = 6; // s

const GOAL_COUNT = 5;
const GOAL_WIDTH = 2; // celdas por boca

const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;

type Direction = "up" | "down" | "left" | "right";

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  submergeT?: number; // acumulador del ciclo de inmersión (solo turtle)
}

interface Lane {
  row: number;
  speed: number; // celdas / segundo
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
}

const CENTER_START_COL = Math.floor(COLS / 2) - 1;

// 5 bocas de 2 celdas con un hueco de 1 celda entre y alrededor (2*5 + 1*6 = 16)
const GOAL_STARTS = [1, 4, 7, 10, 13];

function goalIndexForCol(col: number): number {
  return GOAL_STARTS.findIndex(
    (start) => col >= start && col < start + GOAL_WIDTH,
  );
}

function laneEntityCount(width: number) {
  // 2-3 entidades por carril con huecos transitables
  return width >= 3 ? 2 : 3;
}

function buildRoadLane(
  row: number,
  baseSpeed: number,
  dir: 1 | -1,
  level: number,
): Lane {
  const speed = baseSpeed * Math.pow(1.15, level - 1);
  const types: Entity["type"][] = ["car", "truck"];
  const entities: Entity[] = [];
  const count = 3;
  const gap = COLS / count;
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const width = type === "truck" ? 2 + Math.floor(Math.random() * 2) : 1;
    entities.push({
      col: Math.floor(i * gap + Math.random() * (gap - width - 1)),
      width,
      type,
    });
  }
  return { row, speed, dir, entities };
}

function buildRiverLane(
  row: number,
  baseSpeed: number,
  dir: 1 | -1,
  level: number,
): Lane {
  const speed = baseSpeed * Math.pow(1.15, level - 1);
  const isTurtleLane = row % 2 === 0;
  const entities: Entity[] = [];
  const count = laneEntityCount(3);
  const gap = COLS / count;
  for (let i = 0; i < count; i++) {
    if (isTurtleLane) {
      const groupSize = 2 + Math.floor(Math.random() * 2); // 2-3
      entities.push({
        col: Math.floor(i * gap + Math.random() * (gap - groupSize - 1)),
        width: groupSize,
        type: "turtle",
        submerged: false,
        submergeT: Math.random() * (TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS),
      });
    } else {
      const width = 2 + Math.floor(Math.random() * 3); // 2-4
      entities.push({
        col: Math.floor(i * gap + Math.random() * (gap - width - 1)),
        width,
        type: "log",
      });
    }
  }
  return { row, speed, dir, entities };
}

function buildLanes(level: number): Lane[] {
  const lanes: Lane[] = [];

  // Carriles de carretera: filas ROW_ROAD_TOP..ROW_ROAD_BOT (8-12), sentidos alternos
  let dir: 1 | -1 = 1;
  for (let row = ROW_ROAD_TOP; row <= ROW_ROAD_BOT; row++) {
    const baseSpeed = 1.5 + Math.random() * 2.5; // 1.5-4
    lanes.push(buildRoadLane(row, baseSpeed, dir, level));
    dir = dir === 1 ? -1 : 1;
  }

  // Carriles de río: filas ROW_RIVER_TOP..ROW_RIVER_BOT (1-6), sentidos alternos
  dir = -1;
  for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
    const baseSpeed = 1 + Math.random() * 2; // 1-3
    lanes.push(buildRiverLane(row, baseSpeed, dir, level));
    dir = dir === 1 ? -1 : 1;
  }

  return lanes;
}

export default function Frogger({
  paused,
  resetSignal,
  endSignal,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  skinKey = "classic",
}: FroggerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skinRef = useRef<Skin>(SKINS[skinKey ?? "classic"] ?? SKINS.classic);

  useEffect(() => {
    skinRef.current = SKINS[skinKey ?? "classic"] ?? SKINS.classic;
  }, [skinKey]);

  const pausedRef = useRef(paused);
  const onScoreChangeRef = useRef(onScoreChange);
  const onLivesChangeRef = useRef(onLivesChange);
  const onLevelChangeRef = useRef(onLevelChange);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
    onScoreChangeRef.current = onScoreChange;
    onLivesChangeRef.current = onLivesChange;
    onLevelChangeRef.current = onLevelChange;
    onGameOverRef.current = onGameOver;
  });

  const apiRef = useRef<{
    reset: () => void;
    forceGameOver: () => void;
  } | null>(null);
  const resetSignalRef = useRef(resetSignal);
  const endSignalRef = useRef(endSignal);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lanes: Lane[];
    let frog: Frog;
    let goals: boolean[];
    let pendingDir: Direction | null;
    let score: number;
    let lives: number;
    let level: number;
    let roundTime: number; // segundos restantes
    let minRowReached: number;
    let gameOver: boolean;

    let lastScore = -1;
    let lastLives = -1;
    let lastLevel = -1;
    let gameOverNotified = false;

    const roundTimeForLevel = (lvl: number) =>
      Math.max(ROUND_TIME_MIN, ROUND_TIME_START - (lvl - 1) * ROUND_TIME_STEP);

    function resetFrogPosition() {
      frog = {
        col: CENTER_START_COL,
        row: ROW_START,
        animating: false,
        animT: 0,
        fromCol: CENTER_START_COL,
        fromRow: ROW_START,
        targetCol: CENTER_START_COL,
        targetRow: ROW_START,
      };
    }

    function initRound(lvl: number) {
      lanes = buildLanes(lvl);
      goals = new Array(GOAL_COUNT).fill(false);
      roundTime = roundTimeForLevel(lvl);
      minRowReached = ROW_START;
    }

    function initGame() {
      score = 0;
      lives = 3;
      level = 1;
      gameOver = false;
      pendingDir = null;
      initRound(level);
      resetFrogPosition();
    }

    function forceGameOver() {
      if (gameOver) return;
      lives = 0;
      gameOver = true;
    }

    apiRef.current = {
      reset: () => {
        initGame();
        gameOverNotified = false;
        lastScore = -1;
        lastLives = -1;
        lastLevel = -1;
        notify();
      },
      forceGameOver,
    };

    function notify() {
      if (score !== lastScore) {
        lastScore = score;
        onScoreChangeRef.current(score);
      }
      if (lives !== lastLives) {
        lastLives = lives;
        onLivesChangeRef.current(lives);
      }
      if (level !== lastLevel) {
        lastLevel = level;
        onLevelChangeRef.current(level);
      }
      if (gameOver && !gameOverNotified) {
        gameOverNotified = true;
        onGameOverRef.current();
      }
    }

    // ── Colisiones y soporte ───────────────────────────────────────────────
    function checkRoadCollision(): boolean {
      for (const lane of lanes) {
        if (lane.row !== frog.row) continue;
        if (lane.row < ROW_ROAD_TOP || lane.row > ROW_ROAD_BOT) continue;
        for (const e of lane.entities) {
          if (frog.col >= e.col && frog.col < e.col + e.width) return true;
        }
      }
      return false;
    }

    function getSupport(): { lane: Lane; entity: Entity } | null {
      for (const lane of lanes) {
        if (lane.row !== frog.row) continue;
        if (lane.row < ROW_RIVER_TOP || lane.row > ROW_RIVER_BOT) continue;
        for (const e of lane.entities) {
          if (frog.col >= e.col && frog.col < e.col + e.width) {
            if (e.type === "turtle" && e.submerged) return null;
            return { lane, entity: e };
          }
        }
      }
      return null;
    }

    // true = muerte (boca ocupada o hueco), false = boca libre ocupada con éxito
    function checkGoal(): boolean {
      const idx = goalIndexForCol(frog.col);
      if (idx === -1 || goals[idx]) return true;
      goals[idx] = true;
      score += 50 + Math.round(roundTime) * 10;
      return false;
    }

    function awardAdvance() {
      if (frog.row < minRowReached) {
        score += 10 * (minRowReached - frog.row);
        minRowReached = frog.row;
      }
    }

    function killFrog() {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameOver = true;
        return;
      }
      resetFrogPosition();
      roundTime = roundTimeForLevel(level);
    }

    function completeRound() {
      score += 200;
      level++;
      initRound(level);
      resetFrogPosition();
    }

    function resolveLanding() {
      if (frog.row === ROW_GOALS) {
        if (checkGoal()) killFrog();
        else if (goals.every(Boolean)) completeRound();
        return;
      }
      if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
        if (checkRoadCollision()) killFrog();
        return;
      }
      if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
        if (!getSupport()) killFrog();
      }
    }

    // ── Update ───────────────────────────────────────────────────────────────
    function moveLanes(dt: number) {
      for (const lane of lanes) {
        for (const e of lane.entities) {
          e.col += (lane.speed * lane.dir * dt) / 1000;
          if (lane.dir === 1 && e.col > COLS) e.col = -e.width;
          if (lane.dir === -1 && e.col < -e.width) e.col = COLS;
          if (e.type === "turtle") {
            e.submergeT = (e.submergeT ?? 0) + dt;
            const period = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
            const phase = e.submergeT % period;
            e.submerged = phase >= TURTLE_VISIBLE_MS;
          }
        }
      }
    }

    function startJump(dir: Direction) {
      let targetCol = frog.col;
      let targetRow = frog.row;
      if (dir === "up") targetRow -= 1;
      if (dir === "down") targetRow += 1;
      if (dir === "left") targetCol -= 1;
      if (dir === "right") targetCol += 1;
      if (targetCol < 0 || targetCol >= COLS) return;
      if (targetRow < ROW_GOALS || targetRow > ROW_START) return;
      frog.animating = true;
      frog.animT = 0;
      frog.fromCol = frog.col;
      frog.fromRow = frog.row;
      frog.targetCol = targetCol;
      frog.targetRow = targetRow;
    }

    function update(dt: number) {
      moveLanes(dt);

      if (!frog.animating && pendingDir) {
        startJump(pendingDir);
        pendingDir = null;
      }

      if (frog.animating) {
        frog.animT += dt;
        if (frog.animT >= JUMP_DURATION) {
          frog.animating = false;
          frog.col = frog.targetCol;
          frog.row = frog.targetRow;
          awardAdvance();
          resolveLanding();
        }
      } else if (
        !gameOver &&
        frog.row >= ROW_RIVER_TOP &&
        frog.row <= ROW_RIVER_BOT
      ) {
        const support = getSupport();
        if (!support) {
          killFrog();
        } else {
          frog.col += (support.lane.speed * support.lane.dir * dt) / 1000;
          if (frog.col < 0 || frog.col >= COLS) {
            killFrog();
          }
        }
      }

      if (!gameOver) {
        roundTime -= dt / 1000;
        if (roundTime <= 0) {
          roundTime = 0;
          killFrog();
        }
      }
    }

    // ── Dibujo ───────────────────────────────────────────────────────────────
    const boardLayout = () => {
      const block = Math.floor(
        Math.min(canvas.width / COLS, canvas.height / ROWS),
      );
      return {
        block,
        offsetX: (canvas.width - block * COLS) / 2,
        offsetY: (canvas.height - block * ROWS) / 2,
      };
    };

    const zoneColor = (row: number) => {
      const skin = skinRef.current;
      if (row === ROW_GOALS) return skin.goalZone;
      if (row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT) return skin.riverZone;
      if (row === ROW_SAFE_MID || row === ROW_START) return skin.safeZone;
      return skin.roadZone;
    };

    const drawBackground = (
      block: number,
      offsetX: number,
      offsetY: number,
    ) => {
      const skin = skinRef.current;
      for (let r = 0; r < ROWS; r++) {
        ctx.fillStyle = zoneColor(r);
        ctx.fillRect(offsetX, offsetY + r * block, COLS * block, block);
      }
      // Bocas destino
      for (let i = 0; i < GOAL_STARTS.length; i++) {
        const start = GOAL_STARTS[i];
        ctx.fillStyle = goals[i] ? skin.goalFullFill : skin.goalEmptyFill;
        if (skin.glow) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = skin.goalOutline;
        }
        ctx.fillRect(
          offsetX + start * block,
          offsetY,
          GOAL_WIDTH * block,
          block,
        );
        ctx.shadowBlur = 0;
        ctx.strokeStyle = skin.goalOutline;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          offsetX + start * block + 1,
          offsetY + 1,
          GOAL_WIDTH * block - 2,
          block - 2,
        );
        if (skin.retroHighlight) {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(
            offsetX + start * block + 1,
            offsetY + 1,
            GOAL_WIDTH * block - 2,
            4,
          );
        }
        if (goals[i]) {
          ctx.fillStyle = skin.goalFlag;
          ctx.beginPath();
          ctx.ellipse(
            offsetX + (start + GOAL_WIDTH / 2) * block,
            offsetY + block / 2,
            block * 0.3,
            block * 0.26,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    };

    const drawEntities = (block: number, offsetX: number, offsetY: number) => {
      const skin = skinRef.current;
      for (const lane of lanes) {
        for (const e of lane.entities) {
          const x = offsetX + e.col * block;
          const y = offsetY + lane.row * block;
          const w = e.width * block;

          if (skin.glow) {
            ctx.shadowBlur = 12;
            ctx.shadowColor =
              e.type === "car"
                ? skin.carFill
                : e.type === "truck"
                  ? skin.truckFill
                  : e.type === "log"
                    ? skin.logFill
                    : skin.turtleFill;
          }

          if (e.type === "car") {
            ctx.fillStyle = skin.carFill;
            ctx.fillRect(x + 2, y + 6, w - 4, block - 12);
            if (skin.retroHighlight) {
              ctx.fillStyle = "rgba(255,255,255,0.25)";
              ctx.fillRect(x + 2, y + 6, w - 4, 4);
            }
            ctx.shadowBlur = 0;
            ctx.fillStyle = skin.carWheel;
            ctx.beginPath();
            ctx.arc(x + 6, y + block - 8, 4, 0, Math.PI * 2);
            ctx.arc(x + w - 6, y + block - 8, 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (e.type === "truck") {
            ctx.fillStyle = skin.truckFill;
            ctx.fillRect(x + 2, y + 4, w - 4, block - 10);
            if (skin.retroHighlight) {
              ctx.fillStyle = "rgba(255,255,255,0.25)";
              ctx.fillRect(x + 2, y + 4, w - 4, 4);
            }
            ctx.shadowBlur = 0;
            ctx.fillStyle = skin.truckCab;
            ctx.fillRect(x + 2, y + 4, block * 0.5, block - 10);
          } else if (e.type === "log") {
            ctx.fillStyle = skin.logFill;
            ctx.fillRect(x + 1, y + 8, w - 2, block - 18);
            if (skin.retroHighlight) {
              ctx.fillStyle = "rgba(255,255,255,0.2)";
              ctx.fillRect(x + 1, y + 8, w - 2, 4);
            }
            ctx.shadowBlur = 0;
            ctx.strokeStyle = skin.logGrain;
            for (let lx = x + 6; lx < x + w - 4; lx += 10) {
              ctx.beginPath();
              ctx.moveTo(lx, y + 8);
              ctx.lineTo(lx, y + block - 10);
              ctx.stroke();
            }
          } else {
            // turtle
            ctx.globalAlpha = e.submerged ? 0.35 : 1;
            ctx.fillStyle = skin.turtleFill;
            for (let t = 0; t < Math.round(e.width); t++) {
              ctx.beginPath();
              ctx.arc(
                x + (t + 0.5) * block,
                y + block / 2,
                block * 0.32,
                0,
                Math.PI * 2,
              );
              if (e.submerged) ctx.stroke();
              else ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
          }
        }
      }
    };

    const drawFrog = (block: number, offsetX: number, offsetY: number) => {
      const skin = skinRef.current;
      const t = frog.animating ? Math.min(1, frog.animT / JUMP_DURATION) : 1;
      const col = frog.animating
        ? frog.fromCol + (frog.targetCol - frog.fromCol) * t
        : frog.col;
      const row = frog.animating
        ? frog.fromRow + (frog.targetRow - frog.fromRow) * t
        : frog.row;
      const cx = offsetX + (col + 0.5) * block;
      const cy = offsetY + (row + 0.5) * block;
      const jump = frog.animating ? Math.sin(t * Math.PI) * block * 0.25 : 0;

      if (skin.glow) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = skin.frogBody;
      }
      ctx.fillStyle = skin.frogBody;
      ctx.beginPath();
      ctx.ellipse(cx, cy - jump, block * 0.34, block * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = skin.frogEye;
      ctx.beginPath();
      ctx.arc(cx - 7, cy - jump - 6, 4, 0, Math.PI * 2);
      ctx.arc(cx + 7, cy - jump - 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin.frogPupil;
      ctx.beginPath();
      ctx.arc(cx - 7, cy - jump - 6, 1.6, 0, Math.PI * 2);
      ctx.arc(cx + 7, cy - jump - 6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawHud = (block: number, offsetX: number, offsetY: number) => {
      const skin = skinRef.current;
      ctx.fillStyle = skin.hudText;
      ctx.font = "16px monospace";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(String(score), offsetX + 6, offsetY + 4);
      ctx.textAlign = "center";
      ctx.fillText(`NIVEL ${level}`, offsetX + (COLS * block) / 2, offsetY + 4);
      ctx.textAlign = "right";
      ctx.fillStyle = skin.hudLife;
      for (let i = 0; i < lives; i++) {
        ctx.beginPath();
        ctx.arc(
          offsetX + COLS * block - 10 - i * 16,
          offsetY + 14,
          6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      const barW = COLS * block;
      const ratio = Math.max(0, roundTime / roundTimeForLevel(level));
      ctx.fillStyle =
        ratio > 0.5
          ? skin.timerHigh
          : ratio > 0.25
            ? skin.timerMid
            : skin.timerLow;
      ctx.fillRect(offsetX, offsetY, barW * ratio, 4);
    };

    const draw = () => {
      const skin = skinRef.current;
      ctx.fillStyle = skin.boardBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { block, offsetX, offsetY } = boardLayout();
      drawBackground(block, offsetX, offsetY);
      drawEntities(block, offsetX, offsetY);
      drawFrog(block, offsetX, offsetY);
      drawHud(block, offsetX, offsetY);
    };

    // ── Controles ───────────────────────────────────────────────────────────
    const KEY_DIR: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.code];
      if (!dir) return;
      e.preventDefault();
      if (pausedRef.current || gameOver) return;
      pendingDir = dir;
    };
    window.addEventListener("keydown", handleKeyDown);

    // ── Resize ──────────────────────────────────────────────────────────────
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    let resizeObserver: ResizeObserver | null = null;
    if (canvas.parentElement) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas.parentElement);
    }

    // ── Loop ────────────────────────────────────────────────────────────────
    initGame();
    notify();

    let raf = 0;
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);

      if (!pausedRef.current && !gameOver) {
        const dt = lastTime === null ? 0 : ts - lastTime;
        lastTime = ts;
        update(dt);
        notify();
      } else {
        lastTime = null;
      }

      draw();
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", handleKeyDown);
      resizeObserver?.disconnect();
      apiRef.current = null;
    };
  }, []);

  // Reinicia el motor cuando resetSignal cambia (omite el valor inicial)
  useEffect(() => {
    if (resetSignalRef.current === resetSignal) return;
    resetSignalRef.current = resetSignal;
    apiRef.current?.reset();
  }, [resetSignal]);

  // Fuerza game over cuando endSignal cambia (omite el valor inicial)
  useEffect(() => {
    if (endSignalRef.current === endSignal) return;
    endSignalRef.current = endSignal;
    apiRef.current?.forceGameOver();
  }, [endSignal]);

  const [activeSkin, setActiveSkin] = useState(skinKey ?? "classic");

  useEffect(() => {
    setActiveSkin(skinKey ?? "classic");
  }, [skinKey]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          gap: 4,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(245,255,0,0.35)",
          padding: 4,
        }}
      >
        {SKIN_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveSkin(key);
              skinRef.current = SKINS[key];
            }}
            className="pixel"
            style={{
              fontSize: 8,
              padding: "4px 6px",
              cursor: "pointer",
              background: activeSkin === key ? "var(--yellow)" : "transparent",
              color: activeSkin === key ? "#000" : "var(--yellow)",
              border: "1px solid var(--yellow)",
            }}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
