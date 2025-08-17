"use client";
import GameCanvas from "@/components/GameCanvas";

export default function LocalPage() {
  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold">Local Multiplayer</h1>
      <div className="rounded-2xl border border-line bg-white dark:bg-transparent shadow-sm p-4">
        <GameCanvas />
      </div>
    </main>
  );
}
