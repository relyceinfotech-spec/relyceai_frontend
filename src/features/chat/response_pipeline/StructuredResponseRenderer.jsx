import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const BLOCK_ORDER = ["text", "list", "table", "timeline", "card"];

const sortBlocks = (blocks = []) => {
  return [...blocks].sort((a, b) => {
    const ai = BLOCK_ORDER.indexOf(a?.type);
    const bi = BLOCK_ORDER.indexOf(b?.type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
};

const normalizeLegacyToBlocks = (response) => {
  const blocks = Array.isArray(response?.blocks) ? response.blocks : [];
  if (blocks.length > 0) return sortBlocks(blocks);

  const out = [];
  if (response?.answer) {
    out.push({ type: "text", title: "Answer", content: response.answer });
  }
  if (Array.isArray(response?.keyPoints) && response.keyPoints.length > 0) {
    out.push({ type: "list", title: "Key Points", items: response.keyPoints.slice(0, 8) });
  }
  if (response?.tableMarkdown) {
    out.push({ type: "table_markdown", title: "Table", markdown: response.tableMarkdown });
  }
  if (Array.isArray(response?.timeline) && response.timeline.length > 0) {
    out.push({
      type: "timeline",
      title: "Timeline",
      events: response.timeline.map((event) => ({ time: "", event })),
    });
  }
  return out;
};

const domainLabel = (domain = "") =>
  String(domain || "general")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

const normalizeSource = (source) => {
  if (!source) return null;
  if (typeof source === "string") {
    return { label: source, href: source.startsWith("http") ? source : "" };
  }

  if (typeof source === "object") {
    const href = String(source.url || source.link || "").trim();
    const label = String(source.name || source.title || href || "Source").trim();
    if (!label && !href) return null;
    return { label: label || href, href };
  }

  return null;
};

export default function StructuredResponseRenderer({ response, onFollowupClick }) {
  if (!response?.hasStructure) return null;

  const blocks = normalizeLegacyToBlocks(response);
  const meta = response?.metadata || {};
  const highStakes = meta?.high_stakes || {};
  const sourceEval = highStakes?.source_eval || {};

  const renderBlock = (block, index) => {
    if (!block || typeof block !== "object") return null;
    const key = `${block.type || "block"}-${index}`;

    if (block.type === "text") {
      return (
        <section key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          {block.title ? (
            <div className="text-[10px] uppercase tracking-widest text-white/60 mb-2">{block.title}</div>
          ) : null}
          <div className="text-sm text-zinc-100 leading-relaxed">{block.content}</div>
        </section>
      );
    }

    if (block.type === "list") {
      const items = Array.isArray(block.items) ? block.items : [];
      if (!items.length) return null;
      return (
        <section key={key}>
          {block.title ? (
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">{block.title}</div>
          ) : null}
          <ul className="space-y-1.5">
            {items.slice(0, 10).map((item, i) => (
              <li key={`${key}-item-${i}`} className="text-sm text-zinc-200 flex gap-2">
                <span className="text-white/50">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    }

    if (block.type === "table") {
      const columns = Array.isArray(block.columns) ? block.columns : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      if (!columns.length || !rows.length) return null;
      const markdown = [
        `| ${columns.join(" | ")} |`,
        `| ${columns.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.join(" | ")} |`),
      ].join("\n");
      return (
        <section key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {block.title ? (
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">{block.title}</div>
          ) : null}
          <div className="prose prose-invert max-w-none prose-table:text-xs prose-th:text-zinc-200 prose-td:text-zinc-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        </section>
      );
    }

    if (block.type === "table_markdown") {
      return (
        <section key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {block.title ? (
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">{block.title}</div>
          ) : null}
          <div className="prose prose-invert max-w-none prose-table:text-xs prose-th:text-zinc-200 prose-td:text-zinc-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.markdown}</ReactMarkdown>
          </div>
        </section>
      );
    }

    if (block.type === "timeline") {
      const events = Array.isArray(block.events) ? block.events : [];
      if (!events.length) return null;
      return (
        <section key={key}>
          {block.title ? (
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">{block.title}</div>
          ) : null}
          <div className="space-y-1.5">
            {events.slice(0, 12).map((ev, i) => (
              <div key={`${key}-ev-${i}`} className="text-sm text-zinc-300 border-l border-white/15 pl-3">
                {ev?.time ? `${ev.time} - ` : ""}
                {ev?.event || ""}
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (block.type === "card") {
      const fields = block?.fields && typeof block.fields === "object" ? block.fields : {};
      const entries = Object.entries(fields);
      if (!entries.length && !block?.title) return null;
      return (
        <section key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          {block.title ? (
            <div className="text-[10px] uppercase tracking-widest text-white/60 mb-3">{block.title}</div>
          ) : null}
          <div className="space-y-2">
            {entries.slice(0, 10).map(([k, v]) => (
              <div key={`${key}-${k}`} className="text-sm text-zinc-200">
                <span className="text-white/60 mr-2">{k}:</span>
                <span>{String(v)}</span>
              </div>
            ))}
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4 mt-4">
      <section className="flex flex-wrap items-center gap-2 text-[11px]">
        {meta?.domain ? (
          <span className="px-2 py-1 rounded-full border border-white/15 text-zinc-300 bg-white/[0.02]">
            Domain: {domainLabel(meta.domain)}
          </span>
        ) : null}
        {response?.confidence_level ? (
          <span className="px-2 py-1 rounded-full border border-white/15 text-zinc-300 bg-white/[0.02]">
            Confidence: {response.confidence_level}
          </span>
        ) : null}
        {highStakes?.enabled ? (
          <span className="px-2 py-1 rounded-full border border-amber-400/30 text-amber-300 bg-amber-400/10">
            High-Stakes Mode
          </span>
        ) : null}
      </section>

      {highStakes?.enabled ? (
        <section className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200">
          <div>{highStakes?.disclaimer || "Verify with qualified professionals or primary sources."}</div>
          <div className="mt-2 text-amber-100/80">
            Sources: {sourceEval?.authoritative_sources ?? 0}/{sourceEval?.min_required_sources ?? 0}
            {typeof sourceEval?.recency_days === "number" ? ` | Recency <= ${sourceEval.recency_days}d` : ""}
            {sourceEval?.recency_requirement_met === false ? " | Recency check failed" : ""}
          </div>
        </section>
      ) : null}

      {blocks.map((block, index) => renderBlock(block, index))}

      {Array.isArray(response.sources) && response.sources.length > 0 ? (
        <section>
          <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Sources</div>
          <div className="flex flex-wrap gap-2">
            {response.sources
              .map(normalizeSource)
              .filter(Boolean)
              .slice(0, 6)
              .map((source, i) => (
                <a
                  key={`${source.label}-${i}`}
                  href={source.href || undefined}
                  target={source.href ? "_blank" : undefined}
                  rel={source.href ? "noreferrer" : undefined}
                  className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white"
                >
                  {source.label.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                </a>
              ))}
          </div>
        </section>
      ) : null}

      {typeof response.confidence === "number" ? (
        <section className="text-xs text-zinc-400">
          Confidence: <span className="text-zinc-200">{Math.round(response.confidence * 100)}%</span>
        </section>
      ) : null}

      {Array.isArray(response.relatedQuestions) && response.relatedQuestions.length > 0 ? (
        <section>
          <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Related Questions</div>
          <div className="flex flex-wrap gap-2">
            {response.relatedQuestions.slice(0, 4).map((q, i) => (
              <button
                key={`${q}-${i}`}
                onClick={() => onFollowupClick && onFollowupClick(q)}
                className="text-[12px] px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.03] text-zinc-200 hover:text-white hover:border-emerald-400/40"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
