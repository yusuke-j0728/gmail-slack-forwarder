# Gmail to Slack Forwarder - セットアップガイド

このガイドに従って、Gmail to Slack Forwarder システムを段階的にセットアップしてください。

## 🚀 ステップバイステップセットアップ

### ステップ 1: 開発環境準備

#### 1.1 Node.js と Clasp CLI インストール
```bash
# Node.js がインストールされていることを確認
node --version  # v14 以上が必要

# Clasp CLI をグローバルインストール
npm install -g @google/clasp

# Clasp バージョン確認
clasp --version
```

#### 1.2 プロジェクトセットアップ
```bash
# プロジェクトディレクトリに移動
cd gmail-slack-forwarder

# 依存関係インストール
npm install

# Clasp でGoogle アカウントにログイン
npm run login
# または: clasp login
```

### ステップ 2: Google Apps Script プロジェクト作成

#### 2.1 新しい GAS プロジェクト作成
```bash
# 新規プロジェクト作成
npm run setup
# または: clasp create --type standalone --title "Gmail Slack Forwarder"
```

この時点で `.clasp.json` ファイルに `scriptId` が自動設定されます。

#### 2.2 初回プッシュ
```bash
# ローカルコードを GAS にプッシュ
npm run push
# または: clasp push

# GAS エディタを開いて確認
npm run open
# または: clasp open-script
```

### ステップ 3: Slack Webhook 設定

#### 3.1 Slack Incoming Webhook 作成
1. Slack ワークスペースの設定画面を開く
2. 「アプリ」→「アプリを管理」→「アプリディレクトリを閲覧」
3. 「Incoming Webhooks」を検索してインストール
4. 通知先チャンネルを選択（例: `#general`, `#alerts`）
5. Webhook URL をコピー（例: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`）

#### 3.2 Webhook URL を GAS に設定
Google Apps Script エディタで以下の関数を作成・実行：

```javascript
function setSlackWebhook() {
  const webhookUrl = 'https://hooks.slack.com/services/YOUR/ACTUAL/WEBHOOK_URL';
  
  PropertiesService.getScriptProperties()
    .setProperty('SLACK_WEBHOOK_URL', webhookUrl);
  
  console.log('✅ Slack Webhook URL が設定されました');
}
```

### ステップ 4: システム設定のカスタマイズ

#### 4.1 基本設定の編集
`src/main.js` の `CONFIG` オブジェクトを実際の値に変更：

```javascript
const CONFIG = {
  // 📧 監視対象のメールアドレス
  SENDER_EMAIL: 'your-actual-sender@example.com',
  
  // 🎯 件名パターン（必要に応じて変更）
  SUBJECT_PATTERN: /\d+回/,  // 「1回」「第2回」などにマッチ
  
  // 🏷️ 処理済みメールのラベル名
  GMAIL_LABEL: 'Processed',
  
  // 💬 Slack 通知チャンネル
  SLACK_CHANNEL: '#your-actual-channel',
  
  // 📁 Drive 保存フォルダ名
  DRIVE_FOLDER_NAME: 'Gmail Attachments',
  
  // ⏰ チェック間隔（分）
  TRIGGER_INTERVAL_MINUTES: 5
};
```

#### 4.2 変更をデプロイ
```bash
# 設定変更をプッシュ
npm run push

# ログで確認
npm run logs
```

### ステップ 5: システムテストと検証

#### 5.1 設定テスト
Google Apps Script エディタで以下を実行：

```javascript
// 基本設定をテスト
testConfiguration();
```

**期待結果**: すべての設定項目が正常に検証されること

#### 5.2 Slack 接続テスト
```javascript
// Slack 通知をテスト
testSlackNotifications();
```

**期待結果**: 設定したチャンネルにテスト通知が届くこと

#### 5.3 Drive 接続テスト
```javascript
// Drive フォルダアクセスをテスト
testDriveOperations();
```

**期待結果**: Drive フォルダが作成または認識されること

#### 5.4 メール検索テスト
```javascript
// Gmail 検索をテスト
testEmailSearch();
```

**期待結果**: 指定した送信者からのメールが検索されること

#### 5.5 包括テスト
```javascript
// 全システムをテスト
runAllTests();
```

**期待結果**: すべてのテストが成功すること（成功率100%）

### ステップ 6: 自動実行の設定

#### 6.1 トリガー作成
```javascript
// 定期実行トリガーを設定
setupInitialTrigger();
```

**期待結果**: 
- 5分間隔のトリガーが作成されること
- Slack にトリガー有効化通知が届くこと

#### 6.2 トリガー動作確認
```javascript
// トリガー状態を確認
checkTriggerHealth();
```

### ステップ 7: 本格運用開始

#### 7.1 手動テスト実行
```javascript
// 実際のメール処理をテスト
testProcessEmails();
```

#### 7.2 ヘルスチェック
```javascript
// システム全体の健全性確認
quickHealthCheck();
```

#### 7.3 実行ログ監視
```bash
# 定期的にログを確認
npm run logs
```

## 🔧 トラブルシューティング

### よく発生する問題と解決方法

#### ❌ 認証エラー
**症状**: `clasp login` でエラーが発生
**解決**: 
```bash
# 認証リセット
clasp logout
clasp login
```

#### ❌ プッシュエラー
**症状**: `npm run push` でエラー
**解決**:
```bash
# プロジェクト状態確認
clasp status

# 強制プッシュ
clasp push --force
```

#### ❌ 権限エラー
**症状**: Gmail/Drive API でアクセス拒否
**解決**: GAS エディタで手動実行して権限付与を完了

#### ❌ Webhook エラー
**症状**: Slack 通知が届かない
**解決**:
1. Webhook URL の再確認
2. チャンネル権限の確認
3. `testSlackNotifications()` での動作テスト

### デバッグ用コマンド

```bash
# 最新ログ確認
npm run logs

# GAS エディタで直接確認
npm run open

# ローカルとリモートの同期状況確認
clasp status
```

## 📊 運用開始後のメンテナンス

### 定期確認項目
- **週次**: `quickHealthCheck()` 実行
- **月次**: `runAllTests()` 実行
- **必要時**: トリガー健全性チェック

### ログ監視
- エラー通知が Slack に届いた場合は `npm run logs` で詳細確認
- 処理件数の異常な増減があれば設定見直し

### アップデート手順
1. ローカルでコード修正
2. `npm run push` でデプロイ
3. テスト関数で動作確認
4. 必要に応じてトリガー再作成

## 🎯 成功確認チェックリスト

- [ ] Clasp CLI でログイン完了
- [ ] GAS プロジェクト作成・コードプッシュ完了
- [ ] Slack Webhook URL 設定完了
- [ ] CONFIG オブジェクト設定完了
- [ ] `testConfiguration()` 成功
- [ ] `testSlackNotifications()` 成功（Slack にテスト通知届く）
- [ ] `testDriveOperations()` 成功
- [ ] `runAllTests()` で成功率100%
- [ ] `setupInitialTrigger()` 実行完了
- [ ] Slack にトリガー有効化通知届く
- [ ] `quickHealthCheck()` 成功

すべて完了すれば、システムは正常に稼働開始します！