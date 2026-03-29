export function scoreConfidence({
  sources = [],
  claims = [],
  verificationRate = 1,
  modelConfidence = null,
}) {
  if (typeof modelConfidence === "number" && Number.isFinite(modelConfidence)) {
    return Math.max(0, Math.min(1, modelConfidence));
  }

  const sourceCount = Array.isArray(sources) ? sources.length : 0;
  const claimCount = Array.isArray(claims) ? claims.length : 0;

  const sourceFactor = Math.min(1, sourceCount / 3);
  const claimFactor = Math.min(1, claimCount / 4);
  const verification = Math.max(0, Math.min(1, Number(verificationRate) || 0));

  return Number((0.45 * sourceFactor + 0.35 * claimFactor + 0.2 * verification).toFixed(4));
}
