"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { useWsGame } from "@/lib/useWsGame";

export default function HomePage() {
  const { createRoom, roomCode, status } = useWsGame();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const router = useRouter();
  const inviteLink = useMemo(() => {
    if (!roomCode) return "";
    // Shareable link that auto-joins on the /play page
    return `${location.origin}/play?join=${roomCode}`;
  }, [roomCode]);
  // If the room actually got created already, route with the code in the URL (nice to have)
  useEffect(() => {
    if (status === "waiting" && roomCode) {
      router.replace(`/play?host=${roomCode}`);
    }
  }, [status, roomCode, router]);

  const onCreateLobby = async () => {
    createRoom();           // kicks off WS request
    router.push("/play");         // go to the lobby page immediately
  };
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (text: string, which: "code" | "link") => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
  };

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-16 space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">TIC TACTICS</h1>
        <p className="text-sm text-muted">Win small boards to capture the big one.</p>
      </div>

      <div className="rounded-2xl border border-line bg-white dark:bg-transparent shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/local">
            <Button variant="solid" className="w-full">Local Multiplayer</Button>
          </Link>

          <Button
            className="w-full"
            onClick={() => createRoom()}
            disabled={status === "waiting" && !!roomCode}
          >
            {status === "waiting" && roomCode ? "Lobby Created" : "Create Lobby"}
          </Button>
        </div>

        {roomCode && (
          <div className="rounded-lg border border-line p-4 space-y-3">
            <div className="text-sm">Invite Code</div>
            <div className="flex items-center gap-2">
              <code className="text-xl font-bold tracking-widest">{roomCode}</code>
              <Button size="sm" onClick={() => copy(roomCode, "code")}>
                {copied === "code" ? "Copied!" : "Copy"}
              </Button>
            </div>

            <div className="text-sm">Invite Link</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 rounded-md border border-line px-3 py-2 text-sm bg-white dark:bg-transparent"
              />
              <Button size="sm" onClick={() => copy(inviteLink, "link")}>
                {copied === "link" ? "Copied!" : "Copy Link"}
              </Button>
              <Link href={inviteLink}>
                <Button size="sm" variant="outline">Open</Button>
              </Link>
            </div>

            <p className="text-xs text-muted">
              Share the code or link with a friend. When they open it, they’ll join your lobby.
            </p>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-muted">
        Tip: You can still use <Link href="/play" className="underline">Quick Match</Link> from the Play page.
      </div>
    </main>
  );
}
