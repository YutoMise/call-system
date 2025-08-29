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
    
    RUN find public/js -type f -name '*.js' -print0 | xargs -0 -n 1 -I {} sh -c 'echo "Tersering {}" && npx terser "{}" --compress --mangle --format comments=false -o "{}"'
    
    RUN if [ -n "$(find routes -type f -name '*.js' 2>/dev/null)" ]; then \
            find routes -type f -name '*.js' -print0 | xargs -0 -n 1 -I {} sh -c 'echo "Tersering {}" && npx terser "{}" --compress --mangle --format comments=false -o "{}"'; \
        fi

    RUN if [ -n "$(find utils -type f -name '*.js' 2>/dev/null)" ]; then \
            find utils -type f -name '*.js' -print0 | xargs -0 -n 1 -I {} sh -c 'echo "Tersering {}" && npx terser "{}" --compress --mangle --format comments=false -o "{}"'; \
        fi



    ARG OBFUSCATOR_OPTIONS="\
    --dead-code-injection true \
    --dead-code-injection-threshold 1 \
    --unicode-escape-sequence true"

    RUN npx javascript-obfuscator index.js --output ./obfuscated_index.js ${OBFUSCATOR_OPTIONS} && mv ./obfuscated_index.js index.js
    RUN npx javascript-obfuscator public/js --output ./obfuscated_public_js ${OBFUSCATOR_OPTIONS}
    RUN rm -rf public/js
    RUN mv ./obfuscated_public_js public/js

    RUN if [ -d "routes" ] && [ -n "$(find routes -type f -name '*.js' 2>/dev/null)" ]; then \
            npx javascript-obfuscator routes --output ./obfuscated_routes ${OBFUSCATOR_OPTIONS} && \
            rm -rf routes && \
            mv ./obfuscated_routes routes; \
        fi

    RUN if [ -d "utils" ] && [ -n "$(find utils -type f -name '*.js' 2>/dev/null)" ]; then \
            npx javascript-obfuscator utils --output ./obfuscated_utils ${OBFUSCATOR_OPTIONS} && \
            rm -rf utils && \
            mv ./obfuscated_utils utils; \
        fi

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