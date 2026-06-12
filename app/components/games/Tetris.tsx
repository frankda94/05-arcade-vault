"use client";

import { useEffect, useRef } from "react";

export interface TetrisProps {
  paused: boolean; // true = el loop interno no actualiza ni dibuja nuevos frames
  resetSignal: number; // al incrementarse, reinicia el tablero desde cero
  endSignal: number; // al incrementarse, fuerza game over inmediato (botón FIN)
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void; // sustituye a "vidas" en el HUD
  onLevelChange: (level: number) => void; // floor(lines/10)+1, igual que el original
  onTogglePause: () => void; // se dispara al pulsar "P" dentro del canvas
  onGameOver: () => void; // se dispara al no poder spawnear la siguiente pieza
}

// ── Tablero ──────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - púrpura
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#90caf9", // J - azul pálido
  "#ffb74d", // L - naranja
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  // [
  //   [8, 8, 8],
  //   [8, 0, 8],
  //   [8, 8, 8],
  // ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const CONTROL_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "Space",
  "KeyX",
  "KeyP",
]);

interface Piece {
  shape: number[][];
  x: number;
  y: number;
}

export default function Tetris({
  paused,
  resetSignal,
  endSignal,
  onScoreChange,
  onLinesChange,
  onLevelChange,
  onTogglePause,
  onGameOver,
}: TetrisProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);

  const pausedRef = useRef(paused);
  const onScoreChangeRef = useRef(onScoreChange);
  const onLinesChangeRef = useRef(onLinesChange);
  const onLevelChangeRef = useRef(onLevelChange);
  const onTogglePauseRef = useRef(onTogglePause);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
    onScoreChangeRef.current = onScoreChange;
    onLinesChangeRef.current = onLinesChange;
    onLevelChangeRef.current = onLevelChange;
    onTogglePauseRef.current = onTogglePause;
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
    const nextCanvas = nextCanvasRef.current;
    if (!canvas || !nextCanvas) return;
    const ctx = canvas.getContext("2d");
    const nextCtx = nextCanvas.getContext("2d");
    if (!ctx || !nextCtx) return;

    let board: number[][];
    let current: Piece;
    let next: Piece;
    let score: number;
    let lines: number;
    let level: number;
    let dropInterval: number;
    let dropAccum: number;
    let gameOver: boolean;

    let lastScore = -1;
    let lastLines = -1;
    let lastLevel = -1;
    let gameOverNotified = false;

    function createBoard(): number[][] {
      return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    }

    function randomPiece(): Piece {
      const type = Math.floor(Math.random() * 7) + 1;
      const shape = PIECES[type]!.map((row) => [...row]);
      return {
        shape,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0,
      };
    }

    function collide(shape: number[][], ox: number, oy: number): boolean {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const nx = ox + c;
          const ny = oy + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && board[ny][nx]) return true;
        }
      }
      return false;
    }

    function rotateCW(shape: number[][]): number[][] {
      const rows = shape.length;
      const cols = shape[0].length;
      const result = Array.from({ length: cols }, () =>
        new Array(rows).fill(0),
      );
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
      return result;
    }

    function tryRotate() {
      const rotated = rotateCW(current.shape);
      const kicks = [0, -1, 1, -2, 2];
      for (const kick of kicks) {
        if (!collide(rotated, current.x + kick, current.y)) {
          current.shape = rotated;
          current.x += kick;
          return;
        }
      }
    }

    function merge() {
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            board[current.y + r][current.x + c] = current.shape[r][c];
    }

    function clearLines() {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every((v) => v !== 0)) {
          board.splice(r, 1);
          board.unshift(new Array(COLS).fill(0));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        lines += cleared;
        score += (LINE_SCORES[cleared] || 0) * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      }
    }

    function ghostY(): number {
      let gy = current.y;
      while (!collide(current.shape, current.x, gy + 1)) gy++;
      return gy;
    }

    function spawn() {
      current = next;
      next = randomPiece();
      if (collide(current.shape, current.x, current.y)) {
        gameOver = true;
      }
    }

    function lockPiece() {
      merge();
      clearLines();
      spawn();
    }

    function hardDrop() {
      const gy = ghostY();
      score += (gy - current.y) * 2;
      current.y = gy;
      lockPiece();
    }

    function softDrop() {
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
        score += 1;
      } else {
        lockPiece();
      }
    }

    function initGame() {
      board = createBoard();
      score = 0;
      lines = 0;
      level = 1;
      dropInterval = 1000;
      dropAccum = 0;
      gameOver = false;
      next = randomPiece();
      spawn();
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
        lastLines = -1;
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
      if (lines !== lastLines) {
        lastLines = lines;
        onLinesChangeRef.current(lines);
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

    // ── Dibujo ─────────────────────────────────────────────────────────────────
    const drawBlock = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      colorIndex: number,
      size: number,
      offsetX: number,
      offsetY: number,
      alpha?: number,
    ) => {
      if (!colorIndex) return;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = COLORS[colorIndex]!;
      context.fillRect(
        offsetX + x * size + 1,
        offsetY + y * size + 1,
        size - 2,
        size - 2,
      );
      context.fillStyle = "rgba(255,255,255,0.12)";
      context.fillRect(
        offsetX + x * size + 1,
        offsetY + y * size + 1,
        size - 2,
        4,
      );
      context.globalAlpha = 1;
    };

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

      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          drawBlock(ctx, c, r, board[r][c], block, offsetX, offsetY);

      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(
              ctx,
              current.x + c,
              gy + r,
              current.shape[r][c],
              block,
              offsetX,
              offsetY,
              0.2,
            );

      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(
              ctx,
              current.x + c,
              current.y + r,
              current.shape[r][c],
              block,
              offsetX,
              offsetY,
            );
    };

    const drawNext = () => {
      nextCtx.fillStyle = "#000";
      nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
      const shape = next.shape;
      const nb = Math.floor(Math.min(nextCanvas.width, nextCanvas.height) / 4);
      const offX = (nextCanvas.width - shape[0].length * nb) / 2;
      const offY = (nextCanvas.height - shape.length * nb) / 2;
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          drawBlock(nextCtx, c, r, shape[r][c], nb, offX, offY);
    };

    // ── Controles ─────────────────────────────────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!CONTROL_KEYS.has(e.code)) return;
      e.preventDefault();

      if (e.code === "KeyP") {
        if (!e.repeat) onTogglePauseRef.current();
        return;
      }

      if (pausedRef.current || gameOver) return;

      switch (e.code) {
        case "ArrowLeft":
          if (!collide(current.shape, current.x - 1, current.y)) current.x--;
          break;
        case "ArrowRight":
          if (!collide(current.shape, current.x + 1, current.y)) current.x++;
          break;
        case "ArrowDown":
          softDrop();
          break;
        case "ArrowUp":
        case "KeyX":
          tryRotate();
          break;
        case "Space":
          hardDrop();
          break;
      }
      notify();
    };
    window.addEventListener("keydown", handleKeyDown);

    // ── Resize ────────────────────────────────────────────────────────────────
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

    // ── Loop ──────────────────────────────────────────────────────────────────
    initGame();
    notify();

    let raf = 0;
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);

      if (!pausedRef.current && !gameOver) {
        const dt = lastTime === null ? 0 : ts - lastTime;
        lastTime = ts;
        dropAccum += dt;
        if (dropAccum >= dropInterval) {
          dropAccum = 0;
          if (!collide(current.shape, current.x, current.y + 1)) {
            current.y++;
          } else {
            lockPiece();
          }
          notify();
        }
      } else {
        lastTime = null;
      }

      draw();
      drawNext();
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
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(245,255,0,0.35)",
          padding: 4,
        }}
      >
        <div
          className="pixel"
          style={{
            fontSize: 8,
            color: "var(--yellow)",
            textAlign: "center",
            marginBottom: 2,
          }}
        >
          SIGUIENTE
        </div>
        <canvas
          ref={nextCanvasRef}
          width={80}
          height={80}
          style={{ display: "block", width: 80, height: 80 }}
        />
      </div>
    </div>
  );
}
