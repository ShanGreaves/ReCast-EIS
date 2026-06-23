// ============================================================================
// ReCast EIS — App (UI layer)
//
// This file is PURELY presentational.
// All state, transitions, and analysis logic live in src/app/store/.
// Components call useEISStore() directly — zero prop drilling.
// ============================================================================

import { useEffect, useState } from "react";
import {
  Eye,
  Lock,
  RefreshCw,
  Send,
  Settings,
  Unlock,
  Wrench,
  X,
} from "lucide-react";
//import { motion, AnimatePresence } from "motion/react";

import { useEISStore } from "./store/useEISStore";
import type { Stage } from "./store/types";
import { detectCogLevel } from "./store/analysis";

// ════════════════════════════════════════════════════════════════════════════
// UI CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const C = {
  evidence:    { header: "#4d7a30", light: "#eaf2e3", border: "#5a8a3a", text: "#3d6025", chip: "#d8edcc" },
  importance:  { header: "#536B96", light: "#e8edf7", border: "#6a82b0", text: "#3a5080", chip: "#ccd5ea" },
  significance:{ header: "#b87018", light: "#f8eddb", border: "#d08820", text: "#9a5e10", chip: "#f5ddb0" },
};

const STAGE_META: Record<Stage, { label: string; abbr: string; color: typeof C.evidence; frameLabel: string }> = {
  evidence:    { label: "Evidence",    abbr: "E", color: C.evidence,    frameLabel: "Frame"  },
  importance:  { label: "Importance",  abbr: "I", color: C.importance,  frameLabel: "Build"  },
  significance:{ label: "Significance",abbr: "S", color: C.significance,frameLabel: "Reveal" },
};

const CTAG_META: Record<CTagKey, { label: string; full: string; color: string }> = {
  RP:  { label: "RP",  full: "Report Paraphrase",           color: "#2a579a" },
  RE:  { label: "RE",  full: "Reflective Evidence",          color: "#7a4590" },
  FP:  { label: "FP",  full: "Focus Paraphrase",             color: "#b87018" },
  AC:  { label: "AC",  full: "Analytical Commentary",        color: "#4d7a30" },
  RFC: { label: "RFC", full: "Reflective/Focused Commentary",color: "#1a6060" },
};

const COG_CFG: Record<CogLevel, { bg: string; border: string; label: string; textColor: string }> = {
  frame:   { bg: "#e8edf7", border: "#536B96", label: "Frame",  textColor: "#3a5080" },
  build:   { bg: "#eaf2e3", border: "#4d7a30", label: "Build",  textColor: "#3d6025" },
  reveal:  { bg: "#f8eddb", border: "#b87018", label: "Reveal", textColor: "#9a5e10" },
  neutral: { bg: "#fafaf7", border: "#e0d8c8", label: "",       textColor: "#4a4030" },
};

const STARTERS: Record<Stage, string[]> = {
  evidence:    ["The text states that...", "According to the source...", "One example of this is...", "The evidence shows that...", "In the passage, it says...", "This is demonstrated when..."],
  importance:  ["This matters because it leads to...", "This is important because it causes...", "As a result, this changes...", "This shows the impact of...", "This matters in context because...", "This affects..."],
  significance:["This reveals that...", "This suggests a larger idea about...", "This shows that in society/history...", "This reflects a broader pattern of...", "This helps us understand...", "This implies that..."],
};

const CQS: Record<Stage, string[]> = {
  evidence:    ["What do you actually see in the text?", "What is happening literally?", "What details are clearly stated?", "What would someone else also notice?"],
  importance:  ["What changes because of this?", "What does this affect or influence?", "Why would the author include this detail?", "What happens as a result?"],
  significance:["What does this reveal about people or society?", "What pattern does this connect to?", "Why does this matter beyond this example?", "What deeper idea is being shown?"],
};

const REBUILD_PROMPTS = [
  "What is the simplest version of this idea in your own words?",
  "Say it without using any of the same words as the source.",
  "What would you tell a friend who had not read the text?",
  "What did the author actually do, show, or describe — not what it means?",
  "Reduce it to one short sentence you could say out loud right now.",
];

const BRIDGE_PROMPTS = [
  "What does this detail do — what does it cause or change?",
  "What changes because of what you just described?",
  "Why would the author or source include this specific detail?",
  "Who or what is affected by the evidence you stated?",
  "What happens next, as a direct result?",
];

const MASTER_ESSAY = {
  eq: "How did organized nonviolent protest reshape the political landscape of the United States during the Civil Rights Movement?",
  thesis: "By using nonviolent direct action, civil rights activists exposed the contradictions of American democracy, created unavoidable moral pressure on the federal government, and permanently transformed the nation's understanding of citizenship and justice.",
  paragraphs: [
    { id: "p1", topic: "Bloody Sunday — Edmund Pettus Bridge",
      e: { text: "On March 7, 1965, approximately 600 civil rights marchers began crossing the Edmund Pettus Bridge in Selma, Alabama, where Alabama state troopers attacked them with clubs and tear gas.", tag: "RP" },
      i: { text: "This violent attack was broadcast on national television that evening, causing public outrage that placed direct pressure on President Johnson to address Congress calling for voting rights legislation.", tag: "AC" },
      s: { text: "This reveals that nonviolent protest functions as a strategic exposure mechanism — by refusing to respond with violence, marchers forced the state's violence into public view, making invisible systems of oppression suddenly impossible to deny.", tag: "RFC" },
    },
    { id: "p2", topic: "Montgomery Bus Boycott — Economic Pressure",
      e: { text: "Following Rosa Parks' arrest on December 1, 1955, the Black community of Montgomery, Alabama organized a 381-day boycott of the city's bus system.", tag: "RP" },
      i: { text: "The boycott caused the Montgomery bus company to lose approximately 70 percent of its ridership, forcing city officials to negotiate and ultimately resulting in a Supreme Court ruling that bus segregation was unconstitutional.", tag: "AC" },
      s: { text: "This suggests that economic pressure, not just moral argument, was essential to dismantling segregation — revealing that systemic injustice often requires systemic disruption before those who benefit from it will respond.", tag: "RFC" },
    },
    { id: "p3", topic: "Greensboro Sit-Ins — Replicable Resistance",
      e: { text: "On February 1, 1960, four Black college students from North Carolina A&T sat down at a Woolworth's lunch counter in Greensboro and refused to leave when denied service.", tag: "RP" },
      i: { text: "Their action inspired over 50,000 students across the South to stage similar sit-ins within months, creating a nationwide movement that directly led to Woolworth's desegregating its lunch counters in July 1960.", tag: "AC" },
      s: { text: "This demonstrates that individual acts of nonviolent resistance carry a replicable cognitive clarity — they make the logic of resistance visible and transferable, showing others exactly how defiance can be enacted without violence.", tag: "RFC" },
    },
  ],
};

// ════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function StarterChip({ text, color, onInsert }: { text: string; color: typeof C.evidence; onInsert: (t: string) => void }) {
  return (
    <button type="button" onClick={() => onInsert(text)}
      className="text-left text-[11px] px-2.5 py-1.5 rounded-full border transition-all hover:brightness-95 active:scale-95"
      style={{ backgroundColor: color.chip, borderColor: color.border, color: color.text }}>
      {text}
    </button>
  );
}

function CustomAdder({ type, color, onInsert, onAdd }: { type: "starter" | "question"; color: typeof C.evidence; onInsert?: (t: string) => void; onAdd: (t: string) => void }) {
  const [value, setValue] = useState("");
  const doInsert = () => { if (!value.trim() || !onInsert) return; onInsert(value.trim()); setValue(""); };
  const doAdd = () => { if (!value.trim()) return; onAdd(value.trim()); setValue(""); };
  return (
    <div className="mt-2.5 pt-2.5 border-t" style={{ borderColor: color.border + "55" }}>
      <p className="text-[10px] font-bold mb-1.5" style={{ color: color.text }}>{type === "starter" ? "Type your own starter:" : "Type your own question:"}</p>
      <div className="flex gap-1.5">
        <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") type === "starter" ? doInsert() : doAdd(); }} placeholder={type === "starter" ? "e.g. According to my research..." : "e.g. What does this remind you of?"} className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: color.border, backgroundColor: "white", color: "#2a2010" }} />
        {type === "starter" && <button onClick={doInsert} disabled={!value.trim()} className="whitespace-nowrap rounded-lg border-2 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-30" style={{ borderColor: color.border, color: color.header, backgroundColor: color.chip }}>Insert</button>}
        <button onClick={doAdd} disabled={!value.trim()} className="whitespace-nowrap rounded-lg border-2 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-30" style={{ borderColor: color.border, color: color.header, backgroundColor: color.chip }}>+ Save</button>
      </div>
    </div>
  );
}

function CQList({ questions, color }: { questions: string[]; color: typeof C.evidence }) {
  return (
    <ul className="space-y-1.5">
      {questions.map((q) => (
        <li key={q} className="flex items-start gap-1.5 text-xs leading-snug" style={{ color: color.text }}>
          <span className="shrink-0 mt-0.5" style={{ color: color.header }}>•</span>
          <span>"{q}"</span>
        </li>
      ))}
    </ul>
  );
}

function FeedbackCard({ status, message, tag, label }: { status: string; message: string; tag?: string; label: string }) {
  if (status === "empty" || !message) return null;
  const cfg = ({
    good:    { bg: "#f2f9ed", border: "#8ab870", icon: "✓", accent: "#4d7a30" },
    caution: { bg: "#fef9ec", border: "#ddb850", icon: "⚠", accent: "#9a6510" },
    error:   { bg: "#fef2f2", border: "#e09090", icon: "✗", accent: "#b83030" },
  } as Record<string, { bg: string; border: string; icon: string; accent: string }>)[status];
  if (!cfg) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border px-3 py-2.5" style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-start gap-2">
        <span className="font-bold shrink-0 mt-0.5" style={{ color: cfg.accent }}>{cfg.icon}</span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cfg.accent }}>{label}</p>
          <p className="text-xs leading-snug mt-0.5" style={{ color: cfg.accent }}>{message}</p>
          {tag && <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: cfg.border + "35", color: cfg.accent }}>{tag}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function CognitiveBadge({ tag }: { tag: CTagKey }) {
  const t = CTAG_META[tag];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border" style={{ borderColor: t.color + "60", backgroundColor: t.color + "15", color: t.color }}>
      {t.label} <span className="font-normal opacity-75">— {t.full}</span>
    </span>
  );
}

function FailurePanel({ type, onDismiss }: { type: "paraphrase" | "bridge"; onDismiss: () => void }) {
  const configs = {
    paraphrase: { headline: "You are still too close to the source. Let's slow this down.", sub: "Work through one of these thinking prompts before rewriting:", prompts: REBUILD_PROMPTS, color: "#3a5080", bg: "#e8edf7", border: "#6a82b0" },
    bridge:     { headline: "You have your Evidence. Now move toward Importance.", sub: "Use one of these questions to get started:", prompts: BRIDGE_PROMPTS, color: "#4d7a30", bg: "#eaf2e3", border: "#8ab870" },
  };
  const cfg = configs[type];
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border-2 p-4 space-y-3" style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold leading-snug" style={{ color: cfg.color }}>{cfg.headline}</p>
          <p className="text-[11px] mt-1 font-semibold opacity-80" style={{ color: cfg.color }}>{cfg.sub}</p>
        </div>
        <button onClick={onDismiss} style={{ color: cfg.color }}><X className="size-3.5" /></button>
      </div>
      <ol className="space-y-1.5">
        {cfg.prompts.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] font-semibold" style={{ color: cfg.color }}>
            <span className="shrink-0 size-4 flex items-center justify-center rounded-full border font-bold text-[9px]" style={{ borderColor: cfg.border, color: cfg.color }}>{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SID WIDGET — reads directly from store
// ════════════════════════════════════════════════════════════════════════════

function SIDWidget({ sidChecking }: { sidChecking: boolean }) {
  const { sidState, sidReason, sidSignals, csLevel, sourceText, setSourceText } = useEISStore();
  const [showSource, setShowSource] = useState(false);

  const REASON_LABELS: Record<string, string> = {
    "patchwriting":      "Patchwriting pattern — sentence reads as edited copy",
    "structural-mirror": "Structural mirroring — same clause order and phrasing",
    "lexical-overlap":   "Lexical overlap — too many shared content words",
  };

  const STATUS_CFG: Record<string, { icon: string; color: string; bg: string; border: string; headline: string; message: string }> = {
    clear:       { icon: "✓", color: "#4d7a30", bg: "#f2f9ed", border: "#8ab870", headline: "RP — Paraphrase Accepted", message: "Good paraphrase. Meaning is clearly expressed in your own structure. Importance is now unlocked." },
    "too-close": { icon: "✗", color: "#b83030", bg: "#fef2f2", border: "#e09090", headline: "RP Failure — Transformation Required", message: "This is too close to the original source. ReCast requires you to express the idea in your own structure before moving to Build." },
    quote:       { icon: "⚠", color: "#9a5e10", bg: "#fef9ec", border: "#ddb850", headline: "Direct Quote — Citation Required", message: "Quotation detected. You will be directed to the citation form." },
    cited:       { icon: "✓", color: "#2a579a", bg: "#e8edf7", border: "#6a82b0", headline: "Citation Accepted — Proceed to Build", message: "Quote accepted and citation recorded. Importance is now unlocked." },
  };

  const cfg = sidState !== "idle" ? STATUS_CFG[sidState] : null;

  return (
    <div className="rounded-xl border border-[#b0bac8] bg-[#f4f6f8] overflow-hidden">
      <div className="px-3.5 py-2 flex items-center justify-between bg-[#3a4a58]">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#536B96] px-1.5 py-0.5 text-[9px] font-bold text-white">SID</span>
          <span className="text-white text-xs font-bold">Source Integrity Check</span>
          <span className="hidden sm:inline rounded-full border border-white/20 px-2 py-0.5 text-[9px] font-bold text-white/60">{CS_LEVELS[csLevel].sidLabel}</span>
        </div>
        <button onClick={() => setShowSource((v) => !v)} className="flex items-center gap-1 text-[10px] font-bold text-white/55 hover:text-white transition-colors">
          {showSource ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {showSource ? "Hide source" : "Paste source"}
        </button>
      </div>

      <AnimatePresence>
        {showSource && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-[#c8d0d8]">
            <div className="p-3">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#5a6a78] mb-1.5">Original source text — paraphrase comparison only</label>
              <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={3} placeholder="Paste the original passage or excerpt..." className="w-full rounded-lg border border-[#b0bac4] bg-white px-3 py-2 text-xs leading-relaxed text-[#2a2010] placeholder-[#9aa8b4] resize-none outline-none focus:border-[#536B96] transition-colors" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 space-y-2">
        {sidChecking && (
          <div className="flex items-center gap-2 rounded-lg bg-[#eef0f4] px-3 py-2">
            <div className="flex gap-0.5">
              {[0,1,2].map((i) => <motion.div key={i} className="size-1.5 rounded-full bg-[#536B96]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />)}
            </div>
            <span className="text-[11px] font-semibold text-[#536B96]">Checking source transformation...</span>
          </div>
        )}
        {!sidChecking && sidState === "idle" && (
          <p className="text-[11px] text-[#7a8898] font-semibold px-1">
            {sourceText.trim() ? "Write your Evidence above — paraphrase quality will be evaluated automatically." : "Paste source text above to enable paraphrase checking, or use quotation marks for a direct quote."}
          </p>
        )}
        {!sidChecking && cfg && (
          <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border px-3 py-2.5" style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
            <div className="flex items-start gap-2">
              <span className="font-bold shrink-0 mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>{cfg.headline}</p>
                <p className="text-[11px] leading-snug mt-0.5" style={{ color: cfg.color }}>{cfg.message}</p>
                {sidState === "too-close" && sidReason && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold text-[#b83030]">Signal: {REASON_LABELS[sidReason] ?? sidReason}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ label: "Lexical", val: sidSignals.lexical, thr: CS_LEVELS[csLevel].lexThreshold }, { label: "Structural", val: sidSignals.structural, thr: CS_LEVELS[csLevel].bigramThreshold }, { label: "Patchwriting", val: sidSignals.patchwriting, thr: CS_LEVELS[csLevel].trigramThreshold }].map(({ label, val, thr }) => (
                        <span key={label} className="text-[9px] font-bold rounded-full px-2 py-0.5" style={{ backgroundColor: val > thr ? "#f0c8c8" : "#f0f0f0", color: val > thr ? "#b83030" : "#6a6a6a" }}>
                          {label}: {Math.round(val * 100)}% {val > thr ? "↑" : "✓"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEACHER PANEL
// ════════════════════════════════════════════════════════════════════════════

function TeacherPanel({ onOpenModeling, onOpenEssay, onClose }: { onOpenModeling: () => void; onOpenEssay: () => void; onClose: () => void }) {
  const { teacherMode, setTeacherMode, csLevel, setCsLevel, interventionUnlocked, setIntervention, scaffoldPrompts, setScaffold } = useEISStore();
  const stages: Stage[] = ["evidence", "importance", "significance"];
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border-2 border-[#d0c8b0] bg-white shadow-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      <div className="bg-[#2c2c18] px-4 py-3 flex items-center justify-between sticky top-0">
        <span className="text-[#d4cc98] text-sm font-bold">Teacher Controls</span>
        <button onClick={onClose} className="text-[#7a7250] hover:text-[#d4cc98] transition"><X className="size-4" /></button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a7a58] mb-2">View Mode</p>
          <div className="grid grid-cols-3 gap-1.5">
            {([["student", "Student", BookOpen], ["diagnostic", "Diagnostic", Eye], ["intervention", "Intervention", Wrench]] as [typeof teacherMode, string, typeof BookOpen][]).map(([m, label, Icon]) => (
              <button key={m} onClick={() => setTeacherMode(m)} className="flex flex-col items-center gap-1 rounded-xl border-2 py-2 text-[10px] font-bold transition-all"
                style={teacherMode === m ? { borderColor: "#4d7a30", backgroundColor: "#eaf2e3", color: "#4d7a30" } : { borderColor: "#d8d0b8", color: "#8a7a58" }}>
                <Icon className="size-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { onOpenModeling(); onClose(); }} className="flex flex-col items-center gap-1 rounded-xl border-2 border-[#3a4a58] bg-[#f4f6f8] py-2.5 text-[10px] font-bold text-[#3a4a58] hover:bg-[#e8edf7] transition"><Eye className="size-4" /> Live Modeling</button>
          <button onClick={() => { onOpenEssay(); onClose(); }} className="flex flex-col items-center gap-1 rounded-xl border-2 border-[#4d7a30] bg-[#f4f6f8] py-2.5 text-[10px] font-bold text-[#4d7a30] hover:bg-[#eaf2e3] transition"><BookOpen className="size-4" /> Demo Essay</button>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a7a58] mb-2">SID Strictness — CS Level</p>
          <div className="space-y-1.5">
            {(Object.entries(CS_LEVELS) as [typeof csLevel, typeof CS_LEVELS.CS8][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setCsLevel(key)} className="w-full flex items-center justify-between rounded-lg border-2 px-3 py-2 text-xs text-left transition-all"
                style={csLevel === key ? { borderColor: "#536B96", backgroundColor: "#e8edf7", color: "#3a5080" } : { borderColor: "#d8d0b8", color: "#8a7a58" }}>
                <span className="font-bold">{cfg.label}</span>
                <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${csLevel === key ? "bg-[#536B96] text-white" : "bg-[#e8e4dc] text-[#8a7a58]"}`}>{cfg.sidLabel}</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-[#8a7a58]">{CS_LEVELS[csLevel].description}</p>
        </div>
        {teacherMode === "intervention" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#4a4030]">Unlock all fields</p>
              <button onClick={() => setIntervention(!interventionUnlocked)} className={`size-9 rounded-full border-2 flex items-center justify-center transition-all ${interventionUnlocked ? "border-[#4d7a30] bg-[#eaf2e3] text-[#4d7a30]" : "border-[#d8d0b8] text-[#8a7a58]"}`}>
                {interventionUnlocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
              </button>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a7a58] mb-2">Scaffold Prompts</p>
              {stages.map((s) => (
                <div key={s} className="mb-2">
                  <label className="text-[10px] font-bold mb-1 block" style={{ color: STAGE_META[s].color.text }}>{STAGE_META[s].label}:</label>
                  <input value={scaffoldPrompts[s]} onChange={(e) => setScaffold(s, e.target.value)} placeholder={`Insert ${STAGE_META[s].label} hint...`} className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: STAGE_META[s].color.border }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODELING OVERLAY + MASTER ESSAY
// ════════════════════════════════════════════════════════════════════════════

function ThinkingTrace({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-[11px] text-[#9aa0a8] italic px-1">Thinking trace will appear as you write...</p>;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
  return (
    <div className="space-y-1.5">
      {sentences.map((sentence, i) => {
        const level = detectCogLevel(sentence); const cfg = COG_CFG[level];
        return (
          <div key={i} className="flex items-start gap-2 rounded-lg border-l-4 px-3 py-2" style={{ backgroundColor: cfg.bg, borderLeftColor: cfg.border }}>
            {cfg.label && <span className="mt-px shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: cfg.border + "28", color: cfg.textColor }}>{cfg.label}</span>}
            <p className="text-xs leading-snug" style={{ color: cfg.textColor }}>{sentence}</p>
          </div>
        );
      })}
    </div>
  );
}

function ModelingOverlay({ onClose }: { onClose: () => void }) {
  const [mE, setME] = useState(""); const [mI, setMI] = useState(""); const [mS, setMS] = useState("");
  const [active, setActive] = useState<Stage>("evidence");
  const stageData = [
    { stage: "evidence"    as Stage, label: "E — Evidence (Frame)",      value: mE, setter: setME, placeholder: "Model evidence entry..." },
    { stage: "importance"  as Stage, label: "I — Importance (Build)",    value: mI, setter: setMI, placeholder: "Model importance entry..." },
    { stage: "significance"as Stage, label: "S — Significance (Reveal)", value: mS, setter: setMS, placeholder: "Model significance entry..." },
  ];
  const current = stageData.find((d) => d.stage === active)!;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "rgba(20,24,32,0.96)", backdropFilter: "blur(4px)" }}>
      <div className="bg-[#2c2c18] px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-[#d4cc98] text-sm font-bold">Live EIS Modeling — Thinking Trace Visualizer</span>
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-full border border-[#5a5438] px-3 py-1.5 text-[11px] font-bold text-[#d4cc98] hover:bg-[#3a3820] transition"><X className="size-3.5" /> Close</button>
      </div>
      <div className="flex gap-px bg-[#1a1a10] shrink-0">
        {stageData.map(({ stage, label }) => (
          <button key={stage} onClick={() => setActive(stage)} className="flex-1 py-2.5 text-xs font-bold transition-all"
            style={active === stage ? { backgroundColor: STAGE_META[stage].color.header, color: "#fff" } : { backgroundColor: "#2c2c1a", color: "#8a7a58" }}>{label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6 grid md:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: STAGE_META[active].color.border }}>Teacher writes</p>
          <textarea value={current.value} onChange={(e) => current.setter(e.target.value)} rows={10} placeholder={current.placeholder} autoFocus
            className="w-full rounded-xl border-2 px-4 py-3 text-sm leading-relaxed bg-[#1a1e28] text-[#e8dfc8] placeholder-[#4a5060] resize-none outline-none"
            style={{ borderColor: STAGE_META[active].color.border }} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a7250] mb-2">Thinking Trace</p>
          <div className="rounded-xl border border-[#3a3820] bg-[#1a1e28] p-4 min-h-[200px]"><ThinkingTrace text={current.value} /></div>
        </div>
      </div>
    </motion.div>
  );
}

function MasterEssayPanel({ onClose }: { onClose: () => void }) {
  const [activeP, setActiveP] = useState(0);
  const para = MASTER_ESSAY.paragraphs[activeP];
  const tagColors: Record<string, string> = { RP: "#536B96", AC: "#4d7a30", RFC: "#b87018" };
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-2xl border-2 border-[#3a4a58] bg-white overflow-hidden shadow-xl">
      <div className="bg-[#3a4a58] px-5 py-3 flex items-center justify-between">
        <span className="text-white text-xs font-bold uppercase tracking-wide">CS8 Master Demo Essay — Single-Spine Model</span>
        <button onClick={onClose} className="text-white/50 hover:text-white transition"><X className="size-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        <div className="rounded-lg bg-[#f4f6f8] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#5a6a78] mb-1">Essential Question</p><p className="text-xs font-semibold text-[#2a3a4a]">{MASTER_ESSAY.eq}</p></div>
        <div className="rounded-lg bg-[#eaf2e3] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#3d6025] mb-1">Thesis</p><p className="text-xs font-semibold text-[#2a3a1a]">{MASTER_ESSAY.thesis}</p></div>
        <div className="flex gap-1.5">
          {MASTER_ESSAY.paragraphs.map((p, i) => (
            <button key={p.id} onClick={() => setActiveP(i)} className="flex-1 rounded-lg border-2 py-1.5 text-[10px] font-bold transition-all"
              style={activeP === i ? { borderColor: "#3a4a58", backgroundColor: "#e8edf7", color: "#3a4a58" } : { borderColor: "#d8d0b8", color: "#8a7a58" }}>Para {i + 1}</button>
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a7a58]">{para.topic}</p>
        {([["E", para.e], ["I", para.i], ["S", para.s]] as [string, { text: string; tag: string }][]).map(([letter, data]) => (
          <div key={letter} className="rounded-lg border border-[#e0d8c8] bg-[#fafaf7] px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: ({ E: "#4d7a30", I: "#536B96", S: "#b87018" } as Record<string, string>)[letter] }}>{letter}</span>
              <span className="text-[9px] font-bold rounded-full px-2 py-0.5" style={{ backgroundColor: (tagColors[data.tag] || "#aaa") + "20", color: tagColors[data.tag] || "#aaa" }}>{data.tag}</span>
            </div>
            <p className="text-[11px] leading-snug text-[#2a2010]">{data.text}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STATE VIEW COMPONENTS (each calls useEISStore() directly)
// ════════════════════════════════════════════════════════════════════════════

function StagePanel({ stage, children }: { stage: Stage; children: React.ReactNode }) {
  const meta = STAGE_META[stage];
  return (
    <div className="rounded-2xl border border-[#d0c8b0] shadow-sm overflow-hidden">
      <div className="px-5 py-3.5" style={{ backgroundColor: meta.color.header }}>
        <h2 className="text-white font-bold text-base"><span className="opacity-70 text-sm mr-2">{meta.frameLabel} Stage</span>{meta.abbr} — {meta.label}</h2>
      </div>
      {children}
    </div>
  );
}

function GuidancePanel({ stage }: { stage: Stage }) {
  const { scaffoldPrompts, teacherMode, customStarters, customCQs, addStarter, addCQ } = useEISStore();
  const meta = STAGE_META[stage];
  const onInsert = useEISStore.getState()[stage === "evidence" ? "setEvidence" : stage === "importance" ? "setCause" : "setReveals"];
  const currentVal = () => useEISStore.getState()[stage === "evidence" ? "evidence" : stage === "importance" ? "cause" : "reveals"];
  const append = (text: string) => { const cur = currentVal(); onInsert(cur ? cur + " " + text : text); };
  return (
    <div className="p-5 border-b md:border-b-0 md:border-r border-[#ddd8c8]" style={{ backgroundColor: meta.color.light }}>
      {scaffoldPrompts[stage] && teacherMode === "intervention" && <div className="mb-3 rounded-xl border-2 border-dashed px-3 py-2 text-xs font-semibold" style={{ borderColor: meta.color.border, color: meta.color.header, backgroundColor: "white" }}>Teacher: {scaffoldPrompts[stage]}</div>}
      <div className="mb-4">
        <p className="text-xs font-bold mb-2" style={{ color: meta.color.text }}>Clarifying Questions:</p>
        <CQList questions={[...CQS[stage], ...customCQs[stage]]} color={meta.color} />
        <CustomAdder type="question" color={meta.color} onAdd={(t) => addCQ(stage, t)} />
      </div>
      <div>
        <p className="text-xs font-bold mb-2" style={{ color: meta.color.text }}>Sentence starters — <span className="font-normal">click to insert</span></p>
        <div className="flex flex-wrap gap-1.5">{[...STARTERS[stage], ...customStarters[stage]].map((s) => <StarterChip key={s} text={s} color={meta.color} onInsert={append} />)}</div>
        <CustomAdder type="starter" color={meta.color} onInsert={append} onAdd={(t) => addStarter(stage, t)} />
      </div>
    </div>
  );
}

// ── FRAME ────────────────────────────────────────────────────────────────────
function FrameView({ sidChecking }: { sidChecking: boolean }) {
  const { evidence, setEvidence, sidState, sidPasses, advanceToBuild, showRecovery, dismissRecovery, interventionUnlocked } = useEISStore();
  const canAdvance = (sidPasses() || interventionUnlocked) && evidence.trim().length > 10;
  return (
    <motion.div key="FRAME" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <StagePanel stage="evidence">
        <div className="grid md:grid-cols-[2fr_3fr]">
          <GuidancePanel stage="evidence" />
          <div className="p-5 bg-white space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#4a4030] mb-2">Write one piece of evidence here:</label>
              <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={6} placeholder="The text states that..." className="w-full rounded-xl border-2 border-dashed border-[#c0b898] bg-white px-4 py-3 text-sm leading-relaxed text-[#2a2010] placeholder-[#c0b898] resize-none outline-none focus:border-[#8a7a58] transition-colors" />
            </div>
            <SIDWidget sidChecking={sidChecking} />
            <AnimatePresence>{showRecovery && <FailurePanel type="paraphrase" onDismiss={dismissRecovery} />}</AnimatePresence>
          </div>
        </div>
      </StagePanel>
      <motion.button onClick={advanceToBuild} disabled={!canAdvance} whileHover={canAdvance ? { y: -1 } : {}}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 text-base font-bold text-white transition-all disabled:opacity-35 disabled:cursor-not-allowed"
        style={{ backgroundColor: canAdvance ? C.importance.header : "#8a9ab0" }}>
        <ArrowRight className="size-5" />
        {canAdvance ? "Evidence complete — Continue to Importance"
          : sidState === "too-close" ? "Revise Evidence to pass Source Integrity Check"
          : "Complete your Evidence to continue"}
      </motion.button>
    </motion.div>
  );
}

// ── CITATION ─────────────────────────────────────────────────────────────────
function CitationView() {
  const { citation, setCitation, completeCitation, backToFrame } = useEISStore();
  const fields: { key: keyof typeof citation; label: string; placeholder: string; required?: boolean }[] = [
    { key: "exactQuote", label: "Exact quote text", placeholder: "Paste the exact words...", required: true },
    { key: "title", label: "Source title", placeholder: "e.g. The Great Gatsby...", required: true },
    { key: "author", label: "Author (if available)", placeholder: "e.g. F. Scott Fitzgerald" },
    { key: "locator", label: "Page / timestamp / URL", placeholder: "e.g. p.42, 2:14, https://...", required: true },
    { key: "contextNote", label: "Context note (optional)", placeholder: "e.g. Narrator describing the green light..." },
  ];
  const complete = !!citation.exactQuote.trim() && !!citation.title.trim() && !!citation.locator.trim();
  return (
    <motion.div key="CITATION" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="rounded-2xl border-2 border-[#6a82b0] bg-white overflow-hidden">
      <div className="px-5 py-4 bg-[#e8edf7] border-b border-[#c0c8d8]">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-[#536B96]">Citation Required — Frame Stage Gate</p>
        <h2 className="font-display text-xl text-[#3a5080] mt-1">Direct Quotation Detected</h2>
        <p className="text-xs text-[#536B96] mt-1 font-semibold">Complete the citation form to accept this evidence and unlock Importance.</p>
      </div>
      <div className="p-6 space-y-3">
        {fields.map(({ key, label, placeholder, required }) => (
          <div key={key}>
            <label className="block text-[11px] font-bold text-[#3a5080] mb-1">{label} {required && <span className="text-[#d03030]">*</span>}</label>
            {key === "exactQuote"
              ? <textarea value={citation[key]} onChange={(e) => setCitation({ ...citation, [key]: e.target.value })} rows={3} placeholder={placeholder} className="w-full rounded-lg border-2 border-dashed border-[#6a82b0] bg-white px-3 py-2 text-xs text-[#2a2010] resize-none outline-none focus:border-[#3a5080]" />
              : <input value={citation[key]} onChange={(e) => setCitation({ ...citation, [key]: e.target.value })} placeholder={placeholder} className="w-full rounded-lg border border-[#6a82b0] bg-white px-3 py-2 text-xs text-[#2a2010] outline-none focus:border-[#3a5080]" />}
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button onClick={backToFrame} className="rounded-lg border-2 border-[#d8d0b8] px-4 py-2 text-xs font-bold text-[#8a7a58] hover:border-[#b0a888] transition">← Back to Evidence</button>
          <button onClick={completeCitation} disabled={!complete} className="flex-1 rounded-lg py-2 text-xs font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5" style={{ backgroundColor: C.importance.header }}>
            {complete ? "Accept citation — continue to Importance →" : "Complete required fields to continue"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── BUILD ─────────────────────────────────────────────────────────────────────
function BuildView() {
  const { cause, setCause, effect, setEffect, evidence, interventionUnlocked, advanceToReveal } = useEISStore();
  const hasContent = (cause + effect).trim().length > 8;
  const canAdvance = hasContent || interventionUnlocked;
  return (
    <motion.div key="BUILD" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <div className="rounded-xl border border-[#e0d8c8] bg-white px-5 py-3">
        <p className="text-xs font-semibold text-[#4a4030]"><strong>Evidence accepted.</strong> Now explain what it causes or changes. Do NOT jump to significance yet.</p>
      </div>
      <StagePanel stage="importance">
        <div className="grid md:grid-cols-[2fr_3fr]">
          <GuidancePanel stage="importance" />
          <div className="p-5 bg-white space-y-4">
            <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Explain the cause:</label><textarea value={cause} onChange={(e) => setCause(e.target.value)} rows={4} placeholder="This matters because it leads to..." className="w-full rounded-xl border-2 border-dashed border-[#c0b898] bg-white px-4 py-3 text-sm leading-relaxed text-[#2a2010] placeholder-[#c0b898] resize-none outline-none focus:border-[#8a7a58] transition-colors" /></div>
            <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Explain the effect:</label><textarea value={effect} onChange={(e) => setEffect(e.target.value)} rows={4} placeholder="As a result, this changes..." className="w-full rounded-xl border-2 border-dashed border-[#c0b898] bg-white px-4 py-3 text-sm leading-relaxed text-[#2a2010] placeholder-[#c0b898] resize-none outline-none focus:border-[#8a7a58] transition-colors" /></div>
          </div>
        </div>
      </StagePanel>
      <motion.button onClick={advanceToReveal} disabled={!canAdvance} whileHover={canAdvance ? { y: -1 } : {}}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 text-base font-bold text-white transition-all disabled:opacity-35 disabled:cursor-not-allowed"
        style={{ backgroundColor: canAdvance ? C.significance.header : "#8a9ab0" }}>
        <ArrowRight className="size-5" />{canAdvance ? "Importance complete — Continue to Significance" : "Write your Importance to continue"}
      </motion.button>
    </motion.div>
  );
}

// ── REVEAL ────────────────────────────────────────────────────────────────────
function RevealView() {
  const { reveals, setReveals, matters, setMatters, evidence, cause, effect, interventionUnlocked, submit } = useEISStore();
  const hasContent = (reveals + matters).trim().length > 8;
  const canSubmit = (hasContent && evidence.trim().length > 8 && (cause + effect).trim().length > 8) || interventionUnlocked;
  return (
    <motion.div key="REVEAL" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <div className="rounded-xl border border-[#e0d8c8] bg-white px-5 py-3">
        <p className="text-xs font-semibold text-[#4a4030]"><strong>Importance accepted.</strong> Now interpret what the evidence reveals about a larger idea, pattern, or theme.</p>
      </div>
      <StagePanel stage="significance">
        <div className="grid md:grid-cols-[2fr_3fr]">
          <GuidancePanel stage="significance" />
          <div className="p-5 bg-white space-y-4">
            <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Explain what this reveals:</label><textarea value={reveals} onChange={(e) => setReveals(e.target.value)} rows={4} placeholder="This reveals that..." className="w-full rounded-xl border-2 border-dashed border-[#c0b898] bg-white px-4 py-3 text-sm leading-relaxed text-[#2a2010] placeholder-[#c0b898] resize-none outline-none focus:border-[#8a7a58] transition-colors" /></div>
            <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Explain why it matters then (or now):</label><textarea value={matters} onChange={(e) => setMatters(e.target.value)} rows={4} placeholder="This helps us understand..." className="w-full rounded-xl border-2 border-dashed border-[#c0b898] bg-white px-4 py-3 text-sm leading-relaxed text-[#2a2010] placeholder-[#c0b898] resize-none outline-none focus:border-[#8a7a58] transition-colors" /></div>
          </div>
        </div>
      </StagePanel>
      <motion.button onClick={submit} disabled={!canSubmit} whileHover={canSubmit ? { y: -1 } : {}}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 text-base font-bold text-white transition-all disabled:opacity-35 disabled:cursor-not-allowed shadow-lg"
        style={{ backgroundColor: C.evidence.header }}>
        <Send className="size-5" /> Submit My Thinking — Start Cognitive Analysis
      </motion.button>
    </motion.div>
  );
}

// ── SUBMISSION ────────────────────────────────────────────────────────────────
function SubmissionView() {
  return (
    <motion.div key="SUBMISSION" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 space-y-6">
      <div className="flex gap-2">
        {["Frame", "Build", "Reveal"].map((label, i) => (
          <motion.div key={label} className="flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold"
            style={{ borderColor: [C.evidence.border, C.importance.border, C.significance.border][i], color: [C.evidence.header, C.importance.header, C.significance.header][i], backgroundColor: [C.evidence.light, C.importance.light, C.significance.light][i] }}
            animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}>
            {label}
          </motion.div>
        ))}
      </div>
      <div>
        <p className="text-center font-display text-2xl text-[#2c2c18]">Analyzing your thinking...</p>
        <p className="text-center text-sm text-[#8a7a58] mt-2">Running RP analysis, logic chain evaluation, and source integrity confirmation</p>
      </div>
    </motion.div>
  );
}

// ── FEEDBACK ──────────────────────────────────────────────────────────────────
function FeedbackView() {
  const { feedback, revisionStage, teacherMode, enterRevision, reset, paragraph, ctagFor } = useEISStore();
  const [copied, setCopied] = useState(false);
  if (!feedback) return null;

  const allGood = feedback.evidence.status === "good" && feedback.importance.status === "good"
    && feedback.significance.status === "good" && feedback.logicChain.status === "good";
  const para = paragraph();

  async function handleCopy() { await navigator.clipboard.writeText(para); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <motion.div key="FEEDBACK" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-5">
      <div className="rounded-xl border border-[#e0d8c8] bg-white px-5 py-4">
        <p className="text-xs font-mono font-bold uppercase tracking-wide text-[#8a7a58] mb-1">Cognitive Diagnostic Report</p>
        <p className="text-sm font-semibold text-[#4a4030]">Your paragraph has been analyzed. Review each stage below, then enter revision to strengthen your weakest area.</p>
      </div>
      <div className="rounded-xl border border-[#d0c8b0] bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-sm text-[#4a4030]">Your Paragraph</p>
          <button onClick={handleCopy} disabled={!para} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all disabled:opacity-30" style={{ borderColor: "#8a7545", color: "#6a5528", backgroundColor: "#f5eed8" }}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-sm leading-relaxed text-[#2a2010]">{para || <span className="italic text-[#b0a888]">No content.</span>}</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {(["evidence", "importance", "significance"] as Stage[]).map((stage) => {
          const fb = feedback[stage];
          return (
            <div key={stage} className="space-y-1.5">
              <FeedbackCard status={fb.status} message={fb.message} tag={fb.tag} label={`${STAGE_META[stage].frameLabel} Check`} />
              {teacherMode !== "student" && fb.status !== "empty" && <CognitiveBadge tag={ctagFor(stage)} />}
            </div>
          );
        })}
      </div>
      <FeedbackCard status={feedback.logicChain.status} message={feedback.logicChain.message} tag={feedback.logicChain.tag} label="Logic Chain (E → I → S)" />
      {teacherMode !== "student" && (
        <div className="rounded-xl border border-[#d0c8b0] bg-[#fafaf7] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a7a58] mb-2">Cognitive Level Snapshot</p>
          <div className="space-y-1.5 text-xs text-[#4a4030]">
            {(["evidence", "importance", "significance"] as Stage[]).map((s) => (
              <div key={s}><span className="font-bold">{STAGE_META[s].abbr}:</span> {CTAG_META[ctagFor(s)].full} — {feedback[s].status}</div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-[#d0c0a0] bg-[#faf6ec] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a6535] mb-1">Next Step</p>
        <p className="text-xs font-semibold leading-snug text-[#4a3820]">{feedback.nextStep}</p>
      </div>
      {allGood ? (
        <div className="rounded-xl border-2 border-[#4d7a30] bg-[#f2f9ed] p-5 text-center space-y-3">
          <p className="font-bold text-[#3d6025]">All stages pass — strong logic chain.</p>
          <button onClick={reset} className="rounded-xl border-2 border-[#4d7a30] px-6 py-2.5 text-sm font-bold text-[#4d7a30] hover:bg-[#eaf2e3] transition">Start a new paragraph</button>
        </div>
      ) : (
        <motion.button onClick={enterRevision} whileHover={{ y: -1 }}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 text-base font-bold text-white transition-all hover:shadow-lg"
          style={{ backgroundColor: C.importance.header }}>
          <RefreshCw className="size-5" /> Enter Revision Mode — Focus: {STAGE_META[revisionStage].label}
        </motion.button>
      )}
    </motion.div>
  );
}

// ── REVISION ──────────────────────────────────────────────────────────────────
function RevisionView() {
  const { evidence, setEvidence, cause, setCause, effect, setEffect, reveals, setReveals, matters, setMatters, feedback, revisionStage, interventionUnlocked, resubmit, enterRevision } = useEISStore();
  if (!feedback) return null;

  const stageText = (s: Stage) => {
    if (s === "evidence") return evidence;
    if (s === "importance") return [cause, effect].filter(Boolean).join(" ");
    return [reveals, matters].filter(Boolean).join(" ");
  };

  const hasRevision = stageText(revisionStage).trim().length > 8;

  return (
    <motion.div key="REVISION" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
      <div className="rounded-xl border-2 border-[#c8d0d8] bg-[#f4f6f8] px-5 py-3.5 flex items-center gap-3">
        <div className="size-8 shrink-0 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ backgroundColor: STAGE_META[revisionStage].color.header }}>{STAGE_META[revisionStage].abbr}</div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#5a6a78]">Revision Mode — Single Stage Editing</p>
          <p className="text-sm font-semibold text-[#2a2010]">Only <span style={{ color: STAGE_META[revisionStage].color.header }} className="font-bold">{STAGE_META[revisionStage].label}</span> is unlocked. Revise, then resubmit.</p>
        </div>
      </div>
      {(["evidence", "importance", "significance"] as Stage[]).map((stage) => {
        const isActive = stage === revisionStage || interventionUnlocked;
        const meta = STAGE_META[stage]; const fb = feedback[stage];
        return (
          <div key={stage} className={`rounded-2xl border overflow-hidden transition-all ${isActive ? "border-2 shadow-md" : "border border-[#d0c8b0] opacity-45"}`} style={isActive ? { borderColor: meta.color.border } : {}}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: isActive ? meta.color.header : "#9a9280" }}>
              <span className="text-white font-bold text-sm">{meta.abbr} — {meta.label}</span>
              {!isActive ? <Lock className="size-3.5 text-white/70" /> : <span className="text-white/80 text-[10px] font-bold uppercase tracking-wide">Revising</span>}
            </div>
            {isActive ? (
              <div className="p-4 bg-white space-y-3">
                <FeedbackCard status={fb.status} message={fb.message} tag={fb.tag} label={`${meta.frameLabel} Check`} />
                {stage === "evidence" && <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Revise your Evidence:</label><textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={5} className="w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm leading-relaxed text-[#2a2010] resize-none outline-none" style={{ borderColor: meta.color.border }} /></div>}
                {stage === "importance" && <>
                  <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Revise the cause:</label><textarea value={cause} onChange={(e) => setCause(e.target.value)} rows={4} className="w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm leading-relaxed text-[#2a2010] resize-none outline-none" style={{ borderColor: meta.color.border }} /></div>
                  <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Revise the effect:</label><textarea value={effect} onChange={(e) => setEffect(e.target.value)} rows={4} className="w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm leading-relaxed text-[#2a2010] resize-none outline-none" style={{ borderColor: meta.color.border }} /></div>
                </>}
                {stage === "significance" && <>
                  <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Revise what this reveals:</label><textarea value={reveals} onChange={(e) => setReveals(e.target.value)} rows={4} className="w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm leading-relaxed text-[#2a2010] resize-none outline-none" style={{ borderColor: meta.color.border }} /></div>
                  <div><label className="block text-sm font-semibold text-[#4a4030] mb-2">Revise why it matters:</label><textarea value={matters} onChange={(e) => setMatters(e.target.value)} rows={4} className="w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm leading-relaxed text-[#2a2010] resize-none outline-none" style={{ borderColor: meta.color.border }} /></div>
                </>}
              </div>
            ) : (
              <div className="p-4 bg-[#fafaf7]"><p className="text-sm leading-relaxed text-[#6a6050]">{stageText(stage) || <span className="italic text-[#b0a888]">No entry</span>}</p></div>
            )}
          </div>
        );
      })}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button onClick={enterRevision} className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#d8d0b8] px-5 py-3 text-sm font-bold text-[#8a7a58] hover:border-[#c0b898] transition">← Back to analysis</button>
        <motion.button onClick={resubmit} disabled={!hasRevision} whileHover={hasRevision ? { y: -1 } : {}}
          className="flex-1 flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-35"
          style={{ backgroundColor: C.significance.header }}>
          <RefreshCw className="size-4" /> Resubmit Revised Thinking
        </motion.button>
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APP ROOT — state machine driver
// ════════════════════════════════════════════════════════════════════════════

const STATE_LABELS: Record<string, string> = {
  FRAME:      "Frame Stage — Evidence + Source Integrity",
  CITATION:   "Citation Required — Quote Detected",
  BUILD:      "Build Stage — Importance",
  REVEAL:     "Reveal Stage — Significance",
  SUBMISSION: "Analyzing — Cognitive Diagnostic Running",
  FEEDBACK:   "Diagnostic Report — Review Your Thinking",
  REVISION:   "Revision Mode — Single Stage Editing",
};

const PROGRESS_STEPS: { states: string[]; label: string }[] = [
  { states: ["FRAME", "CITATION"], label: "Frame"    },
  { states: ["BUILD"],             label: "Build"    },
  { states: ["REVEAL"],            label: "Reveal"   },
  { states: ["SUBMISSION", "FEEDBACK"], label: "Analysis" },
  { states: ["REVISION"],          label: "Revision" },
];

export default function App() {
  const ms = useEISStore((s) => s.ms);
  const evidence = useEISStore((s) => s.evidence);
  const sourceText = useEISStore((s) => s.sourceText);
  const csLevel = useEISStore((s) => s.csLevel);
  const teacherMode = useEISStore((s) => s.teacherMode);
  const { runSID, analysisComplete } = useEISStore();

  const [showTeacher, setShowTeacher] = useState(false);
  const [showModeling, setShowModeling] = useState(false);
  const [showMasterEssay, setShowMasterEssay] = useState(false);
  const [sidChecking, setSidChecking] = useState(false);

  // SID debounce — only active in FRAME
  useEffect(() => {
    if (ms !== "FRAME") return;
    setSidChecking(true);
    const timer = setTimeout(() => { runSID(); setSidChecking(false); }, 650);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidence, sourceText, csLevel, ms]);

  // SUBMISSION → FEEDBACK auto-advance
  useEffect(() => {
    if (ms !== "SUBMISSION") return;
    const timer = setTimeout(analysisComplete, 900);
    return () => clearTimeout(timer);
  }, [ms, analysisComplete]);

  const activeStep = PROGRESS_STEPS.findIndex((s) => s.states.includes(ms));

  return (
    <div className="min-h-screen bg-[#f9f7f0] font-sans">
      <div className="bg-[#2c2c18] px-5 py-2.5 flex items-center gap-3">
        <div className="size-7 rounded flex items-center justify-center font-bold text-white text-sm shrink-0" style={{ backgroundColor: C.evidence.header }}>R</div>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[#d4cc98] text-xs font-bold uppercase tracking-widest whitespace-nowrap">ReCast EIS</span>
          <span className="text-[#7a7250] text-xs hidden sm:inline">Cognition Engine — Zustand</span>
        </div>
        <span className="ml-auto text-[#5a5438] text-[10px] whitespace-nowrap hidden sm:inline">© 2026 ReCast the EssayGrowers</span>
      </div>

      <div className="bg-white border-b border-[#e0d8c8] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-xl md:text-2xl text-[#2c2c18]">{STATE_LABELS[ms] ?? ms}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {PROGRESS_STEPS.map((step, i) => {
                const isActive = i === activeStep; const isDone = i < activeStep;
                return (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all border ${isActive ? "border-current" : isDone ? "border-transparent" : "border-transparent opacity-40"}`}
                      style={isActive ? { backgroundColor: [C.evidence.light, C.importance.light, C.significance.light, "#f5eed8", "#e8edf7"][i], color: [C.evidence.header, C.importance.header, C.significance.header, "#7a6535", C.importance.header][i] }
                        : isDone ? { backgroundColor: "#f0f0ec", color: "#8a7a58" }
                        : { backgroundColor: "transparent", color: "#c0b898" }}>
                      {isDone && <Check className="size-2.5" />}
                      {step.label}
                    </div>
                    {i < PROGRESS_STEPS.length - 1 && <div className="w-3 h-px" style={{ backgroundColor: isDone ? "#b0a888" : "#e0d8c8" }} />}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setShowTeacher((v) => !v)}
              className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all ${teacherMode !== "student" ? "border-[#4d7a30] bg-[#eaf2e3] text-[#4d7a30]" : "border-[#d8d0b8] text-[#8a7a58]"}`}>
              <Settings className="size-3.5" />
              {teacherMode === "student" ? "Teacher" : teacherMode === "diagnostic" ? "Diagnostic View" : "Intervention Mode"}
            </button>
            <AnimatePresence>
              {showTeacher && (
                <TeacherPanel
                  onOpenModeling={() => { setShowModeling(true); setShowTeacher(false); }}
                  onOpenEssay={() => { setShowMasterEssay((v) => !v); setShowTeacher(false); }}
                  onClose={() => setShowTeacher(false)} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <AnimatePresence>
          {showMasterEssay && <div className="mt-6"><MasterEssayPanel onClose={() => setShowMasterEssay(false)} /></div>}
        </AnimatePresence>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {ms === "FRAME"      && <FrameView      key="FRAME"      sidChecking={sidChecking} />}
          {ms === "CITATION"   && <CitationView   key="CITATION"   />}
          {ms === "BUILD"      && <BuildView      key="BUILD"      />}
          {ms === "REVEAL"     && <RevealView     key="REVEAL"     />}
          {ms === "SUBMISSION" && <SubmissionView key="SUBMISSION" />}
          {ms === "FEEDBACK"   && <FeedbackView   key="FEEDBACK"   />}
          {ms === "REVISION"   && <RevisionView   key="REVISION"   />}
        </AnimatePresence>
        <p className="text-center text-[11px] text-[#a09880] pb-8 pt-12">© 2026 ReCast the EssayGrowers · Updated: 6/2026</p>
      </div>

      <AnimatePresence>
        {showModeling && <ModelingOverlay onClose={() => setShowModeling(false)} />}
      </AnimatePresence>
    </div>
  );
}
