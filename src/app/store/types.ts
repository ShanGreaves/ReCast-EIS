// ============================================================================
// ReCast EIS — Shared Type Definitions
// ============================================================================

export type MachineState =
  | "FRAME"       // Evidence input — SID active, RP enforced
  | "CITATION"    // Quote detected — citation form gate
  | "BUILD"       // Importance writing — causal reasoning required
  | "REVEAL"      // Significance writing — interpretation required
  | "SUBMISSION"  // All inputs frozen — diagnostic engine running
  | "FEEDBACK"    // Structured cognitive diagnostic displayed
  | "REVISION";   // Single locked stage — controlled repair

export type Stage = "evidence" | "importance" | "significance";
export type TeacherMode = "student" | "diagnostic" | "intervention";
export type CSLevel = "CS6" | "CS7" | "CS8" | "CS9" | "CS10";
export type CTagKey = "RP" | "RE" | "FP" | "AC" | "RFC";
export type CogLevel = "frame" | "build" | "reveal" | "neutral";

export type SIDState = "idle" | "clear" | "too-close" | "quote" | "cited";
export type SIDReason = "patchwriting" | "structural-mirror" | "lexical-overlap" | null;

export interface SIDSignals {
  lexical: number;
  structural: number;
  patchwriting: number;
}

export interface Citation {
  title: string;
  author: string;
  locator: string;
  exactQuote: string;
  contextNote: string;
}

export interface StageFeedback {
  status: "good" | "caution" | "error" | "empty";
  message: string;
  tag?: string;
}

export interface FeedbackResult {
  evidence: StageFeedback;
  importance: StageFeedback;
  significance: StageFeedback;
  logicChain: StageFeedback;
  nextStep: string;
}

export interface EISSnapshot {
  evidence: string;
  cause: string;
  effect: string;
  reveals: string;
  matters: string;
  feedback: FeedbackResult;
}

// CS Level config shape
export interface CSLevelConfig {
  label: string;
  lexThreshold: number;
  bigramThreshold: number;
  trigramThreshold: number;
  description: string;
  sidLabel: string;
}
