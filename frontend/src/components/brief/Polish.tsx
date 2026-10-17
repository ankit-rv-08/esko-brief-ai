import { useEffect, useState } from "react";
import { Copy, Check, Plus, Sparkles, RotateCw, Volume2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

export function CopySource({ file, onCopy }: { file: string; onCopy: (file: string) => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return <Button variant="plain" size="plain" title={`Copy ${file}`} aria-label={`Copy ${file}`} className="copy-source h-6 w-6 shrink-0 rounded text-muted-foreground hover:bg-muted hover:text-primary" onClick={async () => {
    try { await navigator.clipboard.writeText(file); setCopied(true); onCopy(file); }
    catch { onCopy(""); }
  }}>{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</Button>;
}

export function AnimatedCount({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setCount(value); return; }
    const start = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / 600, 1);
      setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="tabular-nums">{count}</span>;
}

export function DraftSkeleton() {
  return <div className="draft-skeleton mx-auto w-full max-w-2xl space-y-4 px-8 pb-8" role="status" aria-label="Drafting brief">
    {[0, 1, 2].map((n) => <div key={n} className="skeleton-card relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div className="mb-4 h-3 w-2/5 rounded bg-muted" />
      <div className="space-y-2"><div className="h-2 w-full rounded bg-muted" /><div className="h-2 w-5/6 rounded bg-muted" /></div>
    </div>)}
  </div>;
}

export function BriefCommands({ open, onOpenChange, onAdd, onGenerate, onReset, onSound, onJessy, canGenerate, canReset }: {
  open: boolean; onOpenChange: (open: boolean) => void; onAdd: () => void; onGenerate: () => void;
  onReset: () => void; onSound: () => void; onJessy: () => void; canGenerate: boolean; canReset: boolean;
}) {
  const actions = [
    { label: "Add files", icon: Plus, action: onAdd, disabled: false },
    { label: "Generate brief", icon: Sparkles, action: onGenerate, disabled: !canGenerate },
    { label: "Start another brief", icon: RotateCw, action: onReset, disabled: !canReset },
    { label: "Toggle sound", icon: Volume2, action: onSound, disabled: false },
    { label: "Open Jessy", icon: MessageCircle, action: onJessy, disabled: false },
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="command-palette top-[18%] w-[calc(100%-32px)] max-w-[480px] translate-y-0 overflow-hidden rounded-xl p-0" aria-describedby="command-description">
    <DialogTitle className="sr-only">Brief commands</DialogTitle><DialogDescription id="command-description" className="sr-only">Search available actions</DialogDescription>
    <Command className="bg-transparent"><CommandInput autoFocus placeholder="Search actions…" /><CommandList className="nice-scroll p-2"><CommandEmpty>No matching actions.</CommandEmpty><CommandGroup>
      {actions.map(({ label, icon: Icon, action, disabled }) => <CommandItem key={label} value={label} disabled={disabled} onSelect={() => { onOpenChange(false); action(); }} className="gap-3 rounded-md px-3 py-3"><Icon />{label}</CommandItem>)}
    </CommandGroup></CommandList></Command>
  </DialogContent></Dialog>;
}