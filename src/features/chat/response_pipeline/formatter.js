function sectionRegex(name) {
  return new RegExp(`(?:^|\\n)#{0,3}\\s*(?:${name})\\s*:?\\s*\\n([\\s\\S]*?)(?=(?:\\n#{0,3}\\s*(?:Answer|Quick Answer|Summary|Key Findings|Key Points|Sources|Confidence|Evidence|Related Questions)\\s*:?)|$)`, "i");
}

export function formatStructuredResponse(payload = {}) {
  const answer = String(payload.answer || payload.summary || "").trim();
  const keyPoints = Array.isArray(payload.keyPoints) ? payload.keyPoints.filter(Boolean) : [];
  const sources = Array.isArray(payload.sources) ? payload.sources.filter(Boolean) : [];
  const confidence = typeof payload.confidence === "number" ? payload.confidence : null;
  const tableMarkdown = String(payload.tableMarkdown || "").trim();
  const timeline = Array.isArray(payload.timeline) ? payload.timeline.filter(Boolean) : [];
  const relatedQuestions = Array.isArray(payload.relatedQuestions) ? payload.relatedQuestions.filter(Boolean) : [];

  const hasStructure = Boolean(
    answer || keyPoints.length || sources.length || tableMarkdown || timeline.length || relatedQuestions.length
  );

  return {
    type: payload.type || "summary",
    answer,
    keyPoints,
    sources,
    confidence,
    tableMarkdown,
    timeline,
    relatedQuestions,
    hasStructure,
  };
}

export function parseSections(text = "") {
  const content = String(text || "");

  const answer = (content.match(sectionRegex("Answer|Quick Answer|Summary")) || [])[1] || "";
  const keyBlock = (content.match(sectionRegex("Key Findings|Key Points|Evidence")) || [])[1] || "";
  const sourceBlock = (content.match(sectionRegex("Sources|References")) || [])[1] || "";
  const confidenceBlock = (content.match(sectionRegex("Confidence")) || [])[1] || "";
  const relatedBlock = (content.match(sectionRegex("Related Questions|Follow[- ]?ups")) || [])[1] || "";

  const keyPoints = keyBlock
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  const sources = sourceBlock
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  const relatedQuestions = relatedBlock
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  let confidence = null;
  const confMatch = confidenceBlock.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (confMatch) {
    const val = Number(confMatch[1]);
    if (Number.isFinite(val)) confidence = val > 1 ? val / 100 : val;
  }

  return { answer: answer.trim(), keyPoints, sources, confidence, relatedQuestions };
}
