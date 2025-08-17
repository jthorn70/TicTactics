"use client";
import GameCanvas from "@/components/GameCanvas";

function Pill({label,value}:{label:string;value:string|number}){
  return (
    <div className="rounded-full border border-line px-3 py-1 text-xs text-muted">
      {label}: <span className="ml-1 font-medium text-ink">{value}</span>
    </div>
  );
}

export default function GameCard(){
  return (
    <section className="rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold tracking-wide">Play</h2>
        <div className="flex gap-2">
          <Pill label="You" value="X" />
          <Pill label="Turn" value="X" />
        </div>
      </div>
      <div className="p-4">
        <div className="mx-auto max-w-[480px]">
          <GameCanvas />
        </div>
      </div>
      <div className="border-t border-line px-4 py-3 text-center text-xs text-muted">
        Click to place. Win small boards to claim the big one.
      </div>
    </section>
  );
}