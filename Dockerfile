#-----------------------------------------
# Stage 1: ビルダー - 依存関係のインストールと難読化
#-----------------------------------------
    FROM node:22.15.0-alpine AS builder

    WORKDIR /app

    COPY package*.json ./

    RUN npm install --legacy-peer-deps


    
    # プロジェクトの全ファイルをコピー
    COPY . .

    RUN npx terser index.js --compress --mangle --format comments=false -o index.js
    
    # public/js, routes, utils 内の .js ファイルを terser で一括して圧縮・難読化
    # 存在しないディレクトリがあってもエラーにならないように 2>/dev/null を追加
    RUN find public/js routes utils -type f -name '*.js' -print0 2>/dev/null | xargs -0 -n 1 -I {} sh -c 'echo "Tersering {}" && npx terser "{}" --compress --mangle --format comments=false -o "{}"'

    ARG OBFUSCATOR_OPTIONS="\
    --dead-code-injection true \
    --dead-code-injection-threshold 1 \
    --unicode-escape-sequence true"

    RUN npx javascript-obfuscator index.js --output ./obfuscated_index.js ${OBFUSCATOR_OPTIONS} && mv ./obfuscated_index.js index.js
    RUN npx javascript-obfuscator public/js --output ./obfuscated_public_js ${OBFUSCATOR_OPTIONS}
    RUN rm -rf public/js
    RUN mv ./obfuscated_public_js public/js
    
    # routes と utils ディレクトリが存在すれば難読化（forループでまとめる）
    RUN for dir in routes utils; do \
          if [ -d "$dir" ] && [ -n "$(find "$dir" -type f -name '*.js' 2>/dev/null)" ]; then \
            npx javascript-obfuscator "$dir" --output "./obfuscated_$dir" ${OBFUSCATOR_OPTIONS} && rm -rf "$dir" && mv "./obfuscated_$dir" "$dir"; \
          fi; \
        done

    # apiフォルダは難読化しない（samples.js用）
    # api フォルダはそのまま残す

    #-----------------------------------------
    # Stage 2: ランナー - 実行環境
    #-----------------------------------------
    FROM node:22.15.0-alpine
    
    WORKDIR /app
    
    # package*.jsonをコピー
    COPY package*.json ./
    
    # 本番用の依存関係のみインストール
    RUN npm install --omit=dev --legacy-peer-deps
    
    # curl をインストール (デバッグや疎通確認用)
    RUN apk update && apk add curl
    
    # ビルダーステージから難読化されたコードと必要なアセットをコピー
    # /app 全体をコピーするのが簡単だが、より厳密にコピーするファイルを選ぶことも可能
    COPY --from=builder /app /app
    
    # ポートを開放
    EXPOSE 3002
    
    # アプリケーションを実行 (package.jsonの"start"スクリプトが実行される)
    CMD ["npm", "start"]