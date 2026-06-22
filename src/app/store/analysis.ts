// ============================================================================
// ReCast EIS — Pure Analysis Functions
// No side effects. All functions take inputs and return results.
// ============================================================================

import type {
  Stage, CSLevel, CSLevelConfig, CTagKey, CogLevel,
  SIDState, SIDReason, SIDSignals,
  StageFeedback, FeedbackResult,
} from "./types";

// ── CS Level thresholds ───────────────────────────────────────────────────────

export const CS_LEVELS: Record<CSLevel, CSLevelConfig> = {
  CS6:  { label: "CS6",  lexThreshold: 0.38, bigramThreshold: 0.34, trigramThreshold: 0.22, description: "Foundational — strict paraphrase, quotes discouraged",             sidLabel: "STRICT"   },
  CS7:  { label: "CS7",  lexThreshold: 0.48, bigramThreshold: 0.44, trigramThreshold: 0.28, description: "Developing — guided quoting, more revision support",              sidLabel: "MODERATE" },
  CS8:  { label: "CS8",  lexThreshold: 0.55, bigramThreshold: 0.50, trigramThreshold: 0.34, description: "Core Writing — paraphrase required, quote mode supported",         sidLabel: "BALANCED" },
  CS9:  { label: "CS9",  lexThreshold: 0.65, bigramThreshold: 0.60, trigramThreshold: 0.44, description: "Advanced — closer source engagement, synthesis emphasis",          sidLabel: "SOFT"     },
  CS10: { label: "CS10", lexThreshold: 0.82, bigramThreshold: 0.78, trigramThreshold: 0.58, description: "TEMPERED — optional enforcement, interpretation over policing",     sidLabel: "OPTIONAL" },
};

// ── Tokenization ──────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
  "from","this","that","it","is","was","are","were","be","been","has","have",
  "had","do","does","did","so","as","if","then","their","they","its","we",
  "you","he","she","his","her","not","also","which","when","who","what","will","just","into",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function ngramize(words: string[], n: number): string[] {
  return words
    .slice(0, words.length - (n - 1))
    .map((_, i) => words.slice(i, i + n).join("__"));
}

// ── Source Integrity Detector (SID) ──────────────────────────────────────────

// Layer 1 — phrase-pattern engine (no source required)
export function analyzeSourceIntegrity(text: string): { status: "empty" | "quote" | "fail" | "pass"; message: string } {
  const t = text.trim();
  if (t.length < 10) return { status: "empty", message: "" };

  const isQuote = /[""].{5,}[""]/.test(t) || /"[^"]{5,}"/.test(t);
  const patchPatterns = [
    /according to the text/i,
    /the text says/i,
    /it says that/i,
    /the article states/i,
    /in the text it says/i,
    /the passage states/i,
    /as stated in the/i,
  ];
  const isPatch = patchPatterns.some((p) => p.test(t));

  if (isQuote) return { status: "quote", message: "Quote detected. Citation required before continuing." };
  if (isPatch) return { status: "fail", message: "This is too close to the source. ReCast requires paraphrasing before interpretation." };
  return { status: "pass", message: "Good paraphrase — ready for Importance stage." };
}

// Layer 2 — statistical similarity (requires pasted source)
export function computeSIDSignals(source: string, student: string): SIDSignals {
  const sw = tokenize(source);
  const st = tokenize(student);
  if (sw.length < 4 || st.length < 4) return { lexical: 0, structural: 0, patchwriting: 0 };

  const srcSet = new Set(sw);
  const lexical = st.filter((w) => srcSet.has(w)).length / st.length;

  const srcBi = new Set(ngramize(sw, 2));
  const stBi = ngramize(st, 2);
  const structural = stBi.length > 0 ? stBi.filter((b) => srcBi.has(b)).length / stBi.length : 0;

  const srcTri = new Set(ngramize(sw, 3));
  const stTri = ngramize(st, 3);
  const patchwriting = stTri.length > 0 ? stTri.filter((t) => srcTri.has(t)).length / stTri.length : 0;

  return { lexical, structural, patchwriting };
}

export function detectSID(
  evidence: string,
  source: string,
  currentSIDState: SIDState,
  csLevel: CSLevel,
): { state: SIDState; reason: SIDReason; signals: SIDSignals } {
  const EMPTY_SIGNALS: SIDSignals = { lexical: 0, structural: 0, patchwriting: 0 };
  if (!evidence.trim()) return { state: "idle", reason: null, signals: EMPTY_SIGNALS };

  // Layer 1 — phrase patterns
  const integrity = analyzeSourceIntegrity(evidence);
  if (integrity.status === "quote") {
    return { state: currentSIDState === "cited" ? "cited" : "quote", reason: null, signals: EMPTY_SIGNALS };
  }
  if (integrity.status === "fail") {
    return { state: "too-close", reason: "patchwriting", signals: { ...EMPTY_SIGNALS, patchwriting: 1 } };
  }

  // Layer 2 — statistical (needs source)
  if (!source.trim()) return { state: "idle", reason: null, signals: EMPTY_SIGNALS };

  const signals = computeSIDSignals(source, evidence);
  const cfg = CS_LEVELS[csLevel];

  if (signals.patchwriting > cfg.trigramThreshold) return { state: "too-close", reason: "patchwriting",      signals };
  if (signals.structural  > cfg.bigramThreshold)   return { state: "too-close", reason: "structural-mirror", signals };
  if (signals.lexical     > cfg.lexThreshold)      return { state: "too-close", reason: "lexical-overlap",   signals };

  return { state: "clear", reason: null, signals };
}

// ── EIS Stage Analysis ────────────────────────────────────────────────────────

export function analyzeEvidence(text: string): StageFeedback {
  const t = text.trim();
  if (t.length < 10) return { status: "empty", message: "" };
  if (/^(this (shows?|means?|reveals?|demonstrates?|suggests?)|it shows?|it means?)/i.test(t))
    return { status: "error", message: "This opens with interpretation. Frame-level evidence should state what happened or what the text directly says.", tag: "Premature Interpretation" };
  if (/\b(shows? that|means? that|reveals? that|suggests? that|therefore|as a result|this (reveals?|means?|implies?|demonstrates?))\b/i.test(t))
    return { status: "caution", message: "This includes some interpretation. Evidence should describe only what is explicitly stated.", tag: "Premature Interpretation" };
  if (/\b(states?|says?|according to|wrote|noted|reported|in the (text|passage|source)|described|mentioned)\b/i.test(t))
    return { status: "good", message: "Good factual detail. You are staying at the Frame level—describing what the text directly shows." };
  return { status: "caution", message: "Make sure this describes observable information only. Avoid explaining what the evidence means." };
}

export function analyzeImportance(cause: string, effect: string): StageFeedback {
  const t = (cause + " " + effect).trim();
  if (t.length < 10) return { status: "empty", message: "" };
  if (/\b(reveals? that|suggests? that|reflects? a?|implies? that|pattern|society|history|broader|deeper|larger (idea|context)|ultimately)\b/i.test(t))
    return { status: "caution", message: "You have moved into the Reveal stage too early. Build should explain cause and effect.", tag: "Jumped to Significance Too Early" };
  if (/\b(because|leads? to|causes?|results? in|change[sd]?|affect[sed]?|as a result|therefore|consequently|this (causes?|changes?|affects?|led to))\b/i.test(t))
    return { status: "good", message: "Good causal reasoning. You are building from the evidence toward an effect or change." };
  return { status: "caution", message: "Explain what the evidence causes or changes. Use causal connectors like 'because,' 'leads to,' or 'results in.'", tag: "Missing Causal Link" };
}

export function analyzeSignificance(reveals: string, matters: string, cause: string, effect: string): StageFeedback {
  const t = (reveals + " " + matters).trim();
  if (t.length < 10) return { status: "empty", message: "" };

  const imp = (cause + " " + effect).toLowerCase();
  const impSet = new Set(imp.split(/\W+/).filter((w) => w.length > 5));
  const sigWords = t.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
  const overlapRatio = sigWords.length > 0 ? sigWords.filter((w) => impSet.has(w)).length / sigWords.length : 0;

  if (overlapRatio > 0.55 && impSet.size > 4)
    return { status: "caution", message: "This closely repeats your Importance. Reveal should push beyond what happened to explain a larger idea.", tag: "Redundant Meaning" };
  if (/\b(reveals? that|suggests? that|reflects?|implies? that|pattern|broader|society|history|today|ultimately|deeper|larger (idea|truth))\b/i.test(t))
    return { status: "good", message: "Strong interpretation. You are moving from what happened to what it means—this is the Reveal stage working well." };
  return { status: "caution", message: "Push beyond cause and effect. Ask: what does this reveal about people, society, or a broader theme?", tag: "Surface Interpretation" };
}

export function analyzeLogicChain(evidence: string, cause: string, effect: string, reveals: string, matters: string): StageFeedback {
  const imp = (cause + " " + effect).trim();
  const sig = (reveals + " " + matters).trim();
  if (!evidence.trim() || !imp || !sig) return { status: "empty", message: "" };

  const keys = (text: string) => new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
  const evK = keys(evidence); const impK = keys(imp); const sigK = keys(sig);

  if ([...evK].filter((w) => impK.has(w)).length === 0 && evK.size > 3)
    return { status: "error", message: "Your Importance does not clearly connect to your Evidence. The Build stage should refer back to the fact stated in the Frame.", tag: "Broken Logic Chain (E→I)" };
  if ([...impK].filter((w) => sigK.has(w)).length === 0 && impK.size > 3)
    return { status: "caution", message: "Your Significance may not build from your Importance. Check that your Reveal emerges from your Build.", tag: "Disconnected Reveal (I→S)" };
  return { status: "good", message: "Strong logic chain. Your Frame, Build, and Reveal form a clear progression from observation to interpretation." };
}

function getNextStep(ev: StageFeedback, imp: StageFeedback, sig: StageFeedback, chain: StageFeedback): string {
  if (ev.tag  === "Premature Interpretation")    return "Return to Evidence: remove any language that interprets. State only what the text directly says.";
  if (imp.tag === "Missing Causal Link")          return "Strengthen Importance: add a causal connector (because, leads to, results in) to show what the evidence causes.";
  if (imp.tag === "Jumped to Significance Too Early") return "Pull back your Importance: save the broader meaning for Significance; focus on cause and effect here.";
  if (sig.tag === "Redundant Meaning")            return "Expand your Significance: ask what this reveals about a pattern, theme, or larger idea beyond the immediate effect.";
  if (sig.tag === "Surface Interpretation")       return "Deepen your Significance: connect your example to something broader — a theme, a historical pattern, or a truth about society.";
  if (chain.tag?.startsWith("Broken"))            return "Re-read Evidence and Importance: make sure your Build stage directly responds to the fact you stated in the Frame.";
  if (chain.tag?.startsWith("Disconnected"))      return "Re-read Importance and Significance: your Reveal should grow out of your Build, not introduce a new direction.";
  return "Your logic chain is strong. Read your paragraph aloud — does each stage follow naturally from the one before it?";
}

export function buildFeedback(
  evidence: string, cause: string, effect: string, reveals: string, matters: string,
): FeedbackResult {
  const ev    = analyzeEvidence(evidence);
  const imp   = analyzeImportance(cause, effect);
  const sig   = analyzeSignificance(reveals, matters, cause, effect);
  const chain = analyzeLogicChain(evidence, cause, effect, reveals, matters);
  return { evidence: ev, importance: imp, significance: sig, logicChain: chain, nextStep: getNextStep(ev, imp, sig, chain) };
}

export function getWeakestStage(fb: FeedbackResult): Stage {
  const score = (s: StageFeedback) => ({ error: 2, caution: 1, good: 0, empty: 0 }[s.status]);
  const scores = { evidence: score(fb.evidence), importance: score(fb.importance), significance: score(fb.significance) };
  if (scores.evidence >= scores.importance && scores.evidence >= scores.significance) return "evidence";
  return scores.importance >= scores.significance ? "importance" : "significance";
}

export function assignCTag(stage: Stage, fb: StageFeedback): CTagKey {
  if (stage === "evidence")    return fb.tag === "Premature Interpretation" ? "RE" : "RP";
  if (stage === "importance")  return fb.status === "good" ? "AC" : "FP";
  return fb.status === "good" ? "RFC" : "FP";
}

// ── Thinking trace (Teacher Modeling Mode) ───────────────────────────────────

export function detectCogLevel(sentence: string): CogLevel {
  const s = sentence.trim();
  if (s.length < 6) return "neutral";
  if (/\b(reveals?|suggests?|reflects?|implies?|pattern|broader|society|history|today|ultimately|deeper|larger (idea|truth|picture)|what this means?)\b/i.test(s)) return "reveal";
  if (/\b(because|leads? to|causes?|results? in|change[sd]?|affect[sed]?|as a result|therefore|consequently)\b/i.test(s)) return "build";
  if (/\b(states?|says?|according to|wrote|noted|reported|on [a-z]+ \d|\d{4}|marched|walked|sat|refused|organized|arrested)\b/i.test(s)) return "frame";
  return "neutral";
}
