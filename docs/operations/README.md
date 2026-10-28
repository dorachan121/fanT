# 運用手順

アプリを外部サービスにつなぎ、配信・リリースするための手順です。どのサービスも未設定のままで開発できます（その機能だけがオフになります）。

| 設定がないとき | 動き |
|---|---|
| コンテンツ配信（`CONTENT_BASE_URL`） | 内蔵コンテンツだけを使う（CNT-05） |
| API（`API_BASE_URL`） | AI モードを出さない。分析イベントは端末にためるだけ |
| RevenueCat（`REVENUECAT_*_API_KEY`） | 購入できない（プレミアムの項目はお試しのみ）。開発ビルドでは設定画面の「プレミアムを有効にする（テスト用）」で確認できる |

## 1. アプリの環境変数（EAS）

`app.config.ts` がビルド時に読み、`src/config.ts` が起動時に検証します。EAS の環境変数（プロファイルごと）に設定します。

| 変数 | 内容 | 例 |
|---|---|---|
| `APP_VARIANT` | `development` / `preview` / `production`（`eas.json` が設定） | |
| `CONTENT_BASE_URL` | コンテンツ配信の URL（https、末尾の `/` なし） | `https://content.example.com` |
| `API_BASE_URL` | Cloud Functions の `api` の URL（https、末尾の `/` なし） | `https://asia-northeast1-<project>.cloudfunctions.net/api` |
| `REVENUECAT_IOS_API_KEY` / `REVENUECAT_ANDROID_API_KEY` | RevenueCat の公開 SDK キー（秘密ではない） | `appl_…` / `goog_…` |
| `SUPPORT_EMAIL` | お問い合わせ先（SET-03）。未設定なら項目を出さない | |

```sh
eas env:create --environment production --name API_BASE_URL --value https://…
```

## 2. Firebase（AI・クレジット・分析）

1. Firebase プロジェクトを作る（Blaze プラン。リージョンは `asia-northeast1`）。Firestore（ネイティブモード）と Cloud Storage を有効にする
2. `firebase use --add` でプロジェクトを選ぶ（`.firebaserc` は各自の環境で作る）
3. シークレットとパラメーターを設定する
   ```sh
   firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET   # 十分に長いランダムな文字列
   ```
   `functions/.env.<projectId>`（コミットしない）にパラメーターを書く:
   ```
   AI_PROVIDER=mock        # 画像生成の提供元（Q-04）。mock は開発用で、プロジェクト ID が -prod で終わる環境では起動しない
   MONTHLY_CREDITS=10      # 年額会員への毎月の付与数（Q-05）
   ```
4. Functions のサービスアカウントに「サービス アカウント トークン作成者」（`roles/iam.serviceAccountTokenCreator`）を付ける（結果画像の署名付き URL に必要）
5. デプロイする（`functions/dist` を `predeploy` が作る）
   ```sh
   firebase deploy --only functions,firestore,storage
   ```
   Firestore の `generations.expireAt` に TTL ポリシーが設定され、1時間ごとの削除処理（`deleteExpired`）と合わせて、写真と生成結果を24時間以内に消します（非機能要件 §6）
6. 分析（ANL-01）: Cloud Logging のシンクで `jsonPayload.message="analytics.event"` を BigQuery に送る。エラー（ANL-02）は同じログの `analytics.event` のうち `name="error"`

ローカルでは `firebase emulators:start` で Functions・Firestore・Storage を動かせます（`AI_PROVIDER=mock`）。

## 3. RevenueCat（課金）

| 設定 | 値 |
|---|---|
| エンタイトルメント | `premium`（年額と買い切りの両方に付ける） |
| 現在のオファリング | Annual パッケージ（商品 ID に `annual` を含める。7日間の無料トライアル）と Lifetime パッケージ |
| オファリング `credits` | 消耗型の商品 `credits_10` / `credits_30` / `credits_100`（サーバーはこの3つ以外の数を付与しない） |
| Webhook | URL: `${API_BASE_URL}/v1/webhooks/revenuecat`、Authorization ヘッダー: `Bearer <REVENUECAT_WEBHOOK_SECRET>` |

アプリは AI 用のアカウントを作ると RevenueCat にログインするので、クレジットの購入はそのアカウントに付与されます。年額プランの毎月のクレジットは、Webhook で届く有効期限までサーバーが付与します。

## 4. コンテンツ配信（CNT-01/02, STU-05）

1. 公開読み取りの Cloud Storage バケットを作り、Cloud CDN（または任意の CDN）を前に置く。その URL を `CONTENT_BASE_URL` にする
2. GitHub Actions から鍵なしでアップロードできるように、Workload Identity 連携とバケットへの書き込み権限を持つサービスアカウントを用意する
3. リポジトリの変数（Variables）に `CONTENT_BUCKET`・`GCP_WORKLOAD_IDENTITY_PROVIDER`・`GCP_CONTENT_SERVICE_ACCOUNT` を設定する

`content/` が `main` に入ると、`content.yml` が検証してから配信します。素材は内容のハッシュ名（`assets/<sha256>.png`）で置くので無期限にキャッシュでき、`manifest.json` は5分のキャッシュで最後に置き換えます。

### フィルムを追加する流れ

1. `pnpm --filter @fant/studio dev` でスタジオを開き、写真や Web カメラで確認しながらフィルムを作る
2. 「書き出す」で JSON と LUT（PNG）を保存し、`content/remote/films/` と `content/remote/luts/` に置く。期間限定なら `availability` を書く（CNT-03/04）
3. `pnpm --filter @fant/content hash` と `pnpm check` を実行して PR を作る

## 5. リリース前の確認

- 規約・プライバシーポリシー・特商法の表記の【…】を埋め、専門家に確認してもらう（`apps/mobile/src/features/legal/documents.ts`、Q-10/Q-12）
- 画像生成の提供元を決め（Q-04）、`functions/src/ports.ts` の `ImageGenerator` と `Moderator` を実装して `AI_PROVIDER` で選べるようにする
- App Check（Play Integrity / App Attest）を有効にする（非機能要件 §5、R-05）。現在は端末ごとの秘密鍵、アドレスごとの登録数と分析イベント送信数の制限、アカウントごとの生成回数制限で守っている
- アイコン・スプラッシュ・ストアの掲載情報、App Privacy・データセーフティの申告（非機能要件 §6）
- [実装状況](../requirements/08-implementation-status.md) の「実機で確認すること」をすべて確認する
