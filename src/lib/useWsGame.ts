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
  youAre?: "X" | "O";
};

export type Status = "idle" | "connecting" | "queued" | "waiting" | "playing";
export type LobbyUser = { id: string; role: "X" | "O"; name?: string };

export function useWsGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [users, setUsers] = useState<LobbyUser[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const openPromiseRef = useRef<Promise<void> | null>(null);
  const authPromiseRef = useRef<Promise<void> | null>(null);
  const resolveAuthRef = useRef<(() => void) | null>(null);
  const rejectAuthRef = useRef<((e?: any) => void) | null>(null);

  useEffect(() => {
    return () => {
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
      openPromiseRef.current = null;
      authPromiseRef.current = null;
    };
  }, []);

  async function ensureSocket(): Promise<WebSocket> {
    // if already open, return it
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    setStatus("connecting");

    // get a fresh token
    const { data, error } = await supabase.auth.getSession();
    if (error) console.error("getSession error", error);
    const token = data.session?.access_token;
    if (!token) {
      // not logged in
      window.location.href = "/login";
      throw new Error("not_authenticated");
    }

    // open socket
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);
    wsRef.current = ws;

    // open promise
    openPromiseRef.current = new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      ws.addEventListener("open", () => resolve(), { once: true });
    });

    // auth promise (RESOLVED only after hello_ok)
    authPromiseRef.current = new Promise<void>((resolve, reject) => {
      resolveAuthRef.current = resolve;
      rejectAuthRef.current = reject;
    });

    ws.onopen = () => {
      // send hello
      ws.send(JSON.stringify({ type: "hello", token }));
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);

      // --- auth gate responses ---
      if (msg.type === "hello_ok") {
        resolveAuthRef.current?.();
        resolveAuthRef.current = null;
        return;
      }
      if (msg.type === "error" && msg.error === "auth_failed") {
        rejectAuthRef.current?.(new Error("auth_failed"));
        rejectAuthRef.current = null;
        return;
      }

      // --- normal game messages ---
      if (msg.type === "state") {
        setState(msg.payload as GameState);
        setStatus("playing");
        return;
      }
      if (msg.type === "room_created") {
        setRoomCode(msg.code as string);
        setStatus("waiting");
        return;
      }
      if (msg.type === "lobby_update") {
        setUsers((msg.users ?? []) as LobbyUser[]);
        if (msg.code && !roomCode) setRoomCode(msg.code);
        if (!state) setStatus("waiting");
        return;
      }
      if (msg.type === "match_started") {
        setStatus("playing");
        return;
      }
      if (msg.type === "error") {
        console.error("WS error:", msg.error);
        return;
      }
    };

    ws.onclose = () => {
      setStatus("idle");
      wsRef.current = null;
      openPromiseRef.current = null;
      authPromiseRef.current = null;
      resolveAuthRef.current = null;
      rejectAuthRef.current = null;
    };

    await openPromiseRef.current!;
    // IMPORTANT: wait until server acknowledged auth
    await authPromiseRef.current!;
    return wsRef.current!;
  }

  async function safeSend(payload: unknown) {
    const ws = await ensureSocket();
    // in case ensureSocket returned a socket that is open but authPromise hasn't resolved yet
    if (authPromiseRef.current) await authPromiseRef.current;
    if (ws.readyState !== WebSocket.OPEN) {
      await new Promise<void>((resolve) =>
        ws.addEventListener("open", () => resolve(), { once: true })
      );
    }
    ws.send(JSON.stringify(payload));
  }

  // public API
  const findMatch  = async () => { setStatus("queued"); await safeSend({ type: "find_match" }); };
  const createRoom = async () => { await safeSend({ type: "create_room" }); };
  const joinRoom   = async (code: string) => { await safeSend({ type: "join_room", code: code.trim().toUpperCase() }); };
  const startGame  = async () => { await safeSend({ type: "start_game" }); };
  const sendMove   = async (boardIndex: number, cellIndex: number) => {
    await safeSend({ type: "move", boardIndex, cellIndex });
  };

  return { state, status, roomCode, users, findMatch, createRoom, joinRoom, startGame, sendMove };
}
