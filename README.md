# fanT

平成デジカメの質感で、ちゃんと盛れる加工カメラアプリ（コードネーム）。
フィルム / キャラ / プリ / AI の4モードを、1つのカメラにまとめます。

- [市場調査](docs/market-research/00-summary.md)
- [要件定義](docs/requirements/README.md)
- [システム構成](docs/requirements/07-system-architecture.md)

## リポジトリ構成

TypeScript のモノレポ（pnpm workspaces + Turborepo）です。

| パス               | 内容                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `apps/mobile`      | Expo SDK 58（React Native）アプリ。Expo Router、react-native-skia                                     |
| `packages/filters` | SkSL シェーダーとパラメーター処理。Skia の実装に依存せず、アプリと Web（CanvasKit）で同じコードを使う |
| `packages/config`  | 共有の tsconfig と ESLint 設定                                                                        |
| `.github/`         | CI・依存関係の監査・Dependabot                                                                        |
| `docs/`            | 市場調査・要件定義                                                                                    |

`apps/studio`（フィルムスタジオ）、`packages/content-schema`、`functions` などは、必要になった時点で追加します（[システム構成](docs/requirements/07-system-architecture.md) §3）。

## 開発環境

- Node.js 24 LTS（`.node-version`）
- pnpm 12（`package.json` の `packageManager` で固定。`corepack enable` で自動的に使えます）

```sh
pnpm install          # 依存関係のインストール
pnpm check            # フォーマット・lint・型チェック・テストをまとめて実行（CI と同じ）
pnpm format           # Prettier で整形
```

### モバイルアプリ

```sh
pnpm --filter @fant/mobile start     # Metro を起動（Expo Go または開発ビルドで開く）
pnpm --filter @fant/mobile ios       # iOS の開発ビルドを作って起動（Xcode が必要）
pnpm --filter @fant/mobile android   # Android の開発ビルドを作って起動（Android Studio が必要）
pnpm --filter @fant/mobile bundle    # iOS / Android の JS バンドルを作成（CI でも実行）
```

- ビルドの種類は環境変数 `APP_VARIANT`（`development` / `preview` / `production`）で切り替えます。EAS のプロファイル（`apps/mobile/eas.json`）が自動で設定します。
- `ios/` と `android/` は Expo が生成するので、コミットしません。ネイティブの設定は `app.config.ts` と config plugin で行います。
- アイコンとスプラッシュは、デザインが決まってから追加します（要件定義 Q-02）。

## 依存関係のルール

| 対象                                                    | 追加・更新の方法                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Expo / React Native 関連（アプリのみ）                  | `pnpm --filter @fant/mobile exec expo install <package>`（SDK と互換性のあるバージョンが選ばれる）    |
| 複数のパッケージで使うツール（TypeScript、ESLint など） | `pnpm-workspace.yaml` の `catalog` にバージョンを書き、各 `package.json` では `"catalog:"` を指定する |
| ワークスペース内のパッケージ                            | `"workspace:*"` で参照する                                                                            |

Expo SDK が決めるパッケージ（`expo*`、`react`、`react-native*`、`@shopify/react-native-skia` など）は Dependabot の対象外です。
React Native は `react` が内部のレンダラーと完全に一致しないと起動しないため、まとめて次のコマンドで更新します。CI は `expo install --check` で互換性を確認しています。

```sh
pnpm --filter @fant/mobile exec expo install --fix
```

### サプライチェーン対策（`pnpm-workspace.yaml`）

- **公開から24時間未満のバージョンは使わない**（`minimumReleaseAge`）
- **来歴証明（provenance）の信頼レベルが下がったバージョンは拒否する**（`trustPolicy: no-downgrade`）。例外は理由を書いて `trustPolicyExclude` に追加する
- **依存パッケージのビルドスクリプトは既定ですべて実行しない**。必要なものだけ `allowBuilds` で許可する
- **既知の脆弱性**: CI（毎週と lockfile の変更時）で `pnpm audit --audit-level high` を実行する。修正できないものは、影響範囲を確認したうえで GHSA 番号と理由を `audit.ignore` に記録し、Expo SDK を更新するたびに見直す

## CI

| ワークフロー     | 内容                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `ci.yml`         | フォーマット確認、Expo SDK との互換性、lint・型チェック・テスト、iOS / Android の JS バンドル |
| `security.yml`   | 依存関係の脆弱性監査（毎週月曜、lockfile 変更時）                                             |
| `dependabot.yml` | npm と GitHub Actions の更新（公開後3日の待機あり）                                           |

GitHub Actions はすべてコミット SHA で固定し、トークンは読み取り専用にしています。
