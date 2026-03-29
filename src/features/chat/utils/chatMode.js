export const CHAT_MODE_SELECTIONS = ["auto", "smart", "agent", "research_pro"];
export const CANONICAL_CHAT_MODES = ["smart", "agent", "research_pro"];

const LEGACY_TO_CANONICAL = {
  auto: "smart",
  normal: "smart",
  hybrid_main: "smart",
  business: "smart",
  deepsearch: "research_pro",
  research: "research_pro",
};

const RESEARCH_TRIGGER_RE = /\b(latest|today|current|breaking|recent|news|update|updates|with sources|source-backed|cite|citation|proof|evidence)\b/i;
const TASK_TRIGGER_RE = /\b(build|generate|analyze|fix|debug|implement|create|code|refactor|optimize|execute)\b/i;
const YEAR_TRIGGER_RE = /\b20\d{2}\b/;

export const normalizeChatModeSelection = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (CHAT_MODE_SELECTIONS.includes(raw)) return raw;
  if (LEGACY_TO_CANONICAL[raw]) return LEGACY_TO_CANONICAL[raw];
  return "auto";
};

export const normalizeChatMode = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (CANONICAL_CHAT_MODES.includes(raw)) return raw;
  if (LEGACY_TO_CANONICAL[raw]) return LEGACY_TO_CANONICAL[raw];
  return "smart";
};

export const autoSelectChatMode = (input) => {
  const text = String(input || "").trim();
  if (!text) return "smart";
  const lowered = text.toLowerCase();

  const criticalResearch =
    RESEARCH_TRIGGER_RE.test(lowered) ||
    YEAR_TRIGGER_RE.test(lowered) ||
    text.length > 120;
  if (criticalResearch) return "research_pro";

  if (TASK_TRIGGER_RE.test(lowered)) return "agent";
  return "smart";
};

export const resolveRuntimeChatMode = (selectedMode, input) => {
  const mode = normalizeChatModeSelection(selectedMode);
  if (mode === "auto") return autoSelectChatMode(input);
  return normalizeChatMode(mode);
};

export const isAgentPremiumMode = (value) => {
  const mode = normalizeChatMode(value);
  return mode === "agent" || mode === "research_pro";
};
