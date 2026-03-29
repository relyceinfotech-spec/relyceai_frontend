import { cleanOutput } from "./cleaner";
import { extractClaims } from "./claim_extractor";
import { mapClaimsToSources } from "./source_mapper";
import { scoreConfidence } from "./confidence";
import { formatStructuredResponse, parseSections } from "./formatter";

function normalizeSources(sources = []) {
  return (Array.isArray(sources) ? sources : [])
    .map((s) => {
      if (!s) return null;
      if (typeof s === "string") return s;
      return s.url || s.link || null;
    })
    .filter(Boolean);
}

function looksLikeMarkdownTable(text = "") {
  return /\|.+\|/.test(text) && /\|\s*[-:]{2,}\s*\|/.test(text);
}

function extractTimeline(claims = []) {
  const items = [];
  for (const claim of claims) {
    const m = String(claim).match(/\b(19|20)\d{2}\b/);
    if (m) items.push(claim);
  }
  return items.slice(0, 8);
}

export function buildResponse(rawOutput = "", options = {}) {
  const cleaned = cleanOutput(rawOutput);
  if (!cleaned) return formatStructuredResponse({});

  // Structured JSON fast path
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      const normalized = {
        answer: parsed.answer || parsed.summary || "",
        keyPoints: parsed.key_points || parsed.keyPoints || parsed.claims || [],
        sources: normalizeSources(parsed.sources || options.sources || []),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : options?.meta?.confidence,
        type: parsed.type || "summary",
        relatedQuestions: parsed.related_questions || parsed.relatedQuestions || options.relatedQuestions || [],
      };
      return formatStructuredResponse(normalized);
    }
  } catch {
    // not JSON, continue
  }

  const sectionParsed = parseSections(cleaned);
  const normalizedSources = normalizeSources(sectionParsed.sources.length ? sectionParsed.sources : (options.sources || []));

  let answer = sectionParsed.answer;
  const claims = extractClaims(cleaned);
  if (!answer) answer = claims[0] || cleaned.split("\n")[0] || "";

  const keyPoints = sectionParsed.keyPoints.length ? sectionParsed.keyPoints : claims.slice(1, 5);
  const claimSourceMap = mapClaimsToSources(keyPoints, normalizedSources);
  const confidence = sectionParsed.confidence ?? scoreConfidence({
    sources: normalizedSources,
    claims: keyPoints,
    modelConfidence: options?.meta?.confidence,
  });

  const tableMarkdown = looksLikeMarkdownTable(cleaned) ? cleaned : "";
  const timeline = extractTimeline(claims);

  const inferredType = tableMarkdown
    ? "comparison"
    : timeline.length >= 2
      ? "timeline"
      : "fact";

  return formatStructuredResponse({
    type: inferredType,
    answer,
    keyPoints,
    sources: normalizedSources,
    confidence,
    tableMarkdown,
    timeline,
    relatedQuestions: sectionParsed.relatedQuestions.length ? sectionParsed.relatedQuestions : (options.relatedQuestions || []),
    claimSourceMap,
  });
}
