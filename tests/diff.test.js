/**
 * diff.test.js — Tests for diff.js using Node's built-in test runner
 * Run: node --test tests/diff.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDiff,
  computeInlineDiff,
  isJSON,
  isYAML,
  normalizeJSON,
  normalizeYAML,
  diffStats,
  toUnifiedFormat,
} from '../src/diff.js';

// ── Helper ─────────────────────────────────────────────────────────────────
function lines(str) {
  return str.split('\n');
}

// ── computeDiff ────────────────────────────────────────────────────────────
describe('computeDiff', () => {
  it('returns empty array for two identical empty inputs', () => {
    const ops = computeDiff([], []);
    assert.deepEqual(ops, []);
  });

  it('returns empty ops for two identical single-line texts', () => {
    const ops = computeDiff(lines('hello'), lines('hello'));
    assert.equal(ops.length, 1);
    assert.equal(ops[0].type, 'equal');
  });

  it('returns empty ops for identical multi-line texts', () => {
    const text = 'line1\nline2\nline3';
    const ops = computeDiff(lines(text), lines(text));
    assert.ok(ops.every((op) => op.type === 'equal'));
  });

  it('reports addition when new line is added', () => {
    const ops = computeDiff(lines('a\nb'), lines('a\nb\nc'));
    const adds = ops.filter((op) => op.type === 'add');
    assert.equal(adds.length, 1);
    assert.equal(adds[0].newLine, 'c');
  });

  it('reports removal when a line is deleted', () => {
    const ops = computeDiff(lines('a\nb\nc'), lines('a\nc'));
    const removes = ops.filter((op) => op.type === 'remove');
    assert.equal(removes.length, 1);
    assert.equal(removes[0].oldLine, 'b');
  });

  it('reports change for adjacent remove+add', () => {
    const ops = computeDiff(lines('hello world'), lines('hello earth'));
    const changes = ops.filter((op) => op.type === 'change');
    assert.equal(changes.length, 1);
    assert.equal(changes[0].oldLine, 'hello world');
    assert.equal(changes[0].newLine, 'hello earth');
  });

  it('handles complete replacement (all lines different)', () => {
    const ops = computeDiff(lines('foo\nbar'), lines('baz\nqux'));
    const types = ops.map((op) => op.type);
    // All lines must be non-equal
    assert.ok(!types.includes('equal'));
  });

  it('handles single-line addition only', () => {
    const ops = computeDiff([], lines('new line'));
    assert.equal(ops.length, 1);
    assert.equal(ops[0].type, 'add');
    assert.equal(ops[0].newLine, 'new line');
  });

  it('handles single-line deletion only', () => {
    const ops = computeDiff(lines('old line'), []);
    assert.equal(ops.length, 1);
    assert.equal(ops[0].type, 'remove');
    assert.equal(ops[0].oldLine, 'old line');
  });

  it('handles middle insertion correctly', () => {
    const ops = computeDiff(lines('a\nc'), lines('a\nb\nc'));
    const adds = ops.filter((op) => op.type === 'add');
    assert.equal(adds.length, 1);
    assert.equal(adds[0].newLine, 'b');
    const equals = ops.filter((op) => op.type === 'equal');
    assert.equal(equals.length, 2);
  });

  it('handles all deletions', () => {
    const ops = computeDiff(lines('x\ny\nz'), []);
    assert.ok(ops.every((op) => op.type === 'remove'));
    assert.equal(ops.length, 3);
  });

  it('handles all additions', () => {
    const ops = computeDiff([], lines('x\ny\nz'));
    assert.ok(ops.every((op) => op.type === 'add'));
    assert.equal(ops.length, 3);
  });

  it('handles Unicode / Japanese text', () => {
    const ops = computeDiff(
      lines('こんにちは\n世界'),
      lines('こんにちは\n地球')
    );
    const changes = ops.filter((op) => op.type === 'change' || op.type === 'remove' || op.type === 'add');
    assert.ok(changes.length > 0);
    const equals = ops.filter((op) => op.type === 'equal');
    assert.equal(equals[0].oldLine, 'こんにちは');
  });
});

// ── computeInlineDiff ──────────────────────────────────────────────────────
describe('computeInlineDiff', () => {
  it('returns only equal tokens for identical strings', () => {
    const tokens = computeInlineDiff('hello world', 'hello world');
    assert.ok(tokens.every((t) => t.type === 'equal'));
    assert.equal(tokens.map((t) => t.text).join(''), 'hello world');
  });

  it('detects a changed word', () => {
    const tokens = computeInlineDiff('hello world', 'hello earth');
    const removes = tokens.filter((t) => t.type === 'remove');
    const adds = tokens.filter((t) => t.type === 'add');
    assert.ok(removes.some((t) => t.text === 'world'));
    assert.ok(adds.some((t) => t.text === 'earth'));
  });

  it('handles empty old string', () => {
    const tokens = computeInlineDiff('', 'new text');
    assert.ok(tokens.every((t) => t.type === 'add'));
  });

  it('handles empty new string', () => {
    const tokens = computeInlineDiff('old text', '');
    assert.ok(tokens.every((t) => t.type === 'remove'));
  });

  it('handles both empty strings', () => {
    const tokens = computeInlineDiff('', '');
    assert.deepEqual(tokens, []);
  });
});

// ── isJSON ─────────────────────────────────────────────────────────────────
describe('isJSON', () => {
  it('returns true for valid JSON object', () => {
    assert.equal(isJSON('{"a": 1}'), true);
  });
  it('returns true for valid JSON array', () => {
    assert.equal(isJSON('[1, 2, 3]'), true);
  });
  it('returns false for plain text', () => {
    assert.equal(isJSON('hello world'), false);
  });
  it('returns false for empty string', () => {
    assert.equal(isJSON(''), false);
  });
  it('returns false for invalid JSON', () => {
    assert.equal(isJSON('{a: 1}'), false);
  });
});

// ── normalizeJSON ──────────────────────────────────────────────────────────
describe('normalizeJSON', () => {
  it('produces same output for objects with different key order', () => {
    const a = '{"b": 2, "a": 1}';
    const b = '{"a": 1, "b": 2}';
    assert.equal(normalizeJSON(a), normalizeJSON(b));
  });

  it('recursively sorts nested object keys', () => {
    const a = '{"z": {"y": 1, "x": 2}, "a": 3}';
    const b = '{"a": 3, "z": {"x": 2, "y": 1}}';
    assert.equal(normalizeJSON(a), normalizeJSON(b));
  });

  it('JSON normalization means different-key-order JSON has no diff', () => {
    const a = normalizeJSON('{"name": "Alice", "age": 30}');
    const b = normalizeJSON('{"age": 30, "name": "Alice"}');
    const ops = computeDiff(a.split('\n'), b.split('\n'));
    assert.ok(ops.every((op) => op.type === 'equal'));
  });
});

// ── isYAML ─────────────────────────────────────────────────────────────────
describe('isYAML', () => {
  it('returns true for simple key: value YAML', () => {
    assert.equal(isYAML('name: Alice\nage: 30'), true);
  });
  it('returns false for empty string', () => {
    assert.equal(isYAML(''), false);
  });
  it('returns false for plain text without colons', () => {
    assert.equal(isYAML('just some text without structure'), false);
  });
});

// ── normalizeYAML ──────────────────────────────────────────────────────────
describe('normalizeYAML', () => {
  it('sorts YAML keys alphabetically', () => {
    const a = normalizeYAML('name: Alice\nage: 30');
    const b = normalizeYAML('age: 30\nname: Alice');
    assert.equal(a, b);
  });
});

// ── diffStats ──────────────────────────────────────────────────────────────
describe('diffStats', () => {
  it('returns zeros for empty ops', () => {
    const stats = diffStats([]);
    assert.deepEqual(stats, { additions: 0, deletions: 0, changes: 0, unchanged: 0 });
  });

  it('counts additions correctly', () => {
    const ops = [{ type: 'add' }, { type: 'add' }];
    const stats = diffStats(ops);
    assert.equal(stats.additions, 2);
  });

  it('counts deletions correctly', () => {
    const ops = [{ type: 'remove' }, { type: 'remove' }, { type: 'remove' }];
    const stats = diffStats(ops);
    assert.equal(stats.deletions, 3);
  });

  it('counts changes correctly', () => {
    const ops = [{ type: 'change' }];
    const stats = diffStats(ops);
    assert.equal(stats.changes, 1);
  });

  it('counts unchanged correctly', () => {
    const ops = [{ type: 'equal' }, { type: 'equal' }];
    const stats = diffStats(ops);
    assert.equal(stats.unchanged, 2);
  });

  it('counts mixed ops correctly', () => {
    const ops = computeDiff(lines('a\nb\nc'), lines('a\nx\nc'));
    const stats = diffStats(ops);
    assert.equal(stats.unchanged, 2); // a and c
    assert.ok(stats.changes + stats.deletions + stats.additions > 0);
  });
});

// ── toUnifiedFormat ────────────────────────────────────────────────────────
describe('toUnifiedFormat', () => {
  it('produces unified diff header', () => {
    const ops = computeDiff(lines('a'), lines('b'));
    const out = toUnifiedFormat(ops, 'test.txt');
    assert.ok(out.includes('--- a/test.txt'));
    assert.ok(out.includes('+++ b/test.txt'));
  });

  it('includes @@ hunk header for changes', () => {
    const ops = computeDiff(lines('a\nb'), lines('a\nc'));
    const out = toUnifiedFormat(ops);
    assert.ok(out.includes('@@'));
  });

  it('returns only header lines for identical texts', () => {
    const ops = computeDiff(lines('same'), lines('same'));
    const out = toUnifiedFormat(ops, 'f');
    // No @@ hunk since no changes
    assert.ok(!out.includes('@@'));
  });
});
