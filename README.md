# Diff Viewer

[![Demo](https://img.shields.io/badge/demo-sen.ltd%2Fportfolio%2Fdiff--viewer-7cc4ff)](https://sen.ltd/portfolio/diff-viewer/)

テキスト / JSON を色分け diff 表示。統合・横並び・インラインの 3 モード、JSON キー順序無視の意味 diff。

**Live demo**: https://sen.ltd/portfolio/diff-viewer/

![Screenshot](./assets/screenshot.png)

## 特徴

- 3 diff modes (Unified, Side-by-side, Inline)
- JSON-aware: normalizes key order before diffing
- YAML-aware: simple flat YAML semantic comparison
- Word/character-level inline highlighting
- Stats: additions, deletions, changes
- Copy diff in unified format
- Japanese / English UI, dark/light theme
- Zero dependencies, no build

## ローカル起動

```sh
npm run serve
```

ブラウザで `http://localhost:8080` を開く。

## テスト

```sh
npm test
```

Node.js v18+ の組み込みテストランナーを使用。

## 使い方

1. 左のテキストエリアに変更前のテキストを入力
2. 右のテキストエリアに変更後のテキストを入力
3. 「比較する」ボタンを押す（または自動比較）
4. 上部タブで表示モードを切り替え（統合 / 横並び / インライン）
5. 両方が有効な JSON の場合、「JSON 意味 diff」を有効にするとキー順序の違いを無視できる

## ライセンス

MIT. See [LICENSE](./LICENSE).
