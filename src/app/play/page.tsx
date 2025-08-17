"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useWsGame } from "@/lib/useWsGame";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";

const MultiplayerCanvas = dynamic(() => import("@/components/MultiplayerCanvas"), { ssr: false });

export default function PlayPage() {
  const [authed, setAuthed] = useState(false);
  const search = useSearchParams();
  const router = useRouter();

  const joinCode = (search.get("join") || "").toUpperCase();
  const hostCode = (search.get("host") || "").toUpperCase();

  const {
    state, status, roomCode, users,
    findMatch, createRoom, joinRoom, startGame, sendMove
  } = useWsGame();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Auto-join if a join code is present
  useEffect(() => {
    if (joinCode) joinRoom(joinCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  // If we arrive with a host code (from /?host=), make sure we're the host; if not yet, just display it
  // When server replies with room_created, roomCode will populate anyway.

  if (!authed) {
    return (
      <main className="mx-auto max-w-screen-sm px-4 py-10 text-center space-y-4">
        <h1 className="text-2xl font-semibold">Log in to play online</h1>
        <a href="/login"><Button variant="solid">Log in with Discord</Button></a>
      </main>
    );
  }

  const effectiveCode = roomCode || hostCode || joinCode || "";  // show something ASAP
  const inLobby = status === "waiting" && !state;

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold">Play</h1>

      {inLobby && (
        <div className="rounded-2xl border border-line bg-white dark:bg-transparent shadow-sm p-4 space-y-3">
          <div className="text-sm">Lobby Code: <b>{effectiveCode || "…"}</b></div>

          <ul className="text-sm list-disc pl-5 min-h-[1.5rem]">
            {users.length > 0
              ? users.map(u => <li key={u.id}>{u.name ?? u.id} <b>({u.role})</b></li>)
              : <li>Waiting for players…</li>
            }
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button onClick={startGame} disabled={users.length < 2}>
              {users.length < 2 ? "Waiting for player…" : "Start Game"}
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(`${location.origin}/play?join=${effectiveCode}`)
              }
            >
              Copy Invite Link
            </Button>

            <Button
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(effectiveCode)}
            >
              Copy Code
            </Button>
          </div>

          <p className="text-xs text-muted">
            Share the link or code with a friend. When both are here, click <b>Start Game</b>.
          </p>
        </div>
      )}

      {!state && !inLobby && (
        <div className="rounded-2xl border border-line bg-white dark:bg-transparent shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" onClick={findMatch}>
              {status === "queued" ? "Queued…" : "Quick Match"}
            </Button>
            <Button onClick={async () => { await createRoom(); router.replace("/play"); }}>
              Create Lobby
            </Button>
            <JoinBox onJoin={joinRoom} defaultCode={joinCode} />
          </div>
        </div>
      )}

      {state && (
        <div className="rounded-2xl border border-line bg-white dark:bg-transparent shadow-sm p-4 space-y-3">
          <div className="text-sm">You are <b>{state.youAre}</b> • Turn: <b>{state.currentPlayer}</b></div>
          {state && inLobby === false && (
            <MultiplayerCanvas state={state} onCellClick={(b, c) => sendMove(b, c)} />
          )}
        </div>
      )}
    </main>
  );
}

function JoinBox({ onJoin, defaultCode = "" }: { onJoin: (c: string) => void; defaultCode?: string }) {
  const [code, setCode] = useState(defaultCode);
  useEffect(() => setCode(defaultCode), [defaultCode]);
  return (
    <div className="flex items-center gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Room code"
        className="rounded-md border border-line px-3 py-2 w-32 bg-white dark:bg-transparent"
      />
      <Button onClick={() => onJoin(code)}>Join</Button>
    </div>
  );
}
