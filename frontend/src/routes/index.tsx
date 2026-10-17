import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles, FileSpreadsheet, FileText, Plus, Download, Search, ArrowUpRight, AlertTriangle,
  Loader2, Check, RotateCw, Volume2, VolumeX, AlertCircle, Upload, X, PanelRight,
} from "lucide-react";
import { Jessy, type JessyMsg } from "@/components/brief/Jessy";
import { Button } from "@/components/ui/button";
import { AnimatedCount, BriefCommands, CopySource, DraftSkeleton } from "@/components/brief/Polish";
import { ding, tick } from "@/lib/sound";
import { workspaceLayout, type WorkspacePanel } from "@/components/brief/responsive";
import { runPipeline, type PipelineResponse } from "@/lib/api";
import type { Brief, Fact, Gap, Conflict } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brief AI — Packaging Design Brief" },
      { name: "description", content: "Draft evidence-backed packaging design briefs from your source files." },
      { property: "og:title", content: "Brief AI — Packaging Design Brief" },
      { property: "og:description", content: "Draft evidence-backed packaging design briefs from your source files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type FType = "xlsx" | "pdf";
type Cite = { id: string; file: string; type: FType; loc: string; line: string; snippet: string };
type SrcFile = { name: string; type: FType; meta: string; file?: File };

const cites = [
  { id: "c1", file: "production_specs.xlsx", type: "xlsx", loc: "p.2", line: "Row 3", snippet: "ECO-01 bar soap, 100g. Carton target: 100% recyclable, max unit cost $0.18, launch Q2 retail." },
  { id: "c2", file: "brand_guidelines.pdf", type: "pdf", loc: "p.14", line: "Page 14", snippet: "Packaging must express a natural, low-impact identity. Prefer uncoated, earthy substrates." },
  { id: "c3", file: "production_specs.xlsx", type: "xlsx", loc: "p.2", line: "Row 7", snippet: "Board: 350gsm recycled kraft, water-based inks, no laminate. FSC certification required." },
  { id: "c4", file: "retailer_req.pdf", type: "pdf", loc: "p.3", line: "Page 3", snippet: "Shelf-ready packaging should use bleached white board for consistent color reproduction." },
] as const satisfies readonly Cite[];

const SAMPLE: SrcFile[] = [
  { name: "production_specs.xlsx", type: "xlsx", meta: "24 rows · 2 sheets" },
  { name: "brand_guidelines.pdf", type: "pdf", meta: "32 pages · 4.1 MB" },
  { name: "retailer_req.pdf", type: "pdf", meta: "6 pages · 820 KB" },
];
const STAGES = ["Upload", "Extract", "Analyze", "Draft"];
const STEPS = ["Uploading sources", "Extracting facts from 12 rows", "Checking conflicts across 3 files", "Drafting brief section 2 of 5"];

type Toast = { id: number; kind: "ok" | "err"; text: string };

function FileIcon({ type, className = "h-3.5 w-3.5" }: { type: FType; className?: string }) {
  return type === "xlsx" ? <FileSpreadsheet className={`${className} text-success`} /> : <FileText className={`${className} text-danger`} />;
}
function Badge({ n }: { n: number; amber?: boolean }) {
  return <span key={n} className="badge-bounce ml-auto flex h-[18px] min-w-[20px] items-center justify-center rounded border border-border px-1 font-mono text-[10.5px] text-muted-foreground">{n}</span>;
}

function Clock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const f = () => setNow(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    f();
    const i = setInterval(f, 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.02em] text-muted-foreground">
      <span key={now} className="heartbeat h-[5px] w-[5px] rounded-full bg-primary" />
      {now ?? "--:--:--"}
    </div>
  );
}

function Pipeline({ stage, running }: { stage: number; running: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {STAGES.map((s, i) => {
        const done = running ? i < stage : false;
        const cur = running && i === stage;
        return (
          <div key={s} className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 font-mono text-[11px] ${done || cur ? "text-primary" : "text-muted-foreground"}`}>
              {cur && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
              {String(i + 1).padStart(2, "0")} {s}
            </span>
            {i < STAGES.length - 1 && (
              <span className={`h-0 w-10 border-t ${done ? "border-solid border-primary" : cur ? "border-solid border-primary/40" : "border-dashed border-muted-foreground/40"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Confetti() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-6 z-10">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <span key={i} className="confetti-dot" style={{ ["--dx" as string]: `${Math.cos(a) * 70}px`, ["--dy" as string]: `${Math.sin(a) * 40 - 20}px` }} />;
      })}
    </div>
  );
}

let msgId = 1;

function Index() {
  const [mobilePanel, setMobilePanel] = useState<WorkspacePanel>("brief");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [jessyOpen, setJessyOpen] = useState(false);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandsOpen((v) => !v); } };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const [sel, setSel] = useState<Cite | null>(null);
  const openEvidence = (citation: Cite) => {
    setSel(citation);
    const layout = workspaceLayout(window.innerWidth);
    if (layout === "mobile") setMobilePanel("evidence");
    if (layout === "tablet") setEvidenceOpen(true);
  };
  const [files, setFiles] = useState<SrcFile[]>([]);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [stage, setStage] = useState(0);
  const [btn, setBtn] = useState<"default" | "running" | "ready">("default");
  const [glow, setGlow] = useState(false);
  const [sparkle, setSparkle] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [sound, setSound] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [msgs, setMsgs] = useState<JessyMsg[]>([{ id: 0, from: "jessy", text: "Ready when you are. Drop your sources and I'll take it from there." }]);
  const [thinking, setThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [activity, setActivity] = useState<string[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const say = (text: string, from: JessyMsg["from"] = "jessy") => setMsgs((m) => [...m, { id: msgId++, from, text }]);
  const toast = (kind: Toast["kind"], text: string) => setToasts((t) => [...t, { id: msgId++, kind, text }]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((q) => q.slice(1)), 4000);
    return () => clearTimeout(t);
  }, [toasts]);

  const addFiles = (list: SrcFile[]) => {
    const merged = [...files, ...list.filter((f) => !files.some((x) => x.name === f.name))];
    setFiles(merged);
    if (soundRef.current) tick();
    setGlow(true);
    setTimeout(() => setGlow(false), 2000);
    say(`Got it. ${merged.length} file${merged.length === 1 ? "" : "s"}, ${merged.length * 18} elements. Ready when you click Generate.`);
  };

  const onPick = (fl: FileList | null) => {
    if (!fl?.length) return;
    addFiles(Array.from(fl).map((f) => ({
      name: f.name,
      type: /\.(xlsx|xls|csv)$/i.test(f.name) ? "xlsx" : "pdf",
      meta: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      file: f,
    })));
  };

  const generate = async () => {
    if (!files.length || phase === "running") return;
    setPhase("running"); setBtn("running"); setStage(0); setActivity([]); setSel(null); setMobilePanel("brief"); setEvidenceOpen(false);
    setThinking(true); setThinkingText(`Connecting to server and gathering evidence…`);
    try {
      // Extract the raw File objects from state
      const realFilesToUpload = files
        .map((f) => f.file)
        .filter((f): f is File => f instanceof File);

      if (realFilesToUpload.length === 0) {
        throw new Error("No valid files to upload. Please use 'Add files' to upload a real file.");
      }

      const data = await runPipeline(realFilesToUpload, (stage) => {
        const stageText = {
          uploading: "Uploading your files...",
          extracting: "Reading 31 facts...",
          analyzing: "Checking for conflicts...",
          generating: "Drafting 6 sections..."
        }[stage];
        setActivity((a) => [...a, stageText]);
        setThinkingText(stageText);
      });

      // Set the real data to state
      setBrief(data.brief);
      setFacts(data.facts);
      setGaps(data.gaps);
      setConflicts(data.conflicts);
      setElements(data.elements);
      
      setThinking(false); setActivity([]); setPhase("done"); setBtn("ready");
      setConfetti(true); setSparkle(true);
      setTimeout(() => setConfetti(false), 900);
      setTimeout(() => setSparkle(false), 3000);
      setTimeout(() => setBtn("default"), 2000);
      say(`Draft ready. ${data.brief.sections.length} sections, ${data.facts.length} facts, ${data.gaps.length} open gaps, ${data.conflicts.length} conflicts.`);
      toast("ok", "Brief generated");
      if (soundRef.current) ding();
    } catch (error) {
      console.error("Pipeline failed:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      const isNetwork = errMsg.toLowerCase().includes("failed to fetch")
        || errMsg.toLowerCase().includes("cors")
        || errMsg.toLowerCase().includes("network");
      setThinking(false); setPhase("done"); setBtn("default"); setBrief(null);
      say(`Hit a snag — ${isNetwork ? "network/CORS error" : errMsg}`);
      toast("err", isNetwork ? "Network/CORS: check backend URL" : "Failed: " + errMsg);
    } finally {
      setPhase("done");
    }
  };

  const reset = () => { setPhase("idle"); setFiles([]); setSel(null); setStage(0); setMobilePanel("brief"); setEvidenceOpen(false); say("Clean slate. Drop new sources whenever you're ready."); };

  const onSend = (t: string) => {
    say(t, "user");
    setThinking(true); setThinkingText("Checking sources…");
    setTimeout(() => {
      setThinking(false);
      if (/rate|error|snag/i.test(t)) {
        say("Hit a snag — Groq is rate-limited. Should clear in about 15 minutes.");
        toast("err", "Groq rate limit — try again in 15 min");
      } else if (phase === "done") {
        say("Section 2 cites production_specs.xlsx, row 3. I've opened it in the evidence panel.");
        openEvidence(cites[2]);
      } else if (!files.length) {
        say("Nothing to read yet. Add your sources and I'll map them for you.");
      } else {
        say(`I have ${files.length} source${files.length === 1 ? "" : "s"} queued. Click Generate brief and I'll draft it.`);
      }
      if (soundRef.current) ding();
    }, 1100);
  };

  const copied = (file: string) => toast(file ? "ok" : "err", file ? "Source path copied" : "Clipboard unavailable");

  const Chip = ({ c }: { c: Cite }) => (
    <span className="source-reference inline-flex max-w-full items-center rounded-md border border-border bg-card"><Button variant="plain" size="plain" onClick={() => openEvidence(c)} className={`citation-chip inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition hover:shadow-sm ${sel?.id === c.id ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground"}`}>
      <FileIcon type={c.type} /> <span className="truncate">{c.file}, {c.loc}</span>
    </Button><CopySource file={c.file} onCopy={copied} /></span>
  );
  const Pill = ({ v }: { v: number }) => {
    const hi = v >= 90;
    return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${hi ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}><span className={`h-1.5 w-1.5 rounded-full ${hi ? "bg-success" : "bg-warning"}`} />{v}% Confidence</span>;
  };

  const GenButton = ({ className = "", compact = false }: { className?: string; compact?: boolean }) => (
    <Button variant="plain" size="plain" onClick={generate} disabled={!files.length || btn === "running"} aria-label={compact ? "Generate brief" : undefined} title={compact ? "Generate brief" : undefined}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--cursor-x", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--cursor-y", `${e.clientY - r.top}px`); }}
      className={`generate-button inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed ${!files.length ? "opacity-40" : ""} ${className}`}>
      {btn === "running" ? <><Loader2 className="h-4 w-4 animate-spin" />{!compact && "Working…"}</> : btn === "ready" ? <><Check className="h-4 w-4" />{!compact && "Brief ready"}</> : <><Sparkles className="h-4 w-4" />{!compact && "Generate brief"}</>}
    </Button>
  );

  const done = phase === "done";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background font-sans text-foreground">
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
      <header className="workspace-header relative z-10 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 sm:px-4 md:flex md:justify-between md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="brand-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground"><Sparkles className="h-3.5 w-3.5 text-background" /></div>
          <span className="truncate text-sm font-bold">Brief AI</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 md:gap-4"><Clock />
        <div className="md:hidden"><GenButton compact className="compact-generate" /></div>
        <div className="hidden gap-2 md:flex">
          <Button variant="plain" size="plain" onClick={() => fileInput.current?.click()} className="header-ghost inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[12px] text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" />Add files</Button>
          <GenButton />
        </div></div>
      </header>

      <div className="relative flex min-h-0 flex-1 pb-[var(--mobile-nav-height)] md:pb-0">
        <aside aria-label="Sources panel" className={`sources-sidebar w-full min-h-0 shrink-0 flex-col border-r border-border bg-sidebar md:flex md:w-[248px] min-[1025px]:w-[300px] ${mobilePanel === "sources" ? "flex" : "hidden"}`}>
          <div className="nice-scroll flex-1 space-y-6 overflow-y-auto p-4">
            <section className="fade-up">
              <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sources <Badge n={files.length} /></h3>
              {files.length === 0 ? (
                <Button variant="plain" size="plain" onClick={() => fileInput.current?.click()} className="w-full rounded-lg border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground hover:bg-card">
                  <Upload className="mx-auto mb-1 h-4 w-4" />Add spreadsheets or PDFs
                </Button>
              ) : (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div key={f.name} className="source-reference source-card slide-in flex items-center gap-2 rounded-lg border border-border bg-card p-2 transition hover:shadow-sm">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted"><FileIcon type={f.type} className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-medium" title={f.name}>{f.name}</div><div className="font-mono text-[10.5px] text-muted-foreground">{f.meta}</div></div><CopySource file={f.name} onCopy={copied} />
                    </div>
                  ))}
                  {!done && <GenButton className={`mt-2 w-full ${glow ? "glow-pulse" : ""}`} />}
                </div>
              )}
            </section>
            {done && (
              <>
                <section className="fade-up" style={{ animationDelay: "80ms" }}>
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gaps <Badge n={2} amber /></h3>
                  <div className="space-y-2">
                    {[["Target retail price", "No source specifies the shelf price point."], ["Print run quantity", "Initial order volume is not defined."]].map(([t, d]) => (
                      <div key={t} className="gap-card rounded-lg border border-border border-l-2 border-l-warning bg-warning-soft p-3">
                        <div className="mb-1 text-[10.5px] uppercase text-warning">Missing detail</div><div className="text-[12.5px] font-semibold">{t}</div>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{d}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="fade-up" style={{ animationDelay: "160ms" }}>
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conflicts <Badge n={1} /></h3>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex items-center gap-2 text-[10.5px] uppercase text-muted-foreground"><span className="h-[5px] w-[5px] rounded-full bg-danger" />Board substrate</div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                      <Button variant="plain" size="plain" onClick={() => openEvidence(cites[2])} className="rounded-md bg-muted p-2 text-[12px] hover:shadow-sm"><div className="font-medium">Recycled Kraft</div><div className="text-[10px] text-muted-foreground">production_specs</div></Button>
                      <span className="text-[10px] font-medium text-muted-foreground">VS</span>
                      <Button variant="plain" size="plain" onClick={() => openEvidence(cites[3])} className="rounded-md bg-muted p-2 text-[12px] hover:shadow-sm"><div className="font-medium">Bleached White</div><div className="text-[10px] text-muted-foreground">retailer_req</div></Button>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            {done && (
              <Button variant="plain" size="plain" onClick={reset} className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-muted">
                <RotateCw className="h-3.5 w-3.5 transition-transform duration-1000 group-hover:rotate-360" />Start another brief
              </Button>
            )}
            <Button variant="plain" size="plain" onClick={() => setSound((s) => !s)} aria-label={sound ? "Turn sound off" : "Turn sound on"} title={sound ? "Sound on" : "Sound off"}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        </aside>

        <main aria-label="Brief panel" className={`relative min-h-0 min-w-0 flex-1 bg-card md:block ${mobilePanel === "brief" ? "block" : "hidden"}`}>
          <Button variant="plain" size="plain" aria-label="Open evidence" title="Open evidence" onClick={() => setEvidenceOpen(true)} className="absolute right-3 top-3 z-10 hidden h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted md:flex min-[1025px]:hidden"><PanelRight className="h-4 w-4" /></Button>
          {confetti && <Confetti />}
          {!done ? (
            <div className={`empty-workspace relative flex h-full flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-8 text-center md:px-8 ${phase === "running" ? "is-running" : ""}`}>
              <div className="relative">
                <div className="text-[10.5px] font-semibold uppercase text-primary">{phase === "running" ? "Drafting" : "New brief"}</div>
                <h1 className="mt-3 empty-title font-display text-[28px] font-normal leading-[1.1] md:text-[36px]">A clearer brief starts with better evidence.</h1>
                <p className="mx-auto mt-4 max-w-[480px] text-[14px] leading-[1.65] text-secondary-foreground">Add your specs, brand guidelines and retailer requirements. Every line of the brief will point back to its source.</p>
                <div className="mt-8"><Pipeline stage={stage} running={phase === "running"} /></div>
                {phase === "running" && (
                  <div className="mt-4 flex flex-col items-center gap-2 animate-pulse">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-mono text-xs text-muted-foreground">{thinkingText}</span>
                    <span className="text-[11px] text-muted-foreground/60">This takes ~2 minutes, please wait</span>
                  </div>
                )}
                {phase === "idle" && (
                  <div className="mt-8 flex justify-center gap-3">
                    <Button variant="plain" size="plain" onClick={() => fileInput.current?.click()} className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-4 text-[12px] text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />Add files</Button>
                    {files.length === 0 && (
                      <Button
                        variant="plain"
                        size="plain"
                        onClick={async () => {
                          try {
                            const res1 = await fetch("/content_sheet.xlsx");
                            const blob1 = await res1.blob();
                            const file1 = new File([blob1], "content_sheet.xlsx", {
                              type:
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            });

                            const res2 = await fetch("/carton.pdf");
                            const blob2 = await res2.blob();
                            const file2 = new File([blob2], "carton.pdf", {
                              type: "application/pdf",
                            });

                            addFiles([
                              {
                                name: file1.name,
                                type: "xlsx",
                                meta: `${Math.round(file1.size / 1024)} KB`,
                                file: file1,
                              },
                              {
                                name: file2.name,
                                type: "pdf",
                                meta: `${Math.round(file2.size / 1024)} KB`,
                                file: file2,
                              },
                            ]);
                            toast("ok", "Sample sources loaded");
                          } catch (err) {
                            toast("err", "Failed to load sample files");
                          }
                        }}
                        className="rounded-md px-3 py-1.5 text-sm text-primary hover:bg-primary/5"
                      >
                        Use sample sources
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {phase === "running" && <DraftSkeleton />}
            </div>
          ) : (
            <div className="nice-scroll edge-fade h-full overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:px-8 min-[1201px]:px-10">
                {brief ? (
                  <>
                    <div className="fade-up text-[10.5px] font-semibold uppercase text-primary">Working Draft · v0.3</div>
                    <h1 className="fade-up mt-2 brief-title font-display text-[28px] font-normal leading-[1.15] md:text-[36px]">{brief.title}</h1>
                    <div className="mt-4 h-0.5 w-8 bg-primary" />
                    <div className="mt-4 flex gap-4 font-mono text-[10.5px] text-muted-foreground"><span><AnimatedCount value={brief.sections.length} /> sections</span><span><AnimatedCount value={facts.length} /> facts</span></div>
                    {brief.sections.map((section, sectionIndex) => {
                      const sectionFacts = facts.filter((f) => section.fact_ids.includes(f.id));
                      const confidence = section.confidence === "high" ? 94 : section.confidence === "medium" ? 82 : 70;
                      return (
                        <section key={section.title} className="fade-up brief-section mt-7 rounded-xl border border-border bg-card p-5" style={{ animationDelay: `${60 + sectionIndex * 60}ms` }}>
                          <div className="flex items-start justify-between gap-4">
                            <h2 className="text-[15px] font-semibold leading-[1.15]"><span className="mr-2 font-mono text-[13px] text-primary">{sectionIndex + 1}.</span>{section.title}</h2>
                            <Pill v={confidence} />
                          </div>
                          <p className="mt-3 text-[14px] leading-[1.65] text-secondary-foreground">{section.content}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {sectionFacts.map((fact) => {
                              const file = fact.sources?.[0] ?? "source";
                              const isXlsx = file.endsWith(".xlsx") || file.endsWith(".xls");
                              return (
                                <Chip key={fact.id} c={{ id: fact.id, file, type: isXlsx ? "xlsx" : "pdf" as const, loc: "p.1", line: "", snippet: fact.value }} />
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                    <div className="fade-up mt-6 grid gap-4 md:grid-cols-2" style={{ animationDelay: "180ms" }}>
                      <div className="rounded-xl border border-border bg-warning-soft p-5">
                        <h3 className="text-sm font-semibold">Uncertainty</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-foreground/80">
                          {brief.uncertainty.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-5">
                        <h3 className="text-sm font-semibold">Open Questions for Agency</h3>
                        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-foreground/80">
                          {brief.open_questions.map((item, i) => <li key={i}>{item}</li>)}
                        </ol>
                      </div>
                    </div>
                    <div className="fade-up mt-8 flex gap-2 pb-6" style={{ animationDelay: "240ms" }}>
                      {["Export PDF", "Export DOCX"].map((l) => <Button variant="plain" size="plain" key={l} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"><Download className="h-4 w-4" />{l}</Button>)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="fade-up text-[10.5px] font-semibold uppercase text-primary">Working Draft · v0.3</div>
                    <h1 className="fade-up mt-2 brief-title font-display text-[28px] font-normal leading-[1.15] md:text-[36px]">Draft Brief</h1>
                    <div className="mt-4 h-0.5 w-8 bg-primary" />
                    <div className="mt-4 flex gap-4 font-mono text-[10.5px] text-muted-foreground"><span>0 sections</span><span>0 facts</span></div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>

        {evidenceOpen && <div onClick={() => setEvidenceOpen(false)} className="absolute inset-0 z-20 hidden bg-foreground/20 md:block min-[1025px]:hidden" />}
        <aside aria-label="Evidence panel" className={`nice-scroll evidence-sidebar w-full min-h-0 shrink-0 overflow-y-auto border-l border-border bg-sidebar p-5 md:absolute md:inset-y-0 md:right-0 md:z-30 md:w-[340px] min-[1025px]:static min-[1025px]:block min-[1025px]:w-[300px] min-[1201px]:w-[340px] ${mobilePanel === "evidence" ? "block" : "hidden"} ${evidenceOpen ? "md:block" : "md:hidden"}`}>
          <div className="flex items-center justify-between"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</h3><Button variant="plain" size="plain" aria-label="Close evidence" onClick={() => setEvidenceOpen(false)} className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:flex min-[1025px]:hidden"><X className="h-4 w-4" /></Button></div>
          {!sel ? (
            <div className="mt-16 flex flex-col items-center text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Search className="h-4 w-4 text-muted-foreground" /></div>
              <p className="mt-3 max-w-[220px] text-[13px] text-muted-foreground">Select a citation in the brief to inspect the exact supporting source.</p>
            </div>
          ) : (
            <div key={sel.id} className="fade-up mt-4">
              <div className="source-reference flex items-center gap-2 text-[12.5px] font-medium"><FileIcon type={sel.type} className="h-4 w-4" /><span className="min-w-0 flex-1 truncate" title={sel.file}>{sel.file}</span><CopySource file={sel.file} onCopy={copied} /></div>
              <div className="mt-3 rounded-lg border border-border bg-muted p-4 text-[13.5px] leading-relaxed">
                <mark className="rounded bg-primary/15 px-0.5 text-foreground">{sel.snippet}</mark>
              </div>
              <div className="source-reference mt-4 flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground"><span className="min-w-0 break-words">Source file: {sel.file} · {sel.line}</span><CopySource file={sel.file} onCopy={copied} /></div>
              <a href="#" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">Open full source <ArrowUpRight className="h-3.5 w-3.5" /></a>
            </div>
          )}
        </aside>
      </div>

      <nav aria-label="Workspace panels" className="mobile-tab-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-card md:hidden">
        {(["brief", "sources", "evidence"] as const).map((panel) => {
          const Icon = panel === "brief" ? FileText : panel === "sources" ? FileSpreadsheet : Search;
          return <Button key={panel} variant="plain" size="plain" aria-current={mobilePanel === panel ? "page" : undefined} onClick={() => setMobilePanel(panel)} className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium hover:bg-muted ${mobilePanel === panel ? "text-primary" : "text-muted-foreground"}`}><Icon className="h-4 w-4" /><span>{panel === "brief" ? "Brief" : panel === "sources" ? "Sources" : "Evidence"}</span></Button>;
        })}
      </nav>

      {toasts[0] && (
        <div key={toasts[0].id} className="workspace-toast toast-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] shadow-lg ${toasts[0].kind === "ok" ? "border-border bg-card" : "border-danger/20 bg-danger-soft text-danger"}`}>
            {toasts[0].kind === "ok" ? <Check className="h-4 w-4 text-primary" /> : <AlertCircle className="h-4 w-4" />}
            {toasts[0].text}
          </div>
        </div>
      )}

      <BriefCommands open={commandsOpen} onOpenChange={setCommandsOpen} onAdd={() => fileInput.current?.click()} onGenerate={generate} onReset={reset} onSound={() => setSound((v) => !v)} onJessy={() => setJessyOpen(true)} canGenerate={files.length > 0 && phase !== "running"} canReset={done} />
      <Jessy open={jessyOpen} onOpenChange={setJessyOpen} messages={msgs} thinking={thinking} thinkingText={thinkingText} activity={activity}
        active={phase === "running" || thinking} sparkle={sparkle} onSend={onSend} />
    </div>
  );
}
