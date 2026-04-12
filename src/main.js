/**
 * main.js — DOM management, event handling, rendering
 */

import {
  computeDiff,
  computeInlineDiff,
  isJSON,
  isYAML,
  normalizeJSON,
  normalizeYAML,
  diffStats,
  toUnifiedFormat,
} from './diff.js';
import { t, getLang, toggleLang } from './i18n.js';

// ── State ──────────────────────────────────────────────────────────────────
let currentMode = 'unified'; // 'unified' | 'side-by-side' | 'inline'
let semanticMode = false;
let lastOps = [];

// ── DOM refs ───────────────────────────────────────────────────────────────
const $$ = (sel) => document.querySelector(sel);
const refs = {
  originalTA: () => $$('#original-text'),
  modifiedTA: () => $$('#modified-text'),
  compareBtn: () => $$('#compare-btn'),
  clearBtn: () => $$('#clear-btn'),
  sampleBtn: () => $$('#sample-btn'),
  copyBtn: () => $$('#copy-btn'),
  diffOutput: () => $$('#diff-output'),
  statsBar: () => $$('#stats-bar'),
  modeUnified: () => $$('#mode-unified'),
  modeSide: () => $$('#mode-side'),
  modeInline: () => $$('#mode-inline'),
  semanticToggle: () => $$('#semantic-toggle'),
  semanticLabel: () => $$('#semantic-label'),
  semanticHint: () => $$('#semantic-hint'),
  themeToggle: () => $$('#theme-toggle'),
  langToggle: () => $$('#lang-toggle'),
  title: () => $$('#app-title'),
  subtitle: () => $$('#app-subtitle'),
  originalLabel: () => $$('#original-label'),
  modifiedLabel: () => $$('#modified-label'),
};

// ── i18n rendering ─────────────────────────────────────────────────────────
function applyTranslations() {
  refs.title().textContent = t('title');
  refs.subtitle().textContent = t('subtitle');
  refs.originalLabel().textContent = t('originalLabel');
  refs.modifiedLabel().textContent = t('modifiedLabel');
  refs.compareBtn().textContent = t('compareBtn');
  refs.clearBtn().textContent = t('clearBtn');
  refs.sampleBtn().textContent = t('sampleBtn');
  refs.copyBtn().textContent = t('copyBtn');
  refs.modeUnified().textContent = t('modeUnified');
  refs.modeSide().textContent = t('modeSideBySide');
  refs.modeInline().textContent = t('modeInline');
  refs.langToggle().textContent = t('langToggle');
  renderSemanticHint();
}

// ── Theme ──────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('dv-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}

function updateThemeBtn(theme) {
  refs.themeToggle().textContent = theme === 'dark' ? '☀️' : '🌙';
  refs.themeToggle().setAttribute('aria-label', theme === 'dark' ? 'Switch to light' : 'Switch to dark');
}

refs.themeToggle && document.addEventListener('DOMContentLoaded', () => {
  refs.themeToggle().addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dv-theme', next);
    updateThemeBtn(next);
  });
});

// ── Semantic hint ──────────────────────────────────────────────────────────
function renderSemanticHint() {
  const orig = refs.originalTA().value;
  const mod = refs.modifiedTA().value;
  const hint = refs.semanticHint();
  const toggle = refs.semanticToggle();
  const label = refs.semanticLabel();

  if (isJSON(orig) && isJSON(mod)) {
    hint.textContent = t('jsonDetected');
    hint.style.display = 'block';
    label.textContent = t('jsonModeLabel');
    toggle.parentElement.style.display = 'flex';
  } else if (isYAML(orig) && isYAML(mod)) {
    hint.textContent = t('yamlDetected');
    hint.style.display = 'block';
    label.textContent = t('yamlModeLabel');
    toggle.parentElement.style.display = 'flex';
  } else {
    hint.style.display = 'none';
    toggle.parentElement.style.display = 'none';
    semanticMode = false;
    toggle.checked = false;
  }
}

// ── Diff rendering ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInlineSpans(oldStr, newStr) {
  const tokens = computeInlineDiff(oldStr, newStr);
  return tokens
    .map((tok) => {
      const esc = escapeHtml(tok.text);
      if (tok.type === 'add') return `<span class="inline-add">${esc}</span>`;
      if (tok.type === 'remove') return `<span class="inline-remove">${esc}</span>`;
      return esc;
    })
    .join('');
}

function renderUnified(ops) {
  if (ops.length === 0) return `<div class="no-diff">${t('noDiff')}</div>`;
  const rows = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const op of ops) {
    if (op.type === 'equal') {
      rows.push(
        `<tr class="line-equal">
          <td class="ln old">${oldLineNum++}</td>
          <td class="ln new">${newLineNum++}</td>
          <td class="marker"> </td>
          <td class="code">${escapeHtml(op.oldLine)}</td>
        </tr>`
      );
    } else if (op.type === 'add') {
      rows.push(
        `<tr class="line-add">
          <td class="ln old"></td>
          <td class="ln new">${newLineNum++}</td>
          <td class="marker">+</td>
          <td class="code">${escapeHtml(op.newLine)}</td>
        </tr>`
      );
    } else if (op.type === 'remove') {
      rows.push(
        `<tr class="line-remove">
          <td class="ln old">${oldLineNum++}</td>
          <td class="ln new"></td>
          <td class="marker">−</td>
          <td class="code">${escapeHtml(op.oldLine)}</td>
        </tr>`
      );
    } else if (op.type === 'change') {
      rows.push(
        `<tr class="line-change">
          <td class="ln old">${oldLineNum++}</td>
          <td class="ln new">${newLineNum++}</td>
          <td class="marker">~</td>
          <td class="code">${renderInlineSpans(op.oldLine, op.newLine)}</td>
        </tr>`
      );
    }
  }
  return `<table class="diff-table unified"><tbody>${rows.join('')}</tbody></table>`;
}

function renderSideBySide(ops) {
  if (ops.length === 0) return `<div class="no-diff">${t('noDiff')}</div>`;
  const rows = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const op of ops) {
    if (op.type === 'equal') {
      rows.push(
        `<tr class="line-equal">
          <td class="ln">${oldLineNum++}</td>
          <td class="code">${escapeHtml(op.oldLine)}</td>
          <td class="ln">${newLineNum++}</td>
          <td class="code">${escapeHtml(op.newLine)}</td>
        </tr>`
      );
    } else if (op.type === 'add') {
      rows.push(
        `<tr class="line-add">
          <td class="ln"></td>
          <td class="code empty"></td>
          <td class="ln">${newLineNum++}</td>
          <td class="code add-bg">${escapeHtml(op.newLine)}</td>
        </tr>`
      );
    } else if (op.type === 'remove') {
      rows.push(
        `<tr class="line-remove">
          <td class="ln">${oldLineNum++}</td>
          <td class="code remove-bg">${escapeHtml(op.oldLine)}</td>
          <td class="ln"></td>
          <td class="code empty"></td>
        </tr>`
      );
    } else if (op.type === 'change') {
      const oldInline = computeInlineDiff(op.oldLine, op.newLine)
        .map((tok) => {
          const esc = escapeHtml(tok.text);
          return tok.type === 'remove' ? `<span class="inline-remove">${esc}</span>` : esc;
        })
        .join('');
      const newInline = computeInlineDiff(op.oldLine, op.newLine)
        .map((tok) => {
          const esc = escapeHtml(tok.text);
          return tok.type === 'add' ? `<span class="inline-add">${esc}</span>` : esc;
        })
        .join('');
      rows.push(
        `<tr class="line-change">
          <td class="ln">${oldLineNum++}</td>
          <td class="code change-bg">${oldInline}</td>
          <td class="ln">${newLineNum++}</td>
          <td class="code change-bg">${newInline}</td>
        </tr>`
      );
    }
  }
  return `<table class="diff-table side-by-side"><tbody>${rows.join('')}</tbody></table>`;
}

function renderInlineMode(ops) {
  if (ops.length === 0) return `<div class="no-diff">${t('noDiff')}</div>`;
  const rows = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const op of ops) {
    if (op.type === 'equal') {
      rows.push(
        `<tr class="line-equal">
          <td class="ln old">${oldLineNum++}</td>
          <td class="ln new">${newLineNum++}</td>
          <td class="marker"> </td>
          <td class="code">${escapeHtml(op.oldLine)}</td>
        </tr>`
      );
    } else if (op.type === 'add') {
      rows.push(
        `<tr class="line-add">
          <td class="ln old"></td>
          <td class="ln new">${newLineNum++}</td>
          <td class="marker">+</td>
          <td class="code">${escapeHtml(op.newLine)}</td>
        </tr>`
      );
    } else if (op.type === 'remove') {
      rows.push(
        `<tr class="line-remove">
          <td class="ln old">${oldLineNum++}</td>
          <td class="ln new"></td>
          <td class="marker">−</td>
          <td class="code">${escapeHtml(op.oldLine)}</td>
        </tr>`
      );
    } else if (op.type === 'change') {
      // Show old with inline removes, then new with inline adds
      const oldTokens = computeInlineDiff(op.oldLine, op.newLine)
        .map((tok) => {
          const esc = escapeHtml(tok.text);
          if (tok.type === 'remove') return `<span class="inline-remove">${esc}</span>`;
          if (tok.type === 'add') return '';
          return esc;
        })
        .join('');
      const newTokens = computeInlineDiff(op.oldLine, op.newLine)
        .map((tok) => {
          const esc = escapeHtml(tok.text);
          if (tok.type === 'add') return `<span class="inline-add">${esc}</span>`;
          if (tok.type === 'remove') return '';
          return esc;
        })
        .join('');
      rows.push(
        `<tr class="line-change old-side">
          <td class="ln old">${oldLineNum++}</td>
          <td class="ln new"></td>
          <td class="marker">−</td>
          <td class="code">${oldTokens}</td>
        </tr>
        <tr class="line-change new-side">
          <td class="ln old"></td>
          <td class="ln new">${newLineNum++}</td>
          <td class="marker">+</td>
          <td class="code">${newTokens}</td>
        </tr>`
      );
    }
  }
  return `<table class="diff-table inline-mode"><tbody>${rows.join('')}</tbody></table>`;
}

function renderStats(stats) {
  const bar = refs.statsBar();
  bar.innerHTML = `
    <span class="stat add">+${stats.additions} ${t('statsAdditions')}</span>
    <span class="stat remove">−${stats.deletions} ${t('statsDeletions')}</span>
    <span class="stat change">~${stats.changes} ${t('statsChanges')}</span>
    <span class="stat equal">${stats.unchanged} ${t('statsUnchanged')}</span>
  `;
  bar.style.display = 'flex';
}

// ── Main compare function ──────────────────────────────────────────────────
function compare() {
  let orig = refs.originalTA().value;
  let mod = refs.modifiedTA().value;

  // Semantic normalization
  if (semanticMode) {
    if (isJSON(orig) && isJSON(mod)) {
      try { orig = normalizeJSON(orig); } catch { /* keep raw */ }
      try { mod = normalizeJSON(mod); } catch { /* keep raw */ }
    } else if (isYAML(orig) && isYAML(mod)) {
      orig = normalizeYAML(orig);
      mod = normalizeYAML(mod);
    }
  }

  const oldLines = orig.split('\n');
  const newLines = mod.split('\n');

  const ops = computeDiff(oldLines, newLines);
  lastOps = ops;

  const stats = diffStats(ops);
  renderStats(stats);

  const output = refs.diffOutput();
  if (currentMode === 'unified') {
    output.innerHTML = renderUnified(ops);
  } else if (currentMode === 'side-by-side') {
    output.innerHTML = renderSideBySide(ops);
  } else {
    output.innerHTML = renderInlineMode(ops);
  }
}

// ── Sample data ────────────────────────────────────────────────────────────
const SAMPLES = {
  text: {
    original: `function greet(name) {
  console.log("Hello, " + name);
  return name;
}

const users = ["Alice", "Bob", "Charlie"];
users.forEach(greet);`,
    modified: `function greet(name, greeting = "Hello") {
  console.log(greeting + ", " + name + "!");
  return { name, greeted: true };
}

const users = ["Alice", "Bob", "Dana"];
users.forEach((u) => greet(u, "Hi"));`,
  },
  json: {
    original: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}`,
    modified: `{
  "version": "1.1.0",
  "name": "my-app",
  "dependencies": {
    "typescript": "^5.0.0",
    "react": "^18.2.0",
    "vite": "^5.0.0"
  }
}`,
  },
};

let sampleIndex = 0;
const sampleKeys = Object.keys(SAMPLES);

// ── Event setup ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  applyTranslations();

  refs.compareBtn().addEventListener('click', compare);

  refs.clearBtn().addEventListener('click', () => {
    refs.originalTA().value = '';
    refs.modifiedTA().value = '';
    refs.diffOutput().innerHTML = '';
    refs.statsBar().style.display = 'none';
    lastOps = [];
    renderSemanticHint();
  });

  refs.sampleBtn().addEventListener('click', () => {
    const key = sampleKeys[sampleIndex % sampleKeys.length];
    sampleIndex++;
    refs.originalTA().value = SAMPLES[key].original;
    refs.modifiedTA().value = SAMPLES[key].modified;
    renderSemanticHint();
    compare();
  });

  refs.copyBtn().addEventListener('click', () => {
    const unified = toUnifiedFormat(lastOps, 'diff');
    navigator.clipboard.writeText(unified).then(() => {
      const btn = refs.copyBtn();
      const orig = btn.textContent;
      btn.textContent = t('copiedMsg');
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  });

  // Mode tabs
  refs.modeUnified().addEventListener('click', () => setMode('unified'));
  refs.modeSide().addEventListener('click', () => setMode('side-by-side'));
  refs.modeInline().addEventListener('click', () => setMode('inline'));

  refs.semanticToggle().addEventListener('change', (e) => {
    semanticMode = e.target.checked;
    if (refs.originalTA().value || refs.modifiedTA().value) compare();
  });

  refs.langToggle().addEventListener('click', () => {
    toggleLang();
    applyTranslations();
    if (lastOps.length > 0) {
      renderStats(diffStats(lastOps));
    }
  });

  // Auto-compare on textarea change with debounce
  let debounceTimer = null;
  const onInput = () => {
    renderSemanticHint();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (refs.originalTA().value || refs.modifiedTA().value) compare();
    }, 400);
  };
  refs.originalTA().addEventListener('input', onInput);
  refs.modifiedTA().addEventListener('input', onInput);
});

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-tab').forEach((btn) => btn.classList.remove('active'));
  const tabMap = { 'unified': refs.modeUnified(), 'side-by-side': refs.modeSide(), 'inline': refs.modeInline() };
  tabMap[mode].classList.add('active');
  if (lastOps.length > 0 || refs.originalTA().value || refs.modifiedTA().value) compare();
}
