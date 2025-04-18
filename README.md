# call-system

整理券番号と診察室を案内する呼び出しシステムです。

## ✨ 主な機能

* sender: receiverに対してチャンネルを指定、整理券番号・診察室番号を送信
* receiver: senderから届いた整理券番号・診察券番号を合成音声で読み上げを行う


## 🛠️ 使用技術

* **言語:** JavaScript (Node.js [v22.14.0])
* **フレームワーク:** Express.js
* **データベース:** なし
* **リアルタイム通信:** SSE(Server-Sent Events)
* **パッケージマネージャー:** npm
* **その他:** crypto, dotenv, 

## 🚀 セットアップとローカルでの実行方法

### 必要なもの

* Node.js (推奨バージョン: v22.14.0)
* npm (推奨バージョン: v11.3)

### 手順

1.  **リポジトリをクローン:**
    ```bash
    git clone [https://github.com/YutoMise/call-system.git]
    cd call-system
    ```

2.  **依存パッケージのインストール:**
    ```bash
    npm install
    # または
    # yarn install
    ```
3.  **アプリケーションの起動:**
    ```bash
    npm start
    ```

4.  **アクセス:**
    起動後、Webブラウザなどで `http://localhost:3002` にアクセスします。
    Portはindex.jsにて編集を行うことで変更可(今後環境変数に移行予定)

---

## 作者
YutoMise