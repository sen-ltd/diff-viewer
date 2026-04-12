/**
 * diff.js — Core diff algorithm and utilities
 * LCS-based (Longest Common Subsequence) line-by-line diff
 * Zero dependencies.
 */

/**
 * Build LCS length table between two arrays.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number[][]}
 */
function buildLCSTable(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Backtrack the LCS table to produce raw edit operations.
 * Returns array of { type: 'equal'|'add'|'remove', oldLine, newLine, oldIdx, newIdx }
 * @param {number[][]} dp
 * @param {string[]} a  old lines
 * @param {string[]} b  new lines
 * @returns {Array<{type:string, oldLine?:string, newLine?:string, oldIdx?:number, newIdx?:number}>}
 */
function backtrack(dp, a, b) {
  const ops = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal', oldLine: a[i - 1], newLine: b[j - 1], oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'add', newLine: b[j - 1], newIdx: j - 1 });
      j--;
    } else {
      ops.push({ type: 'remove', oldLine: a[i - 1], oldIdx: i - 1 });
      i--;
    }
  }

  ops.reverse();
  return ops;
}

/**
 * Merge adjacent remove/add pairs into 'change' operations.
 * @param {Array} ops
 * @returns {Array}
 */
function mergeChanges(ops) {
  const result = [];
  let i = 0;
  while (i < ops.length) {
    if (
      ops[i].type === 'remove' &&
      i + 1 < ops.length &&
      ops[i + 1].type === 'add'
    ) {
      result.push({
        type: 'change',
        oldLine: ops[i].oldLine,
        newLine: ops[i + 1].newLine,
        oldIdx: ops[i].oldIdx,
        newIdx: ops[i + 1].newIdx,
      });
      i += 2;
    } else {
      result.push(ops[i]);
      i++;
    }
  }
  return result;
}

/**
 * Compute line-by-line diff between two texts.
 * @param {string[]} oldLines
 * @param {string[]} newLines
 * @returns {Array<{type:'equal'|'add'|'remove'|'change', oldLine?:string, newLine?:string, oldIdx?:number, newIdx?:number}>}
 */
export function computeDiff(oldLines, newLines) {
  if (oldLines.length === 0 && newLines.length === 0) return [];
  if (oldLines.length === 0) {
    return newLines.map((line, i) => ({ type: 'add', newLine: line, newIdx: i }));
  }
  if (newLines.length === 0) {
    return oldLines.map((line, i) => ({ type: 'remove', oldLine: line, oldIdx: i }));
  }
  const dp = buildLCSTable(oldLines, newLines);
  const raw = backtrack(dp, oldLines, newLines);
  return mergeChanges(raw);
}

/**
 * Compute word-level inline diff between two strings.
 * @param {string} oldStr
 * @param {string} newStr
 * @returns {Array<{type:'equal'|'add'|'remove', text:string}>}
 */
export function computeInlineDiff(oldStr, newStr) {
  // Tokenize: split on word boundaries keeping delimiters
  const tokenize = (s) => s.match(/\S+|\s+/g) || [];
  const oldTokens = tokenize(oldStr);
  const newTokens = tokenize(newStr);

  if (oldTokens.length === 0 && newTokens.length === 0) return [];
  if (oldTokens.length === 0) {
    return newTokens.map((t) => ({ type: 'add', text: t }));
  }
  if (newTokens.length === 0) {
    return oldTokens.map((t) => ({ type: 'remove', text: t }));
  }

  const dp = buildLCSTable(oldTokens, newTokens);
  const raw = backtrack(dp, oldTokens, newTokens);

  // Convert to inline format (no 'change' merging at token level)
  return raw.map((op) => {
    if (op.type === 'equal') return { type: 'equal', text: op.oldLine };
    if (op.type === 'add') return { type: 'add', text: op.newLine };
    return { type: 'remove', text: op.oldLine };
  });
}

/**
 * Check whether a string is valid JSON.
 * @param {string} str
 * @returns {boolean}
 */
export function isJSON(str) {
  if (typeof str !== 'string' || str.trim() === '') return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize JSON: parse and re-serialize with sorted keys and 2-space indent.
 * @param {string} str
 * @returns {string}
 */
export function normalizeJSON(str) {
  const sortKeys = (val) => {
    if (Array.isArray(val)) return val.map(sortKeys);
    if (val !== null && typeof val === 'object') {
      const sorted = {};
      Object.keys(val).sort().forEach((k) => {
        sorted[k] = sortKeys(val[k]);
      });
      return sorted;
    }
    return val;
  };
  return JSON.stringify(sortKeys(JSON.parse(str)), null, 2);
}

/**
 * Check whether a string looks like simple YAML (key: value pairs).
 * @param {string} str
 * @returns {boolean}
 */
export function isYAML(str) {
  if (typeof str !== 'string' || str.trim() === '') return false;
  const lines = str.trim().split('\n');
  // At least one line must match key: value pattern
  const yamlLine = /^\s*[\w.\-]+\s*:.*/;
  return lines.length > 0 && lines.some((l) => yamlLine.test(l));
}

/**
 * Simple YAML normalizer: parse key:value pairs and re-emit sorted by key.
 * Only handles flat key: value YAML (no nested objects/arrays).
 * @param {string} str
 * @returns {string}
 */
export function normalizeYAML(str) {
  const lines = str.trim().split('\n');
  const entries = [];
  for (const line of lines) {
    const match = line.match(/^(\s*)([\w.\-]+)\s*:\s*(.*)$/);
    if (match) {
      entries.push({ indent: match[1], key: match[2], value: match[3] });
    } else {
      // Pass through non-matching lines (comments, blank lines, etc.)
      entries.push({ raw: line });
    }
  }
  // Sort only pure key:value entries (grouped by indent level)
  const kvEntries = entries.filter((e) => !e.raw);
  kvEntries.sort((a, b) => a.key.localeCompare(b.key));

  // Reconstruct: non-kv lines pass through, kv lines come out sorted
  let kvIdx = 0;
  return entries
    .map((e) => {
      if (e.raw !== undefined) return e.raw;
      const kv = kvEntries[kvIdx++];
      return `${kv.indent}${kv.key}: ${kv.value}`;
    })
    .join('\n');
}

/**
 * Compute statistics from a diff ops array.
 * @param {Array} ops
 * @returns {{ additions: number, deletions: number, changes: number, unchanged: number }}
 */
export function diffStats(ops) {
  let additions = 0;
  let deletions = 0;
  let changes = 0;
  let unchanged = 0;
  for (const op of ops) {
    if (op.type === 'add') additions++;
    else if (op.type === 'remove') deletions++;
    else if (op.type === 'change') changes++;
    else unchanged++;
  }
  return { additions, deletions, changes, unchanged };
}

/**
 * Convert diff ops to unified diff format string.
 * @param {Array} ops
 * @param {string} [filename]
 * @returns {string}
 */
export function toUnifiedFormat(ops, filename = 'file') {
  const lines = [];
  lines.push(`--- a/${filename}`);
  lines.push(`+++ b/${filename}`);

  // Group into hunks (consecutive changed/added/removed with context)
  const CONTEXT = 3;
  const all = [];
  for (const op of ops) {
    if (op.type === 'equal') {
      all.push({ marker: ' ', text: op.oldLine });
    } else if (op.type === 'add') {
      all.push({ marker: '+', text: op.newLine });
    } else if (op.type === 'remove') {
      all.push({ marker: '-', text: op.oldLine });
    } else if (op.type === 'change') {
      all.push({ marker: '-', text: op.oldLine });
      all.push({ marker: '+', text: op.newLine });
    }
  }

  if (all.length === 0) return lines.join('\n');

  // Find changed line indices
  const changedIndices = all
    .map((l, i) => (l.marker !== ' ' ? i : -1))
    .filter((i) => i >= 0);

  if (changedIndices.length === 0) return lines.join('\n');

  // Build hunk ranges
  const hunks = [];
  let hunkStart = Math.max(0, changedIndices[0] - CONTEXT);
  let hunkEnd = Math.min(all.length - 1, changedIndices[0] + CONTEXT);

  for (let k = 1; k < changedIndices.length; k++) {
    const next = changedIndices[k];
    if (next - CONTEXT <= hunkEnd + 1) {
      hunkEnd = Math.min(all.length - 1, next + CONTEXT);
    } else {
      hunks.push([hunkStart, hunkEnd]);
      hunkStart = Math.max(0, next - CONTEXT);
      hunkEnd = Math.min(all.length - 1, next + CONTEXT);
    }
  }
  hunks.push([hunkStart, hunkEnd]);

  for (const [start, end] of hunks) {
    const hunkLines = all.slice(start, end + 1);
    const oldStart = start + 1;
    const oldCount = hunkLines.filter((l) => l.marker !== '+').length;
    const newStart = start + 1;
    const newCount = hunkLines.filter((l) => l.marker !== '-').length;
    lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const l of hunkLines) {
      lines.push(`${l.marker}${l.text}`);
    }
  }

  return lines.join('\n');
}
