/**
 * i18n.js — Japanese / English translations
 */

export const translations = {
  ja: {
    title: 'Diff Viewer',
    subtitle: 'テキスト・JSON の差分比較ツール',
    originalLabel: '変更前',
    modifiedLabel: '変更後',
    compareBtn: '比較する',
    clearBtn: 'クリア',
    sampleBtn: 'サンプル',
    copyBtn: 'コピー',
    copiedMsg: 'コピーしました',
    modeUnified: '統合',
    modeSideBySide: '横並び',
    modeInline: 'インライン',
    statsAdditions: '追加',
    statsDeletions: '削除',
    statsChanges: '変更',
    statsUnchanged: '変更なし',
    jsonModeLabel: 'JSON 意味 diff（キー順序を無視）',
    yamlModeLabel: 'YAML 意味 diff（キー順序を無視）',
    jsonDetected: '有効な JSON が検出されました。意味 diff を使うと、キー順序の差を無視できます。',
    yamlDetected: '有効な YAML が検出されました。意味 diff を使うと、キー順序の差を無視できます。',
    noDiff: '差分なし',
    emptyInput: 'テキストを入力してください',
    lineNum: '行',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    langToggle: 'English',
  },
  en: {
    title: 'Diff Viewer',
    subtitle: 'Text and JSON diff comparison tool',
    originalLabel: 'Original',
    modifiedLabel: 'Modified',
    compareBtn: 'Compare',
    clearBtn: 'Clear',
    sampleBtn: 'Sample',
    copyBtn: 'Copy Diff',
    copiedMsg: 'Copied!',
    modeUnified: 'Unified',
    modeSideBySide: 'Side by Side',
    modeInline: 'Inline',
    statsAdditions: 'additions',
    statsDeletions: 'deletions',
    statsChanges: 'changes',
    statsUnchanged: 'unchanged',
    jsonModeLabel: 'JSON semantic diff (ignore key order)',
    yamlModeLabel: 'YAML semantic diff (ignore key order)',
    jsonDetected: 'Valid JSON detected. Enable semantic diff to ignore key ordering differences.',
    yamlDetected: 'Valid YAML detected. Enable semantic diff to ignore key ordering differences.',
    noDiff: 'No differences',
    emptyInput: 'Please enter text to compare',
    lineNum: 'Line',
    themeLight: 'Light',
    themeDark: 'Dark',
    langToggle: '日本語',
  },
};

let currentLang = 'ja';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (translations[lang]) currentLang = lang;
}

export function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) ||
    (translations['en'][key]) ||
    key;
}

export function toggleLang() {
  currentLang = currentLang === 'ja' ? 'en' : 'ja';
  return currentLang;
}
