# fanT

平成デジカメの質感で、ちゃんと盛れる加工カメラアプリ（コードネーム）。
フィルム / キャラ / プリ / AI の4モードを、1つのカメラにまとめます。

## ドキュメント

- [市場調査](docs/market-research/00-summary.md)
- [要件定義](docs/requirements/README.md)
- [システム構成](docs/requirements/07-system-architecture.md)

## 技術構成（予定）

TypeScript のモノレポ（pnpm workspaces + Turborepo）

| ディレクトリ | 内容 |
|---|---|
| `apps/mobile` | Expo（React Native）＋ VisionCamera v5 ＋ react-native-skia。重い処理だけネイティブモジュール（MediaPipe） |
| `apps/studio` | フィルムスタジオ（React Web。アプリと同じシェーダーでフィルムを作る社内ツール） |
| `apps/web` | 宣伝用サイト（Next.js） |
| `packages/filters` | SkSL シェーダー（アプリと Web で共有） |
| `packages/content-schema` / `packages/api-types` | 型と検証（zod） |
| `functions` | Firebase Cloud Functions（AI の中継・クレジット） |
| `content` | 配信コンテンツの原本 |
