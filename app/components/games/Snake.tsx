"use client";

import { useEffect, useRef } from "react";

export interface SnakeProps {
  paused: boolean; // true = el loop interno no actualiza ni dibuja nuevos frames
  resetSignal: number; // al incrementarse, reinicia la serpiente desde cero
  endSignal: number; // al incrementarse, fuerza game over inmediato (botón FIN)
  onScoreChange: (score: number) => void;
  onLengthChange: (length: number) => void; // sustituye a "Vidas" en el HUD
  onLevelChange: (level: number) => void; // floor(frutas/5)+1
  onGameOver: () => void; // se dispara al chocar con borde o con su propia cola
}

// ── Grid ─────────────────────────────────────────────────────────────────────
const COLS = 24;
const ROWS = 18;

const MOVE_INTERVAL_MIN = 60;
const MOVE_INTERVAL_START = 150;
const MOVE_INTERVAL_STEP = 15;

// Atlas de frutas — coordenadas portadas de references/source-assets/snake-assets/sprites.js
// (SPRITE_ATLAS.fruits, fila y=136–295 de fruits.png, 3790x442px)
const FRUITS: { x: number; y: number; w: number; h: number }[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  { x: 378, y: 136, w: 110, h: 160 }, // grape
  { x: 540, y: 136, w: 130, h: 160 }, // garlic
  { x: 712, y: 136, w: 130, h: 160 }, // eggplant
  { x: 894, y: 136, w: 110, h: 160 }, // strawberry
  { x: 1066, y: 136, w: 110, h: 160 }, // cherry
  { x: 1228, y: 136, w: 130, h: 160 }, // carrot
  { x: 1400, y: 136, w: 130, h: 160 }, // mushroom
  { x: 1582, y: 136, w: 110, h: 160 }, // broccoli
  { x: 1734, y: 136, w: 150, h: 160 }, // watermelon
  { x: 1906, y: 136, w: 150, h: 160 }, // pepper
  { x: 2068, y: 136, w: 170, h: 160 }, // kiwi
  { x: 2250, y: 136, w: 140, h: 160 }, // lemon
  { x: 2432, y: 136, w: 130, h: 160 }, // peach
  { x: 2604, y: 136, w: 130, h: 160 }, // peanut
  { x: 2786, y: 136, w: 110, h: 160 }, // apple
  { x: 2948, y: 136, w: 130, h: 160 }, // tomato
  { x: 3110, y: 136, w: 150, h: 160 }, // berries
  { x: 3302, y: 136, w: 110, h: 160 }, // grapes2
  { x: 3454, y: 136, w: 150, h: 160 }, // pineapple
  { x: 3637, y: 136, w: 130, h: 160 }, // melon
];

const CONTROL_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

interface Vec {
  x: number;
  y: number;
}

const DIRS: Record<string, Vec> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export default function Snake({
  paused,
  resetSignal,
  endSignal,
  onScoreChange,
  onLengthChange,
  onLevelChange,
  onGameOver,
}: SnakeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pausedRef = useRef(paused);
  const onScoreChangeRef = useRef(onScoreChange);
  const onLengthChangeRef = useRef(onLengthChange);
  const onLevelChangeRef = useRef(onLevelChange);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
    onScoreChangeRef.current = onScoreChange;
    onLengthChangeRef.current = onLengthChange;
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

    let snake: Vec[];
    let dir: Vec;
    let pendingDir: Vec;
    let food: Vec;
    let foodSprite: number;
    let score: number;
    let level: number;
    let fruitsEaten: number;
    let moveInterval: number;
    let moveAccum: number;
    let gameOver: boolean;

    let lastScore = -1;
    let lastLength = -1;
    let lastLevel = -1;
    let gameOverNotified = false;

    const fruitImg = new Image();
    let fruitImgLoaded = false;
    fruitImg.onload = () => {
      fruitImgLoaded = true;
    };
    fruitImg.src = "/snake-assets/fruits.png";

    function randomFreeCell(): Vec {
      let cell: Vec;
      do {
        cell = {
          x: Math.floor(Math.random() * COLS),
          y: Math.floor(Math.random() * ROWS),
        };
      } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
      return cell;
    }

    function spawnFood() {
      food = randomFreeCell();
      foodSprite = Math.floor(Math.random() * FRUITS.length);
    }

    function initGame() {
      const startY = Math.floor(ROWS / 2);
      const startX = Math.floor(COLS / 2);
      snake = [
        { x: startX + 1, y: startY },
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
      ];
      dir = { x: 1, y: 0 };
      pendingDir = dir;
      score = 0;
      level = 1;
      fruitsEaten = 0;
      moveInterval = MOVE_INTERVAL_START;
      moveAccum = 0;
      gameOver = false;
      spawnFood();
    }

    function forceGameOver() {
      if (gameOver) return;
      gameOver = true;
    }

    apiRef.current = {
      reset: () => {
        initGame();
        gameOverNotified = false;
        lastScore = -1;
        lastLength = -1;
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
      if (snake.length !== lastLength) {
        lastLength = snake.length;
        onLengthChangeRef.current(snake.length);
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

    function step() {
      // Ignora giros de 180° instantáneos sobre sí misma
      if (
        !(pendingDir.x === -dir.x && pendingDir.y === -dir.y) ||
        snake.length === 1
      ) {
        dir = pendingDir;
      }

      const head = snake[0];
      const newHead: Vec = { x: head.x + dir.x, y: head.y + dir.y };

      if (
        newHead.x < 0 ||
        newHead.x >= COLS ||
        newHead.y < 0 ||
        newHead.y >= ROWS ||
        snake.some((s) => s.x === newHead.x && s.y === newHead.y)
      ) {
        gameOver = true;
        return;
      }

      snake.unshift(newHead);

      if (newHead.x === food.x && newHead.y === food.y) {
        score += 10 * level;
        fruitsEaten++;
        if (fruitsEaten % 5 === 0) {
          level++;
          moveInterval = Math.max(
            MOVE_INTERVAL_MIN,
            MOVE_INTERVAL_START - (level - 1) * MOVE_INTERVAL_STEP,
          );
        }
        spawnFood();
      } else {
        snake.pop();
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

    const drawGrid = (block: number, offsetX: number, offsetY: number) => {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + c * block, offsetY);
        ctx.lineTo(offsetX + c * block, offsetY + ROWS * block);
        ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + r * block);
        ctx.lineTo(offsetX + COLS * block, offsetY + r * block);
        ctx.stroke();
      }
    };

    const draw = () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { block, offsetX, offsetY } = boardLayout();

      drawGrid(block, offsetX, offsetY);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX, offsetY, block * COLS, block * ROWS);

      // Comida
      if (fruitImgLoaded) {
        const sprite = FRUITS[foodSprite];
        ctx.drawImage(
          fruitImg,
          sprite.x,
          sprite.y,
          sprite.w,
          sprite.h,
          offsetX + food.x * block,
          offsetY + food.y * block,
          block,
          block,
        );
      } else {
        ctx.fillStyle = "#ff006e";
        ctx.fillRect(
          offsetX + food.x * block + 1,
          offsetY + food.y * block + 1,
          block - 2,
          block - 2,
        );
      }

      // Serpiente
      for (let i = 0; i < snake.length; i++) {
        const seg = snake[i];
        ctx.fillStyle = i === 0 ? "#00f5ff" : "#ff006e";
        ctx.globalAlpha = i === 0 ? 1 : 0.9;
        ctx.fillRect(
          offsetX + seg.x * block + 1,
          offsetY + seg.y * block + 1,
          block - 2,
          block - 2,
        );
        ctx.globalAlpha = 1;
      }
    };

    // ── Controles ───────────────────────────────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!CONTROL_KEYS.has(e.code)) return;
      e.preventDefault();
      if (pausedRef.current || gameOver) return;
      pendingDir = DIRS[e.code];
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
        moveAccum += dt;
        if (moveAccum >= moveInterval) {
          moveAccum = 0;
          step();
          notify();
        }
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

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
