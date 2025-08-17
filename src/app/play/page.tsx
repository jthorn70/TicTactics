"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import NextDynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { useWsGame } from "@/lib/useWsGame";
import Button from "@/components/ui/Button";

// lazy-load p5 canvas (no SSR)
const MultiplayerCanvas = NextDynamic(
  () => import("@/components/MultiplayerCanvas"),
  { ssr: false }
);

// ---- Wrapper REQUIRED by Next.js so useSearchParams is inside <Suspense> ----
export default function PlayPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <PlayPageInner />
    </Suspense>
  );
}

function PlayPageInner() {
  const [authed, setAuthed] = useState(false);
  const search = useSearchParams();
  const router = useRouter();

  const joinCode = (search.get("join") || "").toUpperCase();
  const hostCode = (search.get("host") || "").toUpperCase();

  const {
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
  } = useWsGame();

  // keep local “logged in?” flag in client
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) =>
      setAuthed(!!s)
    );
    return () => data.subscription.unsubscribe();
  }, []);

  // Auto-join if a join code is present
  useEffect(() => {
    if (joinCode) joinRoom(joinCode);
  }, [joinCode, joinRoom]);

  // If we arrive with a host code (?host=), switch to waiting (server will also send lobby_update)
  useEffect(() => {
    // no-op: UI already reads roomCode/status from server
  }, [hostCode]);

  const onCellClick = (b: number, c: number) => {
    if (status === "playing") sendMove(b, c);
  };

  // --- UI ---
  return (
    <div className="mx-auto max-w-screen-sm px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Play</h1>
        <div className="text-sm rounded-md border px-2 py-1">
          Status: <b>{status}</b>
        </div>
      </div>

      {/* Lobby panel */}
      {status !== "playing" && status !== "ended" && (
        <div className="rounded-lg border p-4 space-y-3 bg-white/80 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div className="font-medium">Lobby</div>
            {roomCode ? (
              <code className="px-2 py-1 rounded border">{roomCode}</code>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button onClick={findMatch}>Quick Match</Button>
            <Button onClick={createRoom}>Create Lobby</Button>
            <Button
              onClick={() => {
                const code = prompt("Enter invite code:");
                if (code) joinRoom(code);
              }}
              variant="secondary"
            >
              Join by Code
            </Button>
            {roomCode && (
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${window.location.origin}/play?join=${roomCode}`
                  )
                }
              >
                Copy Invite
              </Button>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Players
            </div>
            <ul className="text-sm list-disc pl-5 min-h-[1.5rem]">
              {users.length > 0 ? (
                users.map((u, i) => (
                  <li key={`${u.id}-${u.role}-${i}`}>
                    {u.name ?? u.id} <b>({u.role})</b>
                  </li>
                ))
              ) : (
                <li>Waiting for players…</li>
              )}
            </ul>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={startGame}
              disabled={!roomCode || users.length < 2}
            >
              Start Game
            </Button>
          </div>

          <p className="text-xs text-zinc-500">
            Tip: Share{" "}
            <code className="px-1 py-0.5 rounded border">
              /play?join={roomCode ?? "CODE"}
            </code>{" "}
            with your opponent.
          </p>
        </div>
      )}

      {/* Game board */}
      {state && (status === "playing" || status === "ended") && (
        <div className="flex justify-center">
          <MultiplayerCanvas state={state} onCellClick={onCellClick} />
        </div>
      )}

      {status === "ended" && (
        <div className="fixed inset-0 z-10 flex flex-col items-center justify-center space-y-4 bg-black/50">
          <div className="text-xl font-semibold">
            {state?.overallWinner ?? "Game over"}
          </div>
          <div className="flex gap-4">
            <Button onClick={reset}>Rematch</Button>
            <Button variant="secondary" onClick={() => router.push("/")}>
              Return Home
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
