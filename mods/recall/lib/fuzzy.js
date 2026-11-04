// Fuzzy search for the navigator.
//
// A query splits on whitespace into terms. Every term must match one of an
// item's fields as a subsequence; the item's score is the sum of each term's
// best field score. A lowercase term ignores case; a term with an uppercase
// letter matches case exactly (smart case).
//
// Scoring follows fzf's shape: each matched character scores, characters at
// a word boundary or right after the previous match score extra, and gaps
// between matches cost. So "fl" ranks "fix-login" above "conflict".

const SCORE_MATCH = 16;
const BONUS_BOUNDARY = 10;
const BONUS_CAMEL = 8;
const BONUS_CONSECUTIVE = 8;
const BONUS_FIRST_MULTIPLIER = 2;
const PENALTY_GAP_START = 3;
const PENALTY_GAP_EXTEND = 1;
const SEPARATOR = /[\s\-_/\\.:·›|@()[\]{}"',;=+#~⎇]/u;
const LOWER = /\p{Ll}/u;
const UPPER = /\p{Lu}/u;

function chars(text) {
  return Array.from(text ?? "");
}

function boundaryBonus(cs, i) {
  if (i === 0) return BONUS_BOUNDARY;
  const prev = cs[i - 1];
  if (SEPARATOR.test(prev)) return BONUS_BOUNDARY;
  if (LOWER.test(prev) && UPPER.test(cs[i])) return BONUS_CAMEL;
  return 0;
}

/**
 * Best alignment of one term in one text: `{ score, indices }` with indices
 * in code points, or null when the term is not a subsequence of the text.
 */
export function matchTerm(text, term) {
  const hay = chars(text);
  const needle = chars(term);
  const n = hay.length;
  const m = needle.length;
  if (m === 0) return { score: 0, indices: [] };
  if (m > n) return null;
  const sensitive = term !== term.toLowerCase();
  const h = sensitive ? hay : hay.map((c) => c.toLowerCase());
  const q = sensitive ? needle : needle.map((c) => c.toLowerCase());
  const bonus = hay.map((_, i) => boundaryBonus(hay, i));

  const NONE = -Infinity;
  const score = [];
  const from = [];
  for (let j = 0; j < m; j++) {
    const row = new Array(n).fill(NONE);
    const back = new Array(n).fill(-1);
    const prev = score[j - 1];
    // Best of prev[k] + EXTEND * k over k <= i - 2: a match with a gap.
    let pool = NONE;
    let poolAt = -1;
    for (let i = j; i < n; i++) {
      if (j > 0 && i >= 2) {
        const k = i - 2;
        const v = prev[k] + PENALTY_GAP_EXTEND * k;
        if (v > pool) { pool = v; poolAt = k; }
      }
      if (h[i] !== q[j]) continue;
      if (j === 0) {
        row[i] = SCORE_MATCH + bonus[i] * BONUS_FIRST_MULTIPLIER;
        continue;
      }
      let best = NONE;
      let bestAt = -1;
      if (prev[i - 1] > NONE) {
        best = prev[i - 1] + BONUS_CONSECUTIVE;
        bestAt = i - 1;
      }
      if (pool > NONE) {
        const gap = pool - PENALTY_GAP_START - PENALTY_GAP_EXTEND * (i - 2);
        if (gap > best) { best = gap; bestAt = poolAt; }
      }
      if (best === NONE) continue;
      row[i] = SCORE_MATCH + bonus[i] + best;
      back[i] = bestAt;
    }
    score.push(row);
    from.push(back);
  }

  const last = score[m - 1];
  let end = -1;
  for (let i = 0; i < n; i++) if (last[i] > NONE && (end < 0 || last[i] > last[end])) end = i;
  if (end < 0) return null;
  const indices = new Array(m);
  for (let j = m - 1, i = end; j >= 0; j--) {
    indices[j] = i;
    i = from[j][i];
  }
  return { score: last[end], indices };
}

/** Whitespace-separated terms of a query, empty ones dropped. */
export function terms(query) {
  return (query ?? "").trim().split(/\s+/u).filter(Boolean);
}

/**
 * Matches a query against an item's fields (`[{ key, text }]`).
 * Returns `{ score, hits }`, where `hits[key]` lists the matched code-point
 * indices of that field in ascending order, or null when any term matches
 * no field. An empty query matches with score 0 and no hits.
 */
export function matchFields(fields, query) {
  const ts = terms(query);
  const hits = {};
  let total = 0;
  for (const term of ts) {
    let best = null;
    let bestKey = null;
    for (const f of fields) {
      if (!f.text) continue;
      const r = matchTerm(f.text, term);
      if (r && (!best || r.score > best.score)) { best = r; bestKey = f.key; }
    }
    if (!best) return null;
    total += best.score;
    const set = new Set(hits[bestKey] ?? []);
    for (const i of best.indices) set.add(i);
    hits[bestKey] = [...set].sort((a, b) => a - b);
  }
  return { score: total, hits };
}

/**
 * Filters items by a query and orders them best match first. Items keep
 * their given order when scores tie, and when the query is empty.
 * `fieldsOf(item)` gives the item's searchable fields.
 */
export function search(items, query, fieldsOf) {
  if (terms(query).length === 0) return items.map((item) => ({ item, hits: {} }));
  const out = [];
  items.forEach((item, order) => {
    const r = matchFields(fieldsOf(item), query);
    if (r) out.push({ item, hits: r.hits, score: r.score, order });
  });
  out.sort((a, b) => b.score - a.score || a.order - b.order);
  return out.map(({ item, hits }) => ({ item, hits }));
}

/**
 * Splits text into runs for drawing: `[{ text, hit }]`, where `hit` marks
 * the code points at `indices`. Adjacent code points of the same kind join.
 */
export function segments(text, indices) {
  const cs = chars(text);
  const marked = new Set(indices ?? []);
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const hit = marked.has(i);
    const tail = out[out.length - 1];
    if (tail && tail.hit === hit) tail.text += cs[i];
    else out.push({ text: cs[i], hit });
  }
  return out;
}
