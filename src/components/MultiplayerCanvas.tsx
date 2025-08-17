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
  overallWinner: "X" | "O" | null; // <-- add this
  youAre?: "X" | "O";
};

// fallback winner calc from winnerBoards
function calcBigWinner(winners: Mark[]): Mark {
  const L = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of L) {
    if (winners[a] && winners[a] === winners[b] && winners[a] === winners[c]) return winners[a];
  }
  return null;
}

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
      const W = 540,
        H = 540;

      s.setup = () => {
        s.createCanvas(W, H);
        (s as any).__ready = true;
        s.noLoop();
        drawAll();
      };

      s.mousePressed = () => {
        const st = stateRef.current;
        if (!st || st.ended) return; // no clicks after game over

        const bx = Math.floor(s.mouseX / (W / 3));
        const by = Math.floor(s.mouseY / (H / 3));
        if (bx < 0 || bx > 2 || by < 0 || by > 2) return;
        const boardIndex = bx * 3 + by;

        const cx = Math.floor((s.mouseX - bx * (W / 3)) / (W / 9));
        const cy = Math.floor((s.mouseY - by * (H / 3)) / (H / 9));
        const cellIndex = cx * 3 + cy;

        onCellClick(boardIndex, cellIndex);
      };

      function drawAll() {
        // instance may be gone
        if (!(s as any).__ready || !(s as any)._renderer) return;

        const st = stateRef.current;
        const bigSize = W / 3;
        const cellSize = bigSize / 3;

        s.background(255);

        // draw 9 mini-boards
        for (let bi = 0; bi < 9; bi++) {
          const gx = Math.floor(bi / 3);
          const gy = bi % 3;
          const ox = gx * bigSize;
          const oy = gy * bigSize;

          // board bg
          s.noStroke();
          s.fill(245);
          s.rect(ox, oy, bigSize, bigSize, 6);

          // inner grid
          s.stroke(160);
          for (let i = 1; i < 3; i++) {
            s.line(ox + i * cellSize, oy, ox + i * cellSize, oy + bigSize);
            s.line(ox, oy + i * cellSize, ox + bigSize, oy + i * cellSize);
          }

          // marks
          s.textAlign(s.CENTER, s.CENTER);
          s.textSize(28);
          s.fill(12);
          for (let ci = 0; ci < 9; ci++) {
            const cx = Math.floor(ci / 3);
            const cy = ci % 3;
            const m = st.boards[bi][ci];
            if (m) s.text(m, ox + cx * cellSize + cellSize / 2, oy + cy * cellSize + cellSize / 2);
          }

          // overlay for a won mini-board
          if (st.winnerBoards[bi]) {
            s.noStroke();
            s.fill(255, 255, 255, 140);
            s.rect(ox, oy, bigSize, bigSize, 6);
            s.fill(12);
            s.textSize(48);
            s.text(st.winnerBoards[bi]!, ox + bigSize / 2, oy + bigSize / 2 + 10);
          }
        }

        // outer grid
        s.strokeWeight(2);
        s.stroke(120);
        for (let i = 1; i < 3; i++) {
          s.line(i * bigSize, 0, i * bigSize, H);
          s.line(0, i * bigSize, W, i * bigSize);
        }
        s.strokeWeight(1);

        // active board highlight (if any)
        if (!st.ended) {
          s.noFill();
          s.stroke(94, 118, 255);
          s.strokeWeight(3);
          if (st.currentBoard === null) {
            s.rect(3, 3, W - 6, H - 6, 8);
          } else {
            const gx = Math.floor(st.currentBoard / 3);
            const gy = st.currentBoard % 3;
            s.rect(gx * bigSize + 4, gy * bigSize + 4, bigSize - 8, bigSize - 8, 8);
          }
          s.strokeWeight(1);
        }

        // ---------- winner overlay ----------
        if (st.ended) {
          // prefer server-provided winner; otherwise try to compute
          const winner = (st as any).overallWinner ?? calcBigWinner(st.winnerBoards);

          // dim the board
          s.noStroke();
          s.fill(0, 0, 0, 160);
          s.rect(0, 0, W, H);

          // winner text
          s.fill(255);
          s.textAlign(s.CENTER, s.CENTER);
          s.textSize(36);
          const line = winner ? `Player ${winner} wins!` : "Game Over";
          s.text(line, W / 2, H / 2);

          // small hint
          s.textSize(14);
          s.fill(230);
          s.text("Refresh or leave lobby to start a new match", W / 2, H / 2 + 36);
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
          (p5Ref.current as any).__ready = false;
          p5Ref.current.remove();
          p5Ref.current = null;
        }
      } catch { }
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  // redraw whenever state changes
  useEffect(() => {
    const inst: any = p5Ref.current;
    if (inst && inst.__ready && inst.__redrawAll) {
      inst.__redrawAll();
    }
  }, [state]);

  return <div ref={containerRef} className="mx-auto w-[540px] h-[540px] select-none" />;
}
