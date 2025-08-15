// CALL-SYSTEM/utils/settingsManager.js
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const SETTINGS_FILE_PATH = path.join(__dirname, '..', 'settings.json'); // ルートからの相対パス
const VOICEVOX_BASE_URL = process.env.VOICEVOX_URL || 'http://voicevox_engine:50021';
const DISABLE_VOICEVOX = process.env.DISABLE_VOICEVOX === 'true';

// --- 状態 ---
let currentSettings = {
    speakerId: parseInt(process.env.DEFAULT_VOICEVOX_SPEAKER_ID || '3', 10),
    pitch: parseFloat(process.env.DEFAULT_VOICEVOX_PITCH || '0.0'),
    speedScale: parseFloat(process.env.DEFAULT_VOICEVOX_SPEED || '1.0')
};
let availableSpeakers = [];

// --- 関数 ---
async function loadSettings() {
    // ... (以前 index.js にあった loadSettings の実装) ...
    // エラー処理内で saveSettings を呼ぶ代わりに、初期値を返すかエラーを投げる
    try {
        const data = await fs.readFile(SETTINGS_FILE_PATH, 'utf8');
        const savedSettings = JSON.parse(data);
        if (savedSettings.speakerId !== undefined) {
            currentSettings.speakerId = parseInt(savedSettings.speakerId, 10);
        }
        if (savedSettings.pitch !== undefined) {
            currentSettings.pitch = parseFloat(savedSettings.pitch);
        }
        if (savedSettings.speedScale !== undefined) { // ★★★ speedScale の読み込み追加 ★★★
            currentSettings.speedScale = parseFloat(savedSettings.speedScale);
        }
        console.log('[設定] settings.json から設定を読み込みました:', currentSettings);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[設定] settings.json が見つかりません。デフォルト設定を使用:', currentSettings);
            // 初回起動時にファイルを作成しておく
            await saveSettings(currentSettings.speakerId, currentSettings.pitch);
        } else {
            console.error('[エラー] settings.json 読み込み失敗:', error);
        }
    }
}

async function saveSettings(speakerId, pitch, speedScale) {
    // ... (以前 index.js にあった saveSettings の実装、currentSettings の更新を含む) ...
    currentSettings.speakerId = parseInt(speakerId, 10);
    currentSettings.pitch = parseFloat(pitch);
    currentSettings.speedScale = parseFloat(speedScale);
    try {
        await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(currentSettings, null, 2), 'utf8');
        console.log('[設定] 設定を settings.json に保存:', currentSettings);
    } catch (error) {
        console.error('[エラー] settings.json 書き込み失敗:', error);
        throw error; // エラーを呼び出し元に伝える
    }
}

async function fetchAvailableSpeakers() {
    if (DISABLE_VOICEVOX) {
        console.log('[Voicevox] Voicevoxエンジンが無効化されています。デフォルト話者を使用します。');
        availableSpeakers = [
            {
                "name": "デフォルト話者",
                "speaker_uuid": "default",
                "styles": [
                    {
                        "name": "ノーマル",
                        "id": 6,
                        "type": "talk"
                    }
                ]
            }
        ];
        return;
    }

    try {
        console.log(`[Voicevox] 話者リストを ${VOICEVOX_BASE_URL}/speakers から取得中...`);
        const response = await axios.get(`${VOICEVOX_BASE_URL}/speakers`);
        availableSpeakers = response.data; // グローバル変数に格納
        console.log('[Voicevox] 話者リスト取得完了。');
    } catch (error) {
        console.error('[エラー] Voicevoxの話者リスト取得に失敗しました:', error.message);
        if (error.response) { // Axiosのエラー詳細
            console.error('エラーレスポンス Status:', error.response.status);
            console.error('エラーレスポンス Data:', error.response.data);
       } else if (error.request) { // リクエストは送られたがレスポンスがない
            console.error('エラーリクエスト:', error.request);
       } else { // リクエスト設定時のエラー
            console.error('リクエスト設定エラー:', error.message);
       }
        availableSpeakers = []; // エラー時は空にする
        // 必要であればエラーを投げるか、呼び出し元に伝える
    }
}

async function synthesizeSpeechInternal(text) {
    if (!text) {
        throw new Error("合成するテキストが空です。");
    }

    if (DISABLE_VOICEVOX) {
        console.log(`[音声合成スキップ] Voicevoxが無効化されています。Text='${text}'`);
        // ダミーのバイナリデータを返す（実際の音声ファイルではない）
        return Buffer.from('dummy audio data');
    }

    // 現在の設定を使用
    const speaker = currentSettings.speakerId;
    const pitch = currentSettings.pitch;
    const speed = currentSettings.speedScale || 1.0;

    console.log(`[音声合成実行] Text='${text}', SpeakerID=${speaker}, Pitch=${pitch}`);

    try {
        // 1. audio_query で合成パラメータを取得
        const queryResponse = await axios.post(
            `${VOICEVOX_BASE_URL}/audio_query`, // POSTに変更 & クエリパラメータをURLから削除
            null, // POSTボディは空 (または Voicevox API 仕様による)
            {
                params: { // クエリパラメータは params で指定
                    text: text,
                    speaker: speaker
                },
                headers: { 'accept': 'application/json' }
            }
        );
        const queryData = queryResponse.data;
        console.log('[音声合成] audio_query 取得完了。');

        // 2. パラメータにピッチ変更を適用
        queryData.pitch = pitch;
        queryData.speedScale = speed;
        console.log(`[音声合成] ピッチを ${pitch}, 速度を ${speed} に設定。`);

        // 3. synthesis で音声合成実行
        console.log('[音声合成] synthesis をリクエスト中...');
        const synthesisResponse = await axios.post(
            `${VOICEVOX_BASE_URL}/synthesis`, // POST
            queryData, // 変更したクエリデータをボディとして送信
            {
                params: { // クエリパラメータで speaker を指定
                    speaker: speaker
                },
                headers: {
                    'accept': 'audio/wav',
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer' // 音声データをバイナリ(Buffer)で受け取る
            }
        );

        console.log(`[音声合成成功] Text='${text}'`);
        return Buffer.from(synthesisResponse.data); // Bufferを返す

    } catch (error) {
        console.error(`[音声合成エラー] Text='${text}'`, error.message);
         if (error.response) {
            console.error('Voicevox応答ステータス:', error.response.status);
            try {
               const errorJson = JSON.parse(Buffer.from(error.response.data).toString('utf8'));
               console.error('Voicevox応答データ:', errorJson);
            } catch {
               console.error('Voicevox応答データ (非JSON):', Buffer.from(error.response.data).toString('utf8'));
            }
         } else if (error.request) {
             console.error('[エラー] Voicevoxへのリクエスト送信失敗:', error.request);
         } else {
             console.error('リクエスト設定エラー:', error.message);
         }
        // エラーを上に投げて、APIルート側で500エラーなどを返せるようにする
        throw new Error(`Voicevoxでの音声合成に失敗しました (${error.message})`);
    }
}

function getCurrentSettings() {
    return { ...currentSettings }; // コピーを返す
}

function getAvailableSpeakers() {
    return [...availableSpeakers]; // コピーを返す
}

// モジュールの初期化（非同期）
async function initializeSettings() {
    await loadSettings();
    await fetchAvailableSpeakers();
}

module.exports = {
    initializeSettings, // 初期化関数
    getCurrentSettings,
    getAvailableSpeakers,
    saveSettings,
    synthesizeSpeechInternal,
    // 必要に応じて他の関数もエクスポート
};