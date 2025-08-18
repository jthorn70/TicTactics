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
  overallWinner: "X" | "O" | null;
  youAre?: "X" | "O";
};

export type Status = "connecting" | "idle" | "queued" | "waiting" | "playing" | "ended";
export type LobbyUser = { id: string; role: "X" | "O"; name?: string };

export function useWsGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [status, _setStatus] = useState<Status>("idle");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [users, setUsers] = useState<LobbyUser[]>([]);

  // --- debug helpers ---------------------------------------------------------
  const DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const dbg = (...args: any[]) => console.debug("[game]", ...args);
  const setStatus = (s: Status) => {
    dbg("status →", s);
    _setStatus(s);
  };
  const snapshot = (label: string, next?: GameState | null) => {
    const s = next ?? state;
    dbg(label, {
      status,
      roomCode,
      ended: s?.ended ?? null,
      overallWinner: s?.overallWinner ?? null,
      currentBoard: s?.currentBoard ?? null,
    });
  };
  // ---------------------------------------------------------------------------

  // socket lifecycle refs
  const wsRef = useRef<WebSocket | null>(null);
  const openPromiseRef = useRef<Promise<void> | null>(null);

  // auth handshake promise (resolves after "hello_ok")
  const authPromiseRef = useRef<Promise<void> | null>(null);
  const resolveAuthRef = useRef<(() => void) | null>(null);
  const rejectAuthRef = useRef<((e?: any) => void) | null>(null);

  useEffect(() => {
    return () => {
      try { wsRef.current?.close(); } catch { }
      wsRef.current = null;
      openPromiseRef.current = null;
      authPromiseRef.current = null;
      resolveAuthRef.current = null;
      rejectAuthRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureSocket(): Promise<WebSocket> {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    setStatus("connecting");

    const { data, error } = await supabase.auth.getSession();
    if (error) console.error("getSession error", error);
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      throw new Error("not_authenticated");
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL!;
    if (!wsUrl) throw new Error("Missing NEXT_PUBLIC_WS_URL");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    openPromiseRef.current = new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      ws.addEventListener("open", () => resolve(), { once: true });
    });

    authPromiseRef.current = new Promise<void>((resolve, reject) => {
      resolveAuthRef.current = resolve;
      rejectAuthRef.current = reject;
    });

    ws.onopen = () => {
      dbg("WS open → sending hello");
      ws.send(JSON.stringify({ type: "hello", token }));
    };

    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch (e) { console.error("WS bad JSON", e); return; }

      const payloadObj =
        (msg?.payload && typeof msg.payload === "object" && msg.payload) ||
        (msg?.state && typeof msg.state === "object" && msg.state) ||
        msg;

      dbg("IN", msg?.type ?? "(unknown)", {
        hasEnded: !!payloadObj?.ended,
        overallWinner: payloadObj?.overallWinner ?? null,
        keys: payloadObj && typeof payloadObj === "object" ? Object.keys(payloadObj) : null,
      });

      const getState = (): GameState | null => msg.payload ?? msg.state ?? null;

      const markEndedIfNeeded = (next: GameState | null | undefined, from: string) => {
        if (!next) return;
        if (next.ended || next.overallWinner === "X" || next.overallWinner === "O") {
          dbg(`→ setStatus('ended') via ${from}`);
          setStatus("ended");
        }
      };

      switch (msg.type) {
        case "hello_ok":
          dbg("auth OK");
          resolveAuthRef.current?.();
          return;

        case "room_created":
          setRoomCode(msg.code || msg.roomCode || null);
          setStatus("waiting");
          snapshot("room_created");
          return;

        case "lobby_update":
          setUsers(msg.users ?? []);
          if (msg.code || msg.roomCode) setRoomCode(msg.code ?? msg.roomCode);
          snapshot("lobby_update");
          return;

        case "match_started": {
          const next = getState();
          setStatus("playing");
          if (next) {
            setState(next);
            snapshot("match_started", next);
          }
          return;
        }

        case "state": {
          const next = getState();
          if (next) {
            setState(next);
            markEndedIfNeeded(next, "state");
            if (next.ended) setStatus("ended");
            snapshot("state", next);
          }
          return;
        }

        case "game_over": {
          setStatus("ended");
          setState(prev =>
            prev ? { ...prev, ended: true, overallWinner: msg.winner ?? prev.overallWinner } : prev
          );
          snapshot("game_over");
          return;
        }

        // cover other plausible end-event names
        case "game:ended":
        case "match_ended":
        case "matchEnded": {
          const next = getState();
          if (next) setState(next);
          setStatus("ended");
          snapshot(msg.type, next ?? undefined);
          return;
        }

        case "error":
          console.error("WS error:", msg.error);
          return;

        default: {
          // keep this while debugging to discover any unknown event names
          dbg("UNHANDLED", msg?.type);
          return;
        }
      }
    };

    ws.onclose = (e) => {
      dbg("WS closed", { code: e.code, reason: e.reason });
      wsRef.current = null;
      openPromiseRef.current = null;
      if (status !== "ended") setStatus("idle");
      authPromiseRef.current = null;
      resolveAuthRef.current = null;
      rejectAuthRef.current = null;
    };

    await openPromiseRef.current!;
    await authPromiseRef.current!;

    return wsRef.current!;
  }

  async function safeSend(payload: unknown) {
    const ws = await ensureSocket();
    if (authPromiseRef.current) await authPromiseRef.current;
    if (ws.readyState !== WebSocket.OPEN) {
      await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve(), { once: true }));
    }
    try {
      const type = (payload as any)?.type ?? "(no type)";
      dbg("OUT", type, payload);
      ws.send(JSON.stringify(payload));
    } catch (e) {
      console.error("WS send failed", e);
    }
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
    await safeSend({ type: "join_room", code: code.trim().toUpperCase() });
  };

  const startGame = async () => {
    await safeSend({ type: "start_game" });
  };

  const sendMove = async (boardIndex: number, cellIndex: number) => {
    if (state?.ended) {
      dbg("BLOCK move: game already ended");
      return;
    }
    await safeSend({ type: "move", boardIndex, cellIndex });
  };

  // Rematch (same lobby)
  const reset = async () => {
    await safeSend({ type: "reset" });
    // status will flip to "playing" on next "match_started"/"state"
  };

  // Expose a minimal debug snapshot (for a tiny panel in your page if you want)
  const debugSnapshot =
    DEBUG
      ? {
        status,
        roomCode,
        endedFlag: state?.ended ?? null,
        overallWinner: state?.overallWinner ?? null,
        currentBoard: state?.currentBoard ?? null,
        users,
      }
      : null;

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
    reset,
    debugSnapshot, // optional: render it when ?debug=1
  };
}
