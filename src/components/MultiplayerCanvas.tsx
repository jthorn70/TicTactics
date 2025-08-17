"use client";
import { useEffect, useRef } from "react";
import p5 from "p5";

type Mark = "X" | "O" | null;
type GameState = {
  boards: Mark[][];
  winnerBoards: Mark[];
  currentBoard: number | null;
  currentPlayer: "X" | "O";
  ended: boolean;
  youAre?: "X" | "O";
};

export default function MultiplayerCanvas({
  state,
  onCellClick,
}: {
  state: GameState;
  onCellClick: (boardIndex: number, cellIndex: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const p5Ref = useRef<p5 | null>(null);
  const createdRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!containerRef.current) return;
    if (createdRef.current) return;

    containerRef.current.innerHTML = "";

    const sketch = (s: p5) => {
      const W = 540, H = 540;

      s.setup = () => {
        s.createCanvas(W, H);
        (s as any).__ready = true;   // mark ready
        s.noLoop();
        drawAll();
      };

      s.mousePressed = () => {
        const st = stateRef.current;
        if (!st || st.ended) return;

        const bx = Math.floor((s.mouseX / (W / 3)));
        const by = Math.floor((s.mouseY / (H / 3)));
        if (bx < 0 || bx > 2 || by < 0 || by > 2) return;
        const boardIndex = bx * 3 + by;

        const cx = Math.floor((s.mouseX - bx * (W / 3)) / (W / 9));
        const cy = Math.floor((s.mouseY - by * (H / 3)) / (H / 9));
        const cellIndex = cx * 3 + cy;

        onCellClick(boardIndex, cellIndex);
      };

      function drawAll() {
        // guard: instance might not be ready or may have been removed
        if (!(s as any).__ready || !(s as any)._renderer) return;

        const st = stateRef.current;
        const bigSize = W / 3;
        const cellSize = bigSize / 3;

        s.background(255);

        for (let bi = 0; bi < 9; bi++) {
          const gx = Math.floor(bi / 3);
          const gy = bi % 3;
          const ox = gx * bigSize;
          const oy = gy * bigSize;

          s.noStroke();
          s.fill(245);
          s.rect(ox, oy, bigSize, bigSize, 6);

          s.stroke(160);
          for (let i = 1; i < 3; i++) {
            s.line(ox + i * cellSize, oy, ox + i * cellSize, oy + bigSize);
            s.line(ox, oy + i * cellSize, ox + bigSize, oy + i * cellSize);
          }

          s.textAlign(s.CENTER, s.CENTER);
          s.textSize(28);
          s.fill(12);
          for (let ci = 0; ci < 9; ci++) {
            const cx = Math.floor(ci / 3);
            const cy = ci % 3;
            const m = st.boards[bi][ci];
            if (m) s.text(m, ox + cx * cellSize + cellSize / 2, oy + cy * cellSize + cellSize / 2);
          }

          if (st.winnerBoards[bi]) {
            s.noStroke();
            s.fill(255, 255, 255, 140);
            s.rect(ox, oy, bigSize, bigSize, 6);
            s.fill(12);
            s.textSize(48);
            s.text(st.winnerBoards[bi]!, ox + bigSize / 2, oy + bigSize / 2 + 10);
          }
        }

        s.strokeWeight(2);
        s.stroke(120);
        for (let i = 1; i < 3; i++) {
          s.line(i * bigSize, 0, i * bigSize, H);
          s.line(0, i * bigSize, W, i * bigSize);
        }
        s.strokeWeight(1);

        if (st.currentBoard === null) {
          s.noFill();
          s.stroke(94, 118, 255);
          s.strokeWeight(3);
          s.rect(3, 3, W - 6, H - 6, 8);
          s.strokeWeight(1);
        } else {
          const gx = Math.floor(st.currentBoard / 3);
          const gy = st.currentBoard % 3;
          s.noFill();
          s.stroke(94, 118, 255);
          s.strokeWeight(3);
          s.rect(gx * bigSize + 4, gy * bigSize + 4, bigSize - 8, bigSize - 8, 8);
          s.strokeWeight(1);
        }
      }

      (s as any).__redrawAll = drawAll;
    };

    const instance = new p5(sketch, containerRef.current);
    p5Ref.current = instance;
    createdRef.current = true;

    return () => {
      createdRef.current = false;
      try {
        if (p5Ref.current) {
          (p5Ref.current as any).__ready = false; // mark not-ready
          p5Ref.current.remove();
          p5Ref.current = null;
        }
      } catch {}
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  // redraw when state changes (only if instance is ready)
  useEffect(() => {
    const inst: any = p5Ref.current;
    if (inst && inst.__ready && inst.__redrawAll) {
      inst.__redrawAll();
    }
  }, [state]);

  return <div ref={containerRef} className="mx-auto w-[540px] h-[540px] select-none" />;
}
