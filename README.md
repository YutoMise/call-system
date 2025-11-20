# call-system

整理券番号と診察室を案内する、高機能な呼び出しシステムです。

## ✨ 主な機能

*   **呼び出し機能:**
    *   **Sender:**<br>
        Receiverに対してチャンネルを指定し、整理券番号・診察室番号を送信します。
    *   **Receiver:**<br>
        Senderから届いた情報を合成音声で読み上げます。
*   **管理者機能:**
    *   **チャンネル管理:**<br>
        Web UIからチャンネルの追加・編集・削除が可能です。
    *   **詳細設定:**<br>
        チャンネルごとに設定が可能
        * パスワード
        * 診察室数
        * 受付ボタン・レントゲン室ボタンの表示有無
        * 日本語・英語別の音声ID
    *   **システムログ:**<br>
        リアルタイムでシステムログを閲覧できます。ログのフィルタリングやチャンネルごとの表示にも対応しています。

### ユーザー補助機能 (送信側)

* 「*」キーの押下でTabと同等の処理を行うように
* 「-」キーの押下でBackSpaceと同等の処理を行うように
* ウインドウのクリックで整理券番号のテキスト入力にフォーカスが合うように


## 🛠️ 使用技術

* **言語:** JavaScript (Node.js [v22.14.0])
* **フレームワーク:** Express.js
* **データベース:** なし
* **リアルタイム通信:** SSE(Server-Sent Events)
* **パッケージマネージャー:** npm
* **その他:** crypto, dotenv, express-session

## 🚀 セットアップとローカルでの実行方法

### 必要なもの

* Node.js (推奨バージョン: v22.14.0)
* npm (推奨バージョン: v11.3)

### 手順

1.  **リポジトリをクローン:**
    ```shell
    git clone https://github.com/YutoMise/call-system.git
    cd call-system
    ```

2.  **依存パッケージのインストール:**
    ```shell
    npm install
    ```
3.  **アプリケーションの起動・停止:**
    ```shell
    # 起動
    docker compose up -d
    # 停止
    docker compose down --rmi all
    ```
    crontabで定期実行を行う。
    ```shell
    sudo crontab -e
    # 1. 毎日5:00にdockerコンテナの起動を行う
    0 5 * * * cd /<userpath>/call-system && /<dockerpath>/docker compose up -d >> /<userpath>/call-system/logs/cron_docker.log 2>&1

    # 2. 毎日22:55にその日のログファイルを格納する
    55 22 * * * cd /<userpath>/call-system && /<dockerpath>/docker compose logs >> /<userpath>/call-system/logs/$(date +\%Y\%m\%d).log 2>&1

    # 3. 毎日23:00にdockerコンテナを停止させる
    0 23 * * * cd /<userpath>/call-system && /<dockerpath>/docker compose down --rmi all >> /<userpath>/call-system/logs/cron_docker.log 2>&1
    ```

4.  **アクセス:**
    起動後、以下のURLにアクセスします。
    *   **メインページ:** `http://localhost:3002`
    *   **呼び出し受け取りページ:** `http://localhost:3002/receiver`
    *   **管理者ページ:** `http://localhost:3002/admin/channel/edit`
    *   **ログページ:** `http://localhost:3002/admin/logs`
    *   **オーディオテストページ:** `http://localhost:3002/audio-test`

    ポート番号は `.env` ファイルの `PORT` 変数で変更可能です。

## 📜 バージョン履歴
**v1.3.0**<br>
* **管理者機能の大幅強化**<br>
チャンネル管理UIを刷新し、Webフォームからの直感的な追加・編集に対応<br>
チャンネル設定項目を拡張（診察室数、受付使用有無など）<br>
* **システムログ閲覧ページを新規追加**（フィルタリング、自動更新、チャンネル別表示機能付き）

**v1.2.0**<br>
* **音声機能の強化と多言語対応**<br>
日本語(VOICEVOX)・英語(Kokoro TTS)の多言語呼び出しに対応<br>
チャンネルごとに使用する音声IDを設定可能に (`voiceConfig`)<br>
音声ファイルを事前生成するための各種スクリプトを追加<br>
音声選択のためのサンプル音声再生機能を追加<br>

**v1.1.0**<br>
* **管理者機能の導入**<br>
管理者ログイン機能を追加<br>
`channels.json`をWeb UIから直接編集する機能を追加<br>

**v.1.0.0**<br>
* **初期リリース**<br>
基本的な呼び出し機能（Sender/Receiver）<br>
SSEによるリアルタイム通信<br>
`channels.json`ファイルによるチャンネル管理


## 🎵 音声生成スクリプト

本システムでは事前生成音声方式を採用しており、以下のスクリプトを使用して音声ファイルを生成します。

### スクリプト一覧

### `scripts/jp-gen.js`
VOICEVOXを使用して日本語での音声ファイルを生成します。
#### 音声一覧取得(例)
```bash
node scripts/jp-gen.js --help
```
#### 音声生成(例)
```bash
node scripts/jp-gen.js --voice-id voice1 --speaker-id 1 --pitch 0.0 --speed 1.0 1 100
```

### `scripts/en-gen.js`
Kokoro TTSを使用して英語での音声ファイルを生成します。
#### 音声一覧取得(例)
```bash
node scripts/en-gen.js --help
```
#### 音声生成(例)
```bash
node scripts/en-gen.js --voice-id voice2_en --voice af_bella --speed 1.0 1 100
```

### `scripts/cn-gen.js`
Kokoro TTSを使用して中国語での音声ファイルを生成します。
#### 音声一覧取得(例)
```bash
node scripts/cn-gen.js --help
```
#### 音声生成(例)
```bash
node scripts/cn-gen.js --voice-id voice3_cn --voice cmn_hans_bella --speed 1.0 1 100
```

### 使用例(VOICEVOX):
```bash
# voice1で整理券1-100番を生成（デフォルト設定）
node scripts/jp-gen.js 1 100

# voice2でスピーカーID 8、ピッチ0.1、速度1.2で生成
node scripts/jp-gen.js --voice-id voice2 --speaker-id 8 --pitch 0.1 --speed 1.2 1 100
```

**生成されるファイル:**
- `public/audio/pregenerated/japanese/{voice-id}/ticket_{番号}.mp3`: 「呼び出し番号 X番のかた」
- `public/audio/pregenerated/japanese/{voice-id}/room_{番号}.mp3`: 「X番診察室へお越しください。」
- `public/audio/pregenerated/japanese/{voice-id}/room_reception.mp3`: 「受付にお越しください。」
- `public/audio/pregenerated/japanese/{voice-id}/room_xray.mp3`: 「レントゲン室へお越しください。」


### 使用例(Kokoro TTS 英語):
```bash
# vpoce2で整理券1-100番を生成（デフォルト設定）
node scripts/en-gen.js 1 100

# voice2_enで音声af_bella、速度1.0で生成
node scripts/en-gen.js --voice-id voice2_en --voice af_bella --speed 1.0 1 100
```

**生成されるファイル:**
- `public/audio/pregenerated/english/{voice-id}/ticket_{番号}.mp3`: "Ticket number X, please come to examination room Y."
- `public/audio/pregenerated/english/{voice-id}/room_{番号}.mp3`: "Please come to examination room X."
- `public/audio/pregenerated/english/{voice-id}/room_reception.mp3`: "Please come to the reception desk."
- `public/audio/pregenerated/english/{voice-id}/room_xray.mp3`: "Please come to the X-ray room."

### 使用例(Kokoro TTS 中国語):
```bash
# voice1で整理券1-100番を生成（デフォルト設定）
node scripts/cn-gen.js 1 100

# voice3_cnで音声cn_xiaobei、速度1.0で生成
node scripts/cn-gen.js --voice-id voice3_cn --voice cn_xiaobei --speed 1.0 1 100
```

**生成されるファイル:**
- `public/audio/pregenerated/chinese/{voice-id}/ticket_{番号}.mp3`: "{number}號的病人，請前往{number}號診療室。"
- `public/audio/pregenerated/chinese/{voice-id}/room_{番号}.mp3`: "{number}號診療室，請前往{number}號診療室。"
- `public/audio/pregenerated/chinese/{voice-id}/room_reception.mp3`: "請到掛號處。"
- `public/audio/pregenerated/chinese/{voice-id}/room_xray.mp3`: "請到X光室。"   

## 🙏 謝辞 (Acknowledgements)

本プロジェクトでは、以下の素晴らしい音声合成ライブラリおよびキャラクターを使用させていただいております。

### VOICEVOX

*   四国めたん, ずんだもん, 春日部つむぎ, 雨晴はう
*   波音リツ, 玄野武宏, 白上虎太郎, 青山龍星
*   冥鳴ひまり, 九州そら, もち子(cv 明日葉よもぎ), 剣崎雌雄
*   WhiteCUL, 後鬼, No.7, ちび式じい
*   櫻歌ミコ, 小夜/SAYO, ナースロボ＿タイプＴ, †聖騎士 紅桜†
*   雀松朱司, 麒ヶ島宗麟, 春歌ナナ, 猫使アル
*   猫使ビィ, 中国うさぎ, 栗田まろん, あいえるたん
*   満別花丸, 琴詠ニア, Voidoll(CV:丹下桜), ぞん子
*   中部つるぎ

---

## 作者
YutoMise