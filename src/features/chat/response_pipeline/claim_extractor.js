export function extractClaims(text = "") {
  const src = String(text || "");
  const sentences = src
    .replace(/\n/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length > 18);

  const unique = [];
  const seen = new Set();
  for (const s of sentences) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
    if (unique.length >= 8) break;
  }
  return unique;
}
