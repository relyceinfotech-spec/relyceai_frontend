import React, { memo, useMemo, useState, useEffect } from 'react';
import {
  Atom,
  ChevronDown,
  ChevronUp,
  Search,
  FileText,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

const NOISE_TOKENS = [
  'queued for execution',
  'request is waiting in queue',
  'queued',
  'running on heavy lane',
  'running on fast lane',
  'using deeper reasoning and tool workflow',
  'using low-latency path for quick reply',
  'agent started',
  'execution has started',
  'task started',
  'beginning the task workflow',
  'classified request as',
  'checking recent query cache and retrieval memory',
  'plan ready',
  'understanding your request',
  'understanding request',
  'analyzing request',
  'analyzing intent and constraints',
  'breaking down the request into actionable steps',
  'selected execution route',
  'executing plan nodes and tool steps',
  'updated findings from latest step',
  'verifying evidence',
  'verification complete',
  'updated confidence estimate',
  'running quality check',
  'repairing strategy after review',
  'need more evidence - continuing research',
  'reusing trusted memory evidence',
  'loaded relevant facts from prior verified runs',
  'reliability budget exhausted',
  'finalizing best-safe answer',
  'direct response path selected',
  'no tools needed for this request',
  'drafting final response',
  'composing final answer',
  'final answer ready',
  'completed',
];

const normalizeText = (value) =>
  String(value || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const shorten = (value, max = 260) => {
  const clean = normalizeText(value);
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3))}...`;
};

const isNoise = (text) => {
  const lower = normalizeText(text).toLowerCase();
  if (!lower) return true;
  return NOISE_TOKENS.some((token) => lower.includes(token));
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());
const looksLikeDirectReply = (line) => {
  const text = normalizeText(line).toLowerCase();
  if (!text) return false;
  if (text.includes('how about you')) return true;
  if (/^(hey|hello|hi)\b/.test(text)) return true;
  if (/^i('?| a)m\s+(doing|good|great|fine|ready)\b/.test(text)) return true;
  return false;
};

const normalizeLogEntry = (entry, index) => {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const title = shorten(entry, 220);
    if (!title) return null;
    return {
      id: `log-${index}-${title.toLowerCase()}`,
      title,
      detail: '',
      kind: 'reasoning',
      status: 'running',
    };
  }

  const title = shorten(entry.title || entry.text || entry.message || '', 220);
  const detail = shorten(entry.detail || '', 320);
  if (!title) return null;

  return {
    id: `log-${index}-${String(entry.dedupeKey || title).toLowerCase()}`,
    title,
    detail,
    kind: String(entry.kind || '').toLowerCase(),
    status: String(entry.status || '').toLowerCase(),
    state: String(entry.state || '').toLowerCase(),
    resultCount: Number.isFinite(Number(entry.resultCount)) ? Number(entry.resultCount) : 0,
    resultItems: Array.isArray(entry.resultItems)
      ? entry.resultItems
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const chipTitle = shorten(item.title || item.name || item.snippet || item.url || item.link || '', 70);
            const chipUrl = String(item.url || item.link || '').trim();
            if (!chipTitle) return null;
            return { title: chipTitle, url: chipUrl };
          })
          .filter(Boolean)
      : [],
    readTitle: shorten(entry.readTitle || '', 120),
    readUrl: String(entry.readUrl || '').trim(),
    resultHint: shorten(entry.resultHint || '', 200),
  };
};

const isActionEntry = (entry) => {
  const titleLower = entry.title.toLowerCase();
  if (entry.kind === 'search' || entry.kind === 'read') return true;
  return /^(searching|searched|reading|read)\b/.test(titleLower);
};

const buildNarrativeFromThinking = (thinkingContent) => {
  const cleaned = String(thinkingContent || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\[THINKING\]\s*$/gim, '')
    .replace(/^\s*\[\/THINKING\]\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) return [];

  const rawBlocks = cleaned
    .split(/\n{2,}/)
    .map((line) => shorten(line, 280))
    .filter(Boolean);

  const normalized = rawBlocks
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !isNoise(line))
    .filter((line) => !looksLikeDirectReply(line))
    .filter((line) => !/^tool_call\s*:/i.test(line))
    .filter((line) => !/^tool_result\s*:/i.test(line))
    .filter((line) => !/^status\s*:/i.test(line))
    .filter((line) => !/^source\s*:/i.test(line));

  const unique = [];
  const seen = new Set();
  for (const paragraph of normalized) {
    const key = paragraph.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(paragraph);
    if (unique.length >= 3) break;
  }
  return unique;
};

const buildNarrativeFromLogs = ({ logs }) => {
  const candidates = (logs || [])
    .filter((entry) => !isActionEntry(entry))
    .map((entry) => {
      const merged = entry.detail ? `${entry.title}. ${entry.detail}` : entry.title;
      return shorten(merged, 280);
    })
    .filter(Boolean)
    .filter((line) => !isNoise(line))
    .filter((line) => !looksLikeDirectReply(line));

  const unique = [];
  const seen = new Set();
  for (const line of candidates) {
    const key = normalizeText(line).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
    if (unique.length >= 3) break;
  }
  return unique;
};

const AgentMetaBlock = ({ logs, thinkingContent, isStreaming }) => {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (isStreaming) setExpanded(true);
  }, [isStreaming]);

  const normalizedLogs = useMemo(
    () => (Array.isArray(logs) ? logs.map(normalizeLogEntry).filter(Boolean) : []),
    [logs]
  );

  const actionRows = useMemo(() => {
    const rows = normalizedLogs.filter((item) => {
      if (!isActionEntry(item)) return false;
      if (isNoise(`${item.title} ${item.detail}`)) return false;
      return true;
    });
    const deduped = [];
    const seen = new Set();
    for (const row of rows) {
      const key = `${row.title}|${row.detail}|${row.status}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }
    return deduped.slice(-8);
  }, [normalizedLogs]);

  const reasoningParagraphs = useMemo(() => {
    const fromThinking = buildNarrativeFromThinking(thinkingContent);
    if (fromThinking.length > 0) return fromThinking;
    return buildNarrativeFromLogs({ logs: normalizedLogs });
  }, [thinkingContent, normalizedLogs]);

  const headingMeta = useMemo(() => {
    if (isStreaming) {
      const activeAction = [...actionRows].reverse().find((row) => {
        const status = String(row?.status || '').toLowerCase();
        return status === 'running' || status === 'pending' || !status;
      });
      if (activeAction?.kind === 'search') {
        return { label: 'Searching the web', Icon: Atom };
      }
      if (activeAction?.kind === 'read') {
        return { label: 'Reading sources', Icon: Atom };
      }
      return { label: 'Thinking', Icon: Atom };
    }
    return { label: 'Thoughts', Icon: Atom };
  }, [actionRows, isStreaming]);

  const showPlaceholder = isStreaming && reasoningParagraphs.length === 0 && actionRows.length === 0;
  if (!showPlaceholder && reasoningParagraphs.length === 0 && actionRows.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex items-center gap-2.5 text-zinc-100 hover:text-white transition-colors"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/90">
          <headingMeta.Icon size={13} className="text-zinc-200" />
        </span>
        <span className="text-[15px] sm:text-[16px] leading-none font-semibold tracking-tight">{headingMeta.label}</span>
        {isStreaming && <Loader2 size={13} className="animate-spin text-zinc-400" />}
        {expanded ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {showPlaceholder && (
            <div className="border-l-2 border-white/55 pl-3.5 text-[14px] leading-6 text-zinc-300">
              Gathering reasoning updates...
            </div>
          )}
          {reasoningParagraphs.length > 0 && (
            <div className="border-l-2 border-white/60 pl-3.5 text-[14px] leading-[1.62] text-zinc-200 font-medium max-w-4xl">
              {reasoningParagraphs.map((paragraph, idx) => (
                <p key={`reasoning-${idx}`} className={idx === 0 ? '' : 'mt-2'}>
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {actionRows.length > 0 && (
            <div className="space-y-2">
              {actionRows.map((row) => {
                const done = row.status === 'done' || row.status === 'success' || row.status === 'ok' || row.status === 'completed';
                const failed = row.status === 'error' || row.status === 'failed' || row.status === 'blocked' || row.status === 'throttled';
                const running = !done && isStreaming && (row.status === 'running' || row.status === 'pending' || !row.status);
                const icon = row.kind === 'read'
                  ? <FileText size={14} className="text-zinc-300 mt-0.5 shrink-0" />
                  : <Search size={14} className="text-zinc-300 mt-0.5 shrink-0" />;

                return (
                  <div key={row.id} className="flex items-start gap-2 text-zinc-100">
                    {icon}
                    <div className="min-w-0">
                      <div className="text-[14px] leading-5 font-semibold">{row.title}</div>
                      {row.detail && (
                        <div className="text-[13px] leading-5 text-zinc-300 font-medium">{row.detail}</div>
                      )}
                      {row.kind === 'search' && row.resultCount > 0 && !/^found\s+\d+\s+results?/i.test(row.detail || '') && (
                        <div className="text-[12px] leading-4 text-zinc-400">Found {row.resultCount} results</div>
                      )}
                      {Array.isArray(row.resultItems) && row.resultItems.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {row.resultItems.slice(0, 3).map((item, idx) => (
                            isHttpUrl(item.url) ? (
                              <a
                                key={`${row.id}-item-${idx}`}
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex max-w-[300px] items-center rounded-full border border-zinc-700/90 bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-zinc-500 hover:text-white"
                                title={item.title}
                              >
                                <span className="truncate">{item.title}</span>
                              </a>
                            ) : (
                              <span
                                key={`${row.id}-item-${idx}`}
                                className="inline-flex max-w-[300px] items-center rounded-full border border-zinc-700/90 bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-200"
                                title={item.title}
                              >
                                <span className="truncate">{item.title}</span>
                              </span>
                            )
                          ))}
                          {row.resultCount > row.resultItems.slice(0, 3).length && (
                            <span className="inline-flex items-center rounded-full border border-zinc-700/90 bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-300">
                              +{row.resultCount - row.resultItems.slice(0, 3).length} more
                            </span>
                          )}
                        </div>
                      )}
                      {done && (
                        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
                          <CheckCircle2 size={11} />
                          <span>Step completed</span>
                        </div>
                      )}
                      {failed && (
                        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10 px-2.5 py-0.5 text-[11px] text-rose-300">
                          <AlertTriangle size={11} />
                          <span>Step failed</span>
                        </div>
                      )}
                      {running && (
                        <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                          <Loader2 size={11} className="animate-spin" />
                          <span>Working...</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(AgentMetaBlock);
