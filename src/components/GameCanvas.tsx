"use client";

import { useEffect, useRef } from "react";

type Mark = "X" | "O" | null;

export default function GameCanvas() {
  const p5Ref = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (p5Ref.current || !containerRef.current) return;

    let p5Instance: any;

    (async () => {
      const p5mod = await import("p5");
      const P5 = p5mod.default;

      const sketch = (p: any) => {
        // ── Game state ─────────────────────────────────────────────
        let boards: Mark[][]; // 9 mini-boards, each 9 cells
        let winnerBoards: Mark[]; // winner per mini-board ('X'|'O'|null)
        let currentBoard: number | null; // active mini-board index or null = any
        let currentPlayer: Exclude<Mark, null>; // 'X' or 'O'
        let scores: Record<Exclude<Mark, null>, number>;
        let gameEnded: boolean;
        let glowStrength = 0;
        let overallWinner: Mark = null;

        // Hover helpers
        let hoverBoard: number | null = null;
        let hoverCell: number | null = null;

        // Theme helpers
        const isDark = () =>
          typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark");

        // Colors (light/dark)
        const lightBgA = "#FFFFFF"; // white
        const lightBgB = "#F3F4F6"; // gray-100
        const lightLine = "#9CA3AF"; // gray-400 (darker to pop)
        const lightText = "#111827"; // gray-900
        const darkBgA = "#1F2937"; // gray-800
        const darkBgB = "#374151"; // gray-700
        const darkLine = "#4B5563"; // gray-600
        const darkText = "#F9FAFB"; // gray-50

        p.setup = () => {
          const c = p.createCanvas(450, 450);
          if (containerRef.current) c.parent(containerRef.current);
          p.textSize(32);
          p.textAlign(p.CENTER, p.CENTER);
          initGame();
          p.loop();
        };

        p.draw = () => {
          p.background(p.color(isDark() ? darkBgA : lightBgA));

          updateHover();
          drawBoards();

          if (!gameEnded) {
            if (currentBoard !== null) {
              drawActiveEmphasis(currentBoard);
            } else {
              // play-anywhere state
              drawGlobalEmphasis();
            }
          }

          if (gameEnded && overallWinner) {
            p.fill(0, 0, 0, isDark() ? 180 : 127);
            p.rect(0, 0, p.width, p.height);
            p.fill(isDark() ? darkText : lightText);
            p.textSize(32);
            p.text(`Player ${overallWinner} wins!`, p.width / 2, p.height / 2);
          }
        };

        p.mousePressed = () => {
          if (gameEnded) {
            initGame();
            return;
          }
          if (hoverBoard === null || hoverCell === null) return;

          // Guard: if we have a locked board, you must play there unless it’s won or full
          if (
            currentBoard !== null &&
            currentBoard !== hoverBoard &&
            winnerBoards[currentBoard] === null &&
            !boardIsFull(currentBoard)
          ) {
            return;
          }

          if (!boards[hoverBoard][hoverCell] && winnerBoards[hoverBoard] === null) {
            boards[hoverBoard][hoverCell] = currentPlayer;

            const miniWinner = checkWinner(boards[hoverBoard]);
            if (miniWinner) {
              winnerBoards[hoverBoard] = miniWinner;
              scores[miniWinner]++;
              checkGameEnd();
              checkForLargeBoardWinner();
            }

            // choose next board (unlock if target is won or full)
            currentBoard =
              winnerBoards[hoverCell] === null && !boardIsFull(hoverCell)
                ? hoverCell
                : null;

            currentPlayer = currentPlayer === "X" ? "O" : "X";
          }
        };

        // ── Helpers ────────────────────────────────────────────────
        function initGame() {
          boards = Array.from({ length: 9 }, () => Array<Mark>(9).fill(null));
          winnerBoards = Array<Mark>(9).fill(null);
          currentBoard = null;
          currentPlayer = "X";
          scores = { X: 0, O: 0 };
          gameEnded = false;
          overallWinner = null;
          hoverBoard = null;
          hoverCell = null;
        }

        function updateHover() {
          if (p.mouseX < 0 || p.mouseY < 0 || p.mouseX >= p.width || p.mouseY >= p.height) {
            hoverBoard = null;
            hoverCell = null;
            return;
          }
          const b = Math.floor(p.mouseX / 150) * 3 + Math.floor(p.mouseY / 150);
          const c = (Math.floor(p.mouseX / 50) % 3) * 3 + (Math.floor(p.mouseY / 50) % 3);
          hoverBoard = b;
          hoverCell = c;
        }

        function boardIsFull(bi: number) {
          return boards[bi].every((c) => c !== null);
        }

        function drawBoards() {
          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              const x = 150 * i;
              const y = 150 * j;
              const boardIndex = i * 3 + j;

              const bg =
                (i + j) % 2 === 0
                  ? isDark() ? darkBgA : lightBgA
                  : isDark() ? darkBgB : lightBgB;

              p.noStroke();
              p.fill(p.color(bg));
              p.rect(x, y, 150, 150, 8);

              // Dim only when locked to a specific board
              const isCurrentBoardLocked =
                currentBoard !== null &&
                winnerBoards[currentBoard] === null &&
                !boardIsFull(currentBoard);

              if (!gameEnded && isCurrentBoardLocked && boardIndex !== currentBoard) {
                p.fill(isDark() ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.12)");
                p.rect(x, y, 150, 150, 8);
              }

              drawBoard(
                x,
                y,
                boards[boardIndex],
                winnerBoards[boardIndex],
                boardIndex,
                isCurrentBoardLocked
              );
            }
          }
        }

        function drawBoard(
          x: number,
          y: number,
          board: Mark[],
          winner: Mark,
          boardIndex: number,
          isCurrentBoardLocked: boolean
        ) {
          const line = isDark() ? darkLine : lightLine;
          const ink = isDark() ? darkText : lightText;

          // Grid
          p.stroke(line);
          p.noFill();
          p.strokeWeight(1.25); // slightly stronger lines

          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              const xPos = x + 50 * i;
              const yPos = y + 50 * j;
              const idx = i * 3 + j;
              const mark = board[idx];

              // Hover cell
              const canPlayHere =
                (!(currentBoard !== null && winnerBoards[currentBoard] === null && !boardIsFull(currentBoard)) ||
                  currentBoard === boardIndex) &&
                !winner &&
                !mark &&
                !gameEnded;

              if (canPlayHere && hoverBoard === boardIndex && hoverCell === idx) {
                p.noStroke();
                p.fill(isDark() ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)");
                p.rect(xPos, yPos, 50, 50, 4);
                p.stroke(line);
                p.noFill();
              }

              p.rect(xPos, yPos, 50, 50, 4);

              if (mark) {
                p.push();
                p.fill(ink);
                p.textSize(28);
                p.textStyle(p.BOLD);
                p.text(mark, xPos + 25, yPos + 25);
                p.pop();
              }
            }
          }

          // Outer border of mini-board
          p.stroke(line);
          p.strokeWeight(2.25);
          p.rect(x, y, 150, 150, 8);

          if (winner) {
            p.push();
            p.fill(isDark() ? "rgba(31,41,55,0.80)" : "rgba(255,255,255,0.85)");
            p.rect(x, y, 150, 150, 8);
            p.fill(ink);
            p.textSize(36);
            p.textStyle(p.BOLD);
            p.text(winner, x + 75, y + 82);
            p.pop();
          }
        }

        function drawActiveEmphasis(boardIndex: number) {
          glowStrength = (Math.sin(p.millis() / 500.0) * 0.5 + 0.5) * 120;
          const i = Math.floor(boardIndex / 3);
          const j = boardIndex % 3;
          const x = 150 * i;
          const y = 150 * j;

          const halo = isDark()
            ? `rgba(99,102,241,${Math.min(0.45, glowStrength / 255)})`
            : `rgba(99,102,241,${Math.min(0.35, glowStrength / 255)})`;

          p.noFill();
          // @ts-ignore CSS rgba is accepted by p5
          p.stroke(halo);
          p.strokeWeight(12);
          p.rect(x, y, 150, 150, 10);

          p.stroke(isDark() ? "#A5B4FC" : "#6366F1"); // indigo-400/500
          p.strokeWeight(2.5);
          p.rect(x, y, 150, 150, 10);
        }

        // Emphasize entire big board when play-anywhere
        function drawGlobalEmphasis() {
          const a = (Math.sin(p.millis() / 650) * 0.5 + 0.5) * (isDark() ? 0.35 : 0.28);
          const halo = `rgba(99,102,241,${a})`; // indigo halo
          p.noFill();
          const inset = 4;
          // @ts-ignore
          p.stroke(halo);
          p.strokeWeight(14);
          p.rect(inset, inset, p.width - inset * 2, p.height - inset * 2, 12);

          p.stroke(isDark() ? "#A5B4FC" : "#6366F1");
          p.strokeWeight(2.5);
          p.rect(inset, inset, p.width - inset * 2, p.height - inset * 2, 12);
        }

        function checkWinner(board: Mark[]): Mark {
          const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
          ];
          for (const [a, b, c] of lines) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
              return board[a];
            }
          }
          return null;
        }

        function checkForLargeBoardWinner() {
          const winningLines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
          ];
          for (const [a, b, c] of winningLines) {
            if (
              winnerBoards[a] &&
              winnerBoards[a] === winnerBoards[b] &&
              winnerBoards[a] === winnerBoards[c]
            ) {
              overallWinner = winnerBoards[a];
              gameEnded = true;
              return;
            }
          }
        }

        function checkGameEnd() {
          const wonBoards = winnerBoards.filter((w) => w !== null).length;
          if (wonBoards === 9) {
            gameEnded = true;
            if (!overallWinner) {
              const winner =
                scores["X"] > scores["O"]
                  ? "X"
                  : scores["O"] > scores["X"]
                  ? "O"
                  : null;
              overallWinner = winner;
            }
          }
        }
      };

      p5Instance = new P5(sketch);
      p5Ref.current = p5Instance;
    })();

    return () => {
      p5Ref.current?.remove?.();
      p5Ref.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={containerRef} />
      <div className="text-sm text-gray-600 dark:text-gray-300">
        Click a cell to play. When the game ends, click again to restart.
      </div>
    </div>
  );
}
