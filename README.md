# call-system

整理券番号と診察室を案内する呼び出しシステムです。

## ✨ 主な機能

* sender: receiverに対してチャンネルを指定、整理券番号・診察室番号を送信
* receiver: senderから届いた整理券番号・診察券番号を合成音声で読み上げを行う

### 追加機能  

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
    Shell上でのコマンド実行・停止

    ```shell
    # 起動
    npm start
    # 停止
    (キーボードショットカット)Ctrl + C
    ```  
    Dockerを使用したコンテナ操作
    ```shell
    # 起動
    docker compose up -d
    # 停止
    docker compose down --rmi all
    ```  
    crontabで定期実行を行う  
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
    起動後、Webブラウザなどで `http://localhost:3002` にアクセスします。
    Portはindex.jsにて編集を行うことで変更可(今後環境変数に移行予定)

## 🎵 音声生成スクリプト

本システムでは事前生成音声方式を採用しており、以下のスクリプトを使用して音声ファイルを生成します。

### 日本語音声生成（VOICEVOX）

#### `scripts/generate-audio.js`
VOICEVOX を使用して日本語の音声ファイルを生成します。

**使用方法:**
```bash
node scripts/generate-audio.js [オプション] [開始番号] [終了番号]
```

**オプション:**
- `--voice-id <id>`: 音声ID（フォルダ名）[デフォルト: voice1]
- `--speaker-id <id>`: VoicevoxスピーカーID [デフォルト: 1]
- `--pitch <value>`: ピッチ（-0.15〜0.15）[デフォルト: 0.0]
- `--speed <value>`: 速度（0.5〜2.0）[デフォルト: 1.0]
- `--help, -h`: ヘルプを表示

**使用例:**
```bash
# voice1で整理券1-100番を生成（デフォルト設定）
node scripts/generate-audio.js 1 100

# voice2でスピーカーID 8、ピッチ0.1、速度1.2で生成
node scripts/generate-audio.js --voice-id voice2 --speaker-id 8 --pitch 0.1 --speed 1.2 1 300
```

**生成されるファイル:**
- `public/audio/pregenerated/{voice-id}/ticket_{番号}.mp3`: 「呼び出し番号 X番のかた」
- `public/audio/pregenerated/{voice-id}/room_{番号}.mp3`: 「X番診察室へお越しください。」

#### `scripts/generate-samples.js`
VOICEVOX の各話者でサンプル音声を生成します（音声選択用）。

**使用方法:**
```bash
node scripts/generate-samples.js [話者ID1] [話者ID2] ...
```

**使用例:**
```bash
# 全話者でサンプル生成
node scripts/generate-samples.js

# 特定の話者のみ
node scripts/generate-samples.js 1 3 8
```

### 英語音声生成（Kokoro TTS）

#### `scripts/generate-audio-kokoro.js`
Kokoro TTS を使用して英語の音声ファイルを生成します。

**使用方法:**
```bash
node scripts/generate-audio-kokoro.js [オプション] [開始番号] [終了番号]
```

**オプション:**
- `--voice-id <id>`: 音声ID（フォルダ名）[デフォルト: voice2]
- `--voice <voice>`: Kokoro音声名 [デフォルト: af_bella]
- `--speed <value>`: 速度（0.5〜2.0）[デフォルト: 1.0]
- `--help, -h`: ヘルプを表示

**使用例:**
```bash
# voice2でaf_sarahの音声を生成
KOKORO_TTS_URL=http://localhost:8880 node scripts/generate-audio-kokoro.js --voice-id voice2 --voice af_sarah --speed 1.0 1 300

# 環境変数を設定して実行
export KOKORO_TTS_URL=http://localhost:8880
node scripts/generate-audio-kokoro.js --voice af_sarah 1 100
```

**生成されるファイル:**
- `public/audio/pregenerated/{voice-id}/ticket_{番号}.mp3`: 「Ticket number X,」
- `public/audio/pregenerated/{voice-id}/room_{番号}.mp3`: 「please come to examination room X.」

#### `scripts/generate-samples-kokoro.js`
Kokoro TTS の各音声でサンプル音声を生成します（音声選択用）。

**使用方法:**
```bash
node scripts/generate-samples-kokoro.js [音声名1] [音声名2] ...
```

**使用例:**
```bash
# 全音声でサンプル生成
KOKORO_TTS_URL=http://localhost:8880 node scripts/generate-samples-kokoro.js

# 特定の音声のみ
KOKORO_TTS_URL=http://localhost:8880 node scripts/generate-samples-kokoro.js af_sarah af_bella
```

### ユーティリティスクリプト

#### `scripts/update-speakers.js`
VOICEVOX エンジンから最新の話者一覧を取得してファイルを更新します。

**使用方法:**
```bash
node scripts/update-speakers.js
```

**機能:**
- VOICEVOX APIから話者一覧を取得
- `data/voicevox-speakers.json` を更新
- 新しい話者が追加された際に実行

### 注意事項

1. **VOICEVOX**: `http://localhost:50021` で動作している必要があります
2. **Kokoro TTS**: `http://localhost:8880` で動作している必要があります
3. **環境変数**: `VOICEVOX_URL` や `KOKORO_TTS_URL` で接続先を変更可能
4. **ファイル形式**: 全てMP3形式で出力されます
5. **既存ファイル**: 同名ファイルが存在する場合はスキップされます

---

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