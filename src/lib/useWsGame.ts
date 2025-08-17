"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mark = "X" | "O" | null;

export type GameState = {
  boards: Mark[][];
  winnerBoards: Mark[];
  currentBoard: number | null;
  currentPlayer: "X" | "O";
  ended: boolean;
  overallWinner: "X" | "O" | null; // keep nullable in case server omits
  youAre?: "X" | "O";
};

export type Status =
  | "connecting"
  | "idle"
  | "queued"
  | "waiting"
  | "playing"
  | "ended";

export type LobbyUser = { id: string; role: "X" | "O"; name?: string };

export function useWsGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [users, setUsers] = useState<LobbyUser[]>([]);

  // --- socket lifecycle refs
  const wsRef = useRef<WebSocket | null>(null);
  const openPromiseRef = useRef<Promise<void> | null>(null);

  // auth handshake promise (resolves only after "hello_ok")
  const authPromiseRef = useRef<Promise<void> | null>(null);
  const resolveAuthRef = useRef<(() => void) | null>(null);
  const rejectAuthRef = useRef<((e?: any) => void) | null>(null);

  useEffect(() => {
    return () => {
      try {
        wsRef.current?.close();
      } catch { }
      wsRef.current = null;
      openPromiseRef.current = null;
      authPromiseRef.current = null;
      resolveAuthRef.current = null;
      rejectAuthRef.current = null;
    };
  }, []);

  async function ensureSocket(): Promise<WebSocket> {
    // reuse open socket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    setStatus("connecting");

    // refresh token
    const { data, error } = await supabase.auth.getSession();
    if (error) console.error("getSession error", error);
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      throw new Error("not_authenticated");
    }

    // open socket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL!;
    if (!wsUrl) {
      throw new Error("Missing NEXT_PUBLIC_WS_URL");
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // promise: socket open
    openPromiseRef.current = new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      ws.addEventListener("open", () => resolve(), { once: true });
    });

    // promise: auth hello_ok
    authPromiseRef.current = new Promise<void>((resolve, reject) => {
      resolveAuthRef.current = resolve;
      rejectAuthRef.current = reject;
    });

    ws.onopen = () => {
      // send hello with token
      ws.send(JSON.stringify({ type: "hello", token }));
    };

    ws.onmessage = (ev) => {
      const msg = (() => {
        try {
          return JSON.parse(ev.data);
        } catch {
          return {};
        }
      })();

      switch (msg.type) {
        /* ---------- auth handshake ---------- */
        case "hello_ok": {
          // we are authenticated with the WS server
          resolveAuthRef.current?.();
          resolveAuthRef.current = null;
          rejectAuthRef.current = null;
          // don't change status here; let lobby/game drive it
          return;
        }
        case "error": {
          if (msg.error === "auth_failed") {
            rejectAuthRef.current?.(new Error("auth_failed"));
            rejectAuthRef.current = null;
            resolveAuthRef.current = null;
            try {
              ws.close();
            } catch { }
            setStatus("idle");
          } else {
            console.error("WS error:", msg.error);
          }
          return;
        }

        /* ---------- lobby messages ---------- */
        case "room_created": {
          setRoomCode(msg.code || msg.roomCode || null);
          setStatus("waiting");
          return;
        }
        case "lobby_update": {
          setUsers(msg.users ?? []);
          if (msg.code || msg.roomCode)
            setRoomCode(msg.code ?? msg.roomCode);
          return;
        }

        /* ---------- match lifecycle ---------- */
        case "match_started": {
          // optional server payload state
          const next = (msg.payload ?? msg.state ?? null) as GameState | null;
          setStatus("playing");
          if (next) setState(next);
          return;
        }

        case "state": {
          const next = (msg.payload ?? msg.state ?? null) as GameState | null;
          if (next) {
            setState((prev) => {
              const merged: GameState = {
                ...next,
                // keep overallWinner if server omitted it
                overallWinner: next.overallWinner ?? prev?.overallWinner ?? null,
              };
              return merged;
            });
            if (next.ended) setStatus("ended");
          }
          return;
        }

        case "game_over": {
          // winner broadcast
          setStatus("ended");
          setState((prev) =>
            prev
              ? {
                ...prev,
                ended: true,
                overallWinner: msg.winner ?? prev.overallWinner ?? null,
              }
              : prev
          );
          return;
        }
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      openPromiseRef.current = null;
      // if we lose the connection mid-game, go to idle
      if (status !== "ended") setStatus("idle");
      // clean auth resolvers
      authPromiseRef.current = null;
      resolveAuthRef.current = null;
      rejectAuthRef.current = null;
    };

    // wait for socket open
    await openPromiseRef.current!;
    // wait for hello_ok
    await authPromiseRef.current!;

    return wsRef.current!;
  }

  async function safeSend(payload: unknown) {
    const ws = await ensureSocket();

    // if auth handshake promise still around, await it
    if (authPromiseRef.current) await authPromiseRef.current;

    if (ws.readyState !== WebSocket.OPEN) {
      await new Promise<void>((resolve) =>
        ws.addEventListener("open", () => resolve(), { once: true })
      );
    }
    ws.send(JSON.stringify(payload));
  }

  /* -------------------- public API -------------------- */
  const findMatch = async () => {
    setStatus("queued");
    await safeSend({ type: "find_match" });
  };

  const createRoom = async () => {
    await safeSend({ type: "create_room" });
  };

  const joinRoom = async (code: string) => {
    await safeSend({
      type: "join_room",
      code: code.trim().toUpperCase(),
    });
  };

  const startGame = async () => {
    await safeSend({ type: "start_game" });
  };

  const sendMove = async (boardIndex: number, cellIndex: number) => {
    // guard in case UI calls during ended state
    if (state?.ended) return;
    await safeSend({ type: "move", boardIndex, cellIndex });
  };

  // NEW: ask server to reset the match in the same room (rematch)
  const reset = async () => {
    await safeSend({ type: "reset" });
    // client status will flip to "playing" on next "match_started"/"state"
  };

  return {
    state,
    status,
    roomCode,
    users,
    findMatch,
    createRoom,
    joinRoom,
    startGame,
    sendMove,
    reset, // expose for rematch button
  };
}
