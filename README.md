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