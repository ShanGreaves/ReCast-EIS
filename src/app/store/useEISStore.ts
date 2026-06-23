// ============================================================================
// ReCast EIS — Zustand Cognitive State Machine
//
// Central store. All state lives here. All transitions are methods.
// The UI reads state and calls methods — no prop drilling, no dispatch.
//
// State machine:
//   FRAME → (SID pass) → BUILD → REVEAL → SUBMISSION → FEEDBACK → REVISION
//   FRAME → (quote)    → CITATION → BUILD
// ============================================================================

import { create } from "zustand";
import {
  type MachineState, type Stage, type TeacherMode, type CSLevel, type CTagKey,
  type SIDState, type SIDReason, type SIDSignals,
  type Citation, type FeedbackResult, type EISSnapshot,
} from "./types";
import {
  CS_LEVELS, detectSID, buildFeedback, getWeakestStage, assignCTag,
} from "./analysis";

// ── Store interface ───────────────────────────────────────────────────────────

export interface EISStore {
  // ── Machine state ──
  ms: MachineState;

  // ── Writing content ──
  evidence: string;
  cause: string;
  effect: string;
  reveals: string;
  matters: string;
  sourceText: string;
  citation: Citation;

  // ── SID ──
  sidState: SIDState;
  sidReason: SIDReason;
  sidSignals: SIDSignals;
  sidFailureCount: number;
  quoteAttemptCount: number;
  showRecovery: boolean;

  // ── Feedback + revision ──
  feedback: FeedbackResult | null;
  initialSnapshot: EISSnapshot | null;
  revisionStage: Stage;

  // ── Teacher controls ──
  csLevel: CSLevel;
  teacherMode: TeacherMode;
  interventionUnlocked: boolean;
  scaffoldPrompts: Record<Stage, string>;

  // ── Custom starters + CQs ──
  customStarters: Record<Stage, string[]>;
  customCQs: Record<Stage, string[]>;

  // ── Computed helpers (not persisted) ──
  paragraph: () => string;
  sidPasses: () => boolean;
  weakestStageLabel: () => string;
  ctagFor: (stage: Stage) => CTagKey;

  // ── Content setters ──
  setEvidence: (v: string) => void;
  setCause: (v: string) => void;
  setEffect: (v: string) => void;
  setReveals: (v: string) => void;
  setMatters: (v: string) => void;
  setSourceText: (v: string) => void;
  setCitation: (c: Citation) => void;

  // ── SID engine ──
  // Call from a debounced useEffect whenever evidence / sourceText / csLevel change
  runSID: () => void;

  // ── Cognitive state transitions ──
  // Each method guards itself — silently no-ops if the machine is in the wrong state
  advanceToBuild: () => void;       // FRAME → BUILD (SID must pass)
  completeCitation: () => void;     // CITATION → BUILD (form must be complete)
  backToFrame: () => void;          // CITATION → FRAME
  advanceToReveal: () => void;      // BUILD → REVEAL
  submit: () => void;               // REVEAL | REVISION → SUBMISSION (runs diagnostic)
  analysisComplete: () => void;     // SUBMISSION → FEEDBACK (auto-called after delay)
  enterRevision: () => void;        // FEEDBACK → REVISION
  resubmit: () => void;             // REVISION → SUBMISSION (runs diagnostic)
  continueRevision: () => void;     // FEEDBACK → REVISION with next weakest stage
  dismissRecovery: () => void;

  // ── Teacher controls ──
  setTeacherMode: (m: TeacherMode) => void;
  setCsLevel: (l: CSLevel) => void;
  setIntervention: (v: boolean) => void;
  setScaffold: (stage: Stage, prompt: string) => void;
  addStarter: (stage: Stage, text: string) => void;
  addCQ: (stage: Stage, text: string) => void;

  // ── Full reset ──
  reset: () => void;
}

// ── Initial values ────────────────────────────────────────────────────────────

const INITIAL_CITATION: Citation = { title: "", author: "", locator: "", exactQuote: "", contextNote: "" };
const EMPTY_SIGNALS: SIDSignals = { lexical: 0, structural: 0, patchwriting: 0 };
const EMPTY_STAGE_RECORD = <T>(v: T): Record<Stage, T> => ({ evidence: v, importance: v, significance: v });

// ── Store ─────────────────────────────────────────────────────────────────────

export const useEISStore = create<EISStore>((set, get) => ({
  // ── Initial state ──
  ms: "FRAME",

  evidence: "", cause: "", effect: "", reveals: "", matters: "",
  sourceText: "", citation: INITIAL_CITATION,

  sidState: "idle", sidReason: null, sidSignals: EMPTY_SIGNALS,
  sidFailureCount: 0, quoteAttemptCount: 0, showRecovery: false,

  feedback: null, initialSnapshot: null, revisionStage: "importance",

  csLevel: "CS8", teacherMode: "student", interventionUnlocked: false,
  scaffoldPrompts: EMPTY_STAGE_RECORD(""),
  customStarters:  EMPTY_STAGE_RECORD<string[]>([]),
  customCQs:       EMPTY_STAGE_RECORD<string[]>([]),

  // ── Computed helpers ──
  paragraph: () => {
    const { evidence, cause, effect, reveals, matters } = get();
    return [evidence, [cause, effect].filter(Boolean).join(" "), [reveals, matters].filter(Boolean).join(" ")]
      .filter(Boolean).join(" ");
  },

  sidPasses: () => {
    const { sidState, interventionUnlocked } = get();
    return sidState === "clear" || sidState === "cited" || interventionUnlocked;
  },

  weakestStageLabel: () => {
    const { feedback } = get();
    if (!feedback) return "";
    return getWeakestStage(feedback);
  },

  ctagFor: (stage) => {
    const { feedback } = get();
    if (!feedback) return "RP";
    return assignCTag(stage, feedback[stage]);
  },

  // ── Content setters ──
  setEvidence:  (v) => set({ evidence: v }),
  setCause:     (v) => set({ cause: v }),
  setEffect:    (v) => set({ effect: v }),
  setReveals:   (v) => set({ reveals: v }),
  setMatters:   (v) => set({ matters: v }),
  setSourceText:(v) => set({ sourceText: v }),
  setCitation:  (c) => set({ citation: c }),

  // ── SID engine ──
  // Runs the two-layer detection and updates sidState.
  // Only meaningful when ms === "FRAME"; safe to call anytime.
  runSID: () => {
    const { evidence, sourceText, sidState, csLevel, ms } = get();
    if (ms !== "FRAME") return;

    const result = detectSID(evidence, sourceText, sidState, csLevel);
    const { state, reason, signals } = result;

    const prev = sidState;
    const failCount = state === "too-close" && prev !== "too-close"
      ? get().sidFailureCount + 1 : get().sidFailureCount;
    const quoteCount = state === "quote" && prev !== "quote"
      ? get().quoteAttemptCount + 1 : get().quoteAttemptCount;

    set({
      sidState: state,
      sidReason: reason,
      sidSignals: signals,
      sidFailureCount: failCount,
      quoteAttemptCount: quoteCount,
      showRecovery: failCount >= 2 && state === "too-close",
      // Auto-transition: FRAME → CITATION when quote detected
      ms: state === "quote" ? "CITATION" : ms,
    });
  },

  // ── Transitions ──

  // FRAME → BUILD: SID must pass + evidence must have content
  advanceToBuild: () => {
    const { ms, evidence, interventionUnlocked } = get();
    if (ms !== "FRAME") return;
    const hasEvidence = evidence.trim().length > 10;
    if (!get().sidPasses() || !hasEvidence) return;
    set({ ms: "BUILD" });
  },

  // CITATION → BUILD: required fields must be complete
  completeCitation: () => {
    const { ms, citation, interventionUnlocked } = get();
    if (ms !== "CITATION") return;
    const { title, locator, exactQuote } = citation;
    const formComplete = !!title.trim() && !!locator.trim() && !!exactQuote.trim();
    if (!formComplete && !interventionUnlocked) return;
    set({ ms: "BUILD", sidState: "cited" });
  },

  // CITATION → FRAME: student removes quote marks
  backToFrame: () => {
    if (get().ms !== "CITATION") return;
    set({ ms: "FRAME", sidState: "idle" });
  },

  // BUILD → REVEAL: Importance must have content
  advanceToReveal: () => {
    const { ms, cause, effect, interventionUnlocked } = get();
    if (ms !== "BUILD") return;
    const hasImportance = (cause + effect).trim().length > 8;
    if (!hasImportance && !interventionUnlocked) return;
    set({ ms: "REVEAL" });
  },

  // REVEAL | REVISION → SUBMISSION: run full diagnostic, freeze inputs
  submit: () => {
    const { ms, evidence, cause, effect, reveals, matters, initialSnapshot, interventionUnlocked } = get();
    if (ms !== "REVEAL" && ms !== "REVISION") return;

    const hasAll = evidence.trim().length > 8
      && (cause + effect).trim().length > 8
      && (reveals + matters).trim().length > 8;
    if (!hasAll && !interventionUnlocked) return;

    const fb = buildFeedback(evidence, cause, effect, reveals, matters);
    const snap: EISSnapshot = { evidence, cause, effect, reveals, matters, feedback: fb };

    set({
      ms: "SUBMISSION",
      feedback: fb,
      initialSnapshot: initialSnapshot ?? snap,
    });
  },

  // SUBMISSION → FEEDBACK: called automatically after processing delay
  analysisComplete: () => {
    const { ms, feedback } = get();
    if (ms !== "SUBMISSION") return;
    const revisionStage = feedback ? getWeakestStage(feedback) : "importance";
    set({ ms: "FEEDBACK", revisionStage });
  },

  // FEEDBACK → REVISION: open the weakest stage for editing
  enterRevision: () => {
    if (get().ms !== "FEEDBACK") return;
    set({ ms: "REVISION" });
  },

  // REVISION → SUBMISSION: re-run diagnostic on revised content
  resubmit: () => {
    const { ms, evidence, cause, effect, reveals, matters } = get();
    if (ms !== "REVISION") return;
    const fb = buildFeedback(evidence, cause, effect, reveals, matters);
    set({ ms: "SUBMISSION", feedback: fb });
  },

  // FEEDBACK → REVISION with the next weakest stage recalculated
  continueRevision: () => {
    const { ms, feedback } = get();
    if (ms !== "FEEDBACK") return;
    const stage = feedback ? getWeakestStage(feedback) : "importance";
    set({ ms: "REVISION", revisionStage: stage });
  },

  dismissRecovery: () => set({ showRecovery: false }),

  // ── Teacher controls ──
  setTeacherMode:   (m)    => set({ teacherMode: m }),
  setCsLevel:       (l)    => set({ csLevel: l }),
  setIntervention:  (v)    => set({ interventionUnlocked: v }),
  setScaffold:      (s, p) => set((state) => ({ scaffoldPrompts: { ...state.scaffoldPrompts, [s]: p } })),
  addStarter:       (s, t) => set((state) => ({ customStarters: { ...state.customStarters, [s]: [...state.customStarters[s], t] } })),
  addCQ:            (s, t) => set((state) => ({ customCQs: { ...state.customCQs, [s]: [...state.customCQs[s], t] } })),

  // ── Reset ──
  reset: () =>
    set((state) => ({
      ms: "FRAME",
      evidence: "", cause: "", effect: "", reveals: "", matters: "",
      sourceText: "", citation: INITIAL_CITATION,
      sidState: "idle", sidReason: null, sidSignals: EMPTY_SIGNALS,
      sidFailureCount: 0, quoteAttemptCount: 0, showRecovery: false,
      feedback: null, initialSnapshot: null, revisionStage: "importance",
      // Preserve teacher preferences across resets
      csLevel: state.csLevel, teacherMode: state.teacherMode,
    })),
}));

// ── Re-export types + config needed by UI ────────────────────────────────────

