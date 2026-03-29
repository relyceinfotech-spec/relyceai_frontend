export function mapClaimsToSources(claims = [], sources = []) {
  const normalizedSources = (Array.isArray(sources) ? sources : [])
    .map((s) => {
      if (typeof s === "string") return { url: s };
      if (s && typeof s === "object") return { url: s.url || s.link || "", ...s };
      return null;
    })
    .filter(Boolean)
    .filter((s) => Boolean(s.url));

  if (!normalizedSources.length) return {};

  const mapped = {};
  claims.forEach((claim, i) => {
    const source = normalizedSources[i % normalizedSources.length];
    mapped[claim] = source.url;
  });

  return mapped;
}
