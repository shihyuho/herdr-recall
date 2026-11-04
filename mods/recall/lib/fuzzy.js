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
//
// `search` orders by that score (Clues still does). `tiered`, which every
// other list uses, orders by tier instead and keeps the given order within
// each; there the score only decides where highlights go.

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
 * The best place in one text where a term appears unbroken (as one run of
 * consecutive characters, smart case): `{ score, indices }`, or null when it
 * appears nowhere unbroken. Of several occurrences, the one fzf would score
 * highest wins, so a run at a word start beats one inside a word.
 */
function unbrokenIn(text, term) {
  const hay = chars(text);
  const needle = chars(term);
  const m = needle.length;
  if (m === 0 || m > hay.length) return null;
  const sensitive = term !== term.toLowerCase();
  const h = sensitive ? hay : hay.map((c) => c.toLowerCase());
  const q = sensitive ? needle : needle.map((c) => c.toLowerCase());
  let best = null;
  for (let s = 0; s + m <= h.length; s++) {
    let k = 0;
    while (k < m && h[s + k] === q[k]) k++;
    if (k < m) continue;
    let score = SCORE_MATCH * m + BONUS_CONSECUTIVE * (m - 1) + boundaryBonus(hay, s) * BONUS_FIRST_MULTIPLIER;
    for (let i = s + 1; i < s + m; i++) score += boundaryBonus(hay, i);
    if (!best || score > best.score) best = { score, indices: Array.from({ length: m }, (_, i) => s + i) };
  }
  return best;
}

/**
 * Where one term lands among an item's fields: `{ key, indices, unbroken }`,
 * or null when it matches no field. A field where the term appears unbroken
 * beats any fuzzy alignment; among equals the higher score wins, and the
 * name (`title`) wins a tie.
 */
function placeTerm(fields, term) {
  let best = null;
  const better = (c) => {
    if (!best) return true;
    if (c.unbroken !== best.unbroken) return c.unbroken;
    if (c.score !== best.score) return c.score > best.score;
    return c.key === "title" && best.key !== "title";
  };
  for (const f of fields) {
    if (!f.text) continue;
    const exact = unbrokenIn(f.text, term);
    const r = exact ?? matchTerm(f.text, term);
    if (!r) continue;
    const c = { key: f.key, indices: r.indices, score: r.score, unbroken: !!exact };
    if (better(c)) best = c;
  }
  return best;
}

/**
 * Filters items by a query and sorts the matches into two tiers (ADR 0002):
 * items where every term appears unbroken in some field, then the rest.
 * Each tier keeps the items' given order; the fuzzy score only decides
 * where a term's highlight goes. Returns `[{ item, hits }]` as `search`.
 */
export function tiered(items, query, fieldsOf) {
  const ts = terms(query);
  if (ts.length === 0) return items.map((item) => ({ item, hits: {} }));
  const upper = [];
  const lower = [];
  for (const item of items) {
    const fields = fieldsOf(item);
    const hits = {};
    let unbroken = true;
    let matched = true;
    for (const term of ts) {
      const p = placeTerm(fields, term);
      if (!p) { matched = false; break; }
      unbroken &&= p.unbroken;
      hits[p.key] = [...new Set([...(hits[p.key] ?? []), ...p.indices])].sort((a, b) => a - b);
    }
    if (matched) (unbroken ? upper : lower).push({ item, hits });
  }
  return [...upper, ...lower];
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
