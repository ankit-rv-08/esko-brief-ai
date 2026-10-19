import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";
import { Button } from "@/components/ui/button";
import { GripVertical, Mic, MicOff, Send, Sparkles, X } from "lucide-react";

export type JessyMsg = { id: number; from: "jessy" | "user"; text: string };

const W = 380;
const H = 520;
const KEY = "jessy-pos";

function Avatar({ size = 22 }: { size?: number }) {
  return (
    <span className="jessy-avatar flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size }}>
      <Sparkles className="text-primary-foreground" style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

export function Jessy({
  open, onOpenChange: setOpen, messages, thinking, thinkingText, activity, active, sparkle, onSend,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; messages: JessyMsg[]; thinking: boolean; thinkingText: string; activity: string[];
  active: boolean; sparkle: boolean; onSend: (t: string) => void;
}) {
  const [text, setText] = useState("");
  const [mic, setMic] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const p = localStorage.getItem(KEY); if (p) setPos(JSON.parse(p)); } catch { /* ignore */ }
  }, []);

  useEffect(() => { body.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [messages, thinking, activity, open]);

  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - Math.min(W, window.innerWidth - 16) - 8)),
    y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - Math.min(H, window.innerHeight - 120) - 8)),
  });

  const down = (e: RPE<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const parent = e.currentTarget.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const move = (e: RPE<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    setPos((p) => {
      if (!p) return p;
      let next = p;
      const nearEdge = p.x <= 20 || p.y <= 20 || p.x >= window.innerWidth - W - 20 || p.y >= window.innerHeight - H - 20;
      if (nearEdge) {
        next = { x: Math.max(8, window.innerWidth - W - 24), y: Math.max(8, window.innerHeight - H - 24) };
        setSnapping(true);
        setTimeout(() => setSnapping(false), 400);
      }
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  const send = () => { const t = text.trim(); if (!t) return; onSend(t); setText(""); };

  if (!open) {
    return (
      <Button variant="plain" size="plain"
        onClick={() => setOpen(true)}
        title="Open Jessy"
        className={`jessy-trigger group fixed bottom-6 right-6 z-40 flex h-11 items-center gap-2 rounded-full pl-1.5 pr-2 ${sparkle ? "jessy-sparkle" : ""}`}
      >
        <Avatar size={26} />
        <span className="text-[13px] font-semibold">Jessy</span>
        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`} />
        
        <span className="pointer-events-none absolute -top-8 right-0 rounded-md bg-foreground px-2 py-1 text-[11px] text-background opacity-0 transition group-hover:opacity-100">Open Jessy</span>
      </Button>
    );
  }

  const style = pos ? { left: pos.x, top: pos.y } : { right: 24, bottom: 24 };
  return (
    <div
      className={`jessy-panel fixed z-40 flex flex-col overflow-hidden rounded-2xl ${dragging ? "is-dragging" : ""} ${snapping ? "is-snapping" : ""}`}
      style={style}
    >
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up}
        className={`flex h-12 shrink-0 select-none items-center gap-2 border-b border-border px-3 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}>
        <GripVertical className="h-3 w-3 text-muted-foreground/60" />
        <span className={`h-[7px] w-[7px] rounded-full ${active ? "bg-primary" : "bg-muted-foreground/40"}`} />
        <span className="text-[13px] font-semibold">Jessy</span>
        <span className="font-mono text-[11px] text-muted-foreground">{active ? "Working" : "Standing by"}</span>
        <Button variant="plain" size="plain" onClick={() => setOpen(false)} aria-label="Close Jessy" className="ml-auto flex h-[26px] w-[26px] items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={body} className="nice-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => m.from === "jessy" ? (
          <div key={m.id} className="fade-up flex items-start gap-2">
            <Avatar />
            <div className="max-w-[85%] rounded-[10px] rounded-tl-[4px] border border-border bg-card px-3 py-3 text-[12.5px] leading-[1.55]">{m.text}</div>
          </div>
        ) : (
          <div key={m.id} className="fade-up flex justify-end">
            <div className="max-w-[85%] rounded-[10px] rounded-tr-[4px] bg-primary px-3 py-3 text-[12.5px] leading-[1.55] text-primary-foreground">{m.text}</div>
          </div>
        ))}
        {thinking && (
          <div className="fade-up flex items-start gap-2">
            <Avatar />
            <div className="rounded-[10px] rounded-tl-[4px] border border-border bg-card px-3 py-3 text-[12.5px]">
              <div className="text-muted-foreground">{thinkingText}</div>
              <div className="mt-1.5 flex gap-1"><i className="dot" /><i className="dot" style={{ animationDelay: "150ms" }} /><i className="dot" style={{ animationDelay: "300ms" }} /></div>
            </div>
          </div>
        )}
        {activity.length > 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/60 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Activity</div>
            <ul className="mt-1.5 space-y-1">
              {activity.map((a, i) => <li key={`${i}-${a}`} className="slide-in flex items-center gap-2 text-[12px] text-foreground/80"><span className="h-1 w-1 rounded-full bg-primary" />{a}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2.5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          aria-label="Message Jessy" placeholder="Ask Jessy or leave a note…" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground" />
        <Button variant="plain" size="plain" onClick={() => setMic((m) => !m)} aria-label="Voice input"
          className={`flex h-[30px] w-[30px] items-center justify-center rounded-full ${mic ? "animate-pulse bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          {mic ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button variant="plain" size="plain" onClick={send} aria-label="Send" className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-foreground text-background hover:opacity-90">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
