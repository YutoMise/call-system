// /home/m41/call-system/scripts/generate-audio-kokoro.js
const fs = require('node:fs');
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') }); // .envファイルを読み込む
const { spawnSync } = require('node:child_process'); // ffmpeg実行のため追加
const path = require('node:path');
const ffmpegPath = require('ffmpeg-static');
const fetch = require('node-fetch');

const KOKORO_TTS_API_URL = process.env.KOKORO_TTS_URL || 'http://localhost:8880';
const OUTPUT_BASE_DIR = path.join(__dirname, '../public/audio/pregenerated/english');
const TARGET_FORMAT = 'mp3'; // 'mp3' または 'opus'
const FFMPEG_BITRATE = '96k'; // ファイルサイズを考慮して少し下げる (例: 96k)
const KOKORO_VOICES_FILE_PATH = path.join(__dirname, '../data/kokoro-voices.json');

// 利用可能なKokoro TTS音声一覧（デフォルト）
const DEFAULT_KOKORO_VOICES = [
    { id: 'af_bella', name: 'Bella (Female, American)' },
    { id: 'af_sarah', name: 'Sarah (Female, American)' },
    { id: 'af_nicole', name: 'Nicole (Female, American)' },
    { id: 'af_sky', name: 'Sky (Female, American)' },
    { id: 'af_heart', name: 'Heart (Female, American)' },
    { id: 'am_adam', name: 'Adam (Male, American)' },
    { id: 'am_michael', name: 'Michael (Male, American)' },
    { id: 'bf_emma', name: 'Emma (Female, British)' },
    { id: 'bf_isabella', name: 'Isabella (Female, British)' },
    { id: 'bm_george', name: 'George (Male, British)' },
    { id: 'bm_lewis', name: 'Lewis (Male, British)' }
];

// ファイルから音声一覧を読み込む関数
function loadVoicesFromFile() {
    try {
        if (fs.existsSync(KOKORO_VOICES_FILE_PATH)) {
            const data = fs.readFileSync(KOKORO_VOICES_FILE_PATH, 'utf8');
            const voices = JSON.parse(data);
            console.log(`Kokoro音声一覧をファイルから読み込みました: ${voices.length}件`);
            return voices;
        } else {
            console.warn(`Kokoro音声一覧ファイルが見つかりません: ${KOKORO_VOICES_FILE_PATH}`);
            return null;
        }
    } catch (error) {
        console.warn(`Kokoro音声一覧ファイルの読み込みに失敗しました: ${error.message}`);
        return null;
    }
}

// Kokoro TTSエンジンから音声一覧を取得する関数
async function fetchKokoroVoices() {
    // まずファイルから読み込みを試行
    const fileVoices = loadVoicesFromFile();
    if (fileVoices) {
        return fileVoices;
    }

    // ファイルから読み込めない場合はAPIから取得
    try {
        console.log(`Kokoro音声一覧をAPIから取得中: ${KOKORO_TTS_API_URL}/v1/audio/voices`);
        const response = await fetch(`${KOKORO_TTS_API_URL}/v1/audio/voices`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const voices = data.voices || [];
        
        // 音声データを整理
        const voiceList = voices.map(voice => ({
            id: voice,
            name: voice.charAt(0).toUpperCase() + voice.slice(1).replace(/_/g, ' ')
        }));

        console.log(`Kokoro音声一覧をAPIから取得完了: ${voiceList.length}件`);

        // 取得した音声一覧をファイルに保存
        try {
            const dataDir = path.dirname(KOKORO_VOICES_FILE_PATH);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(KOKORO_VOICES_FILE_PATH, JSON.stringify(voiceList, null, 2), 'utf8');
            console.log(`Kokoro音声一覧をファイルに保存しました: ${KOKORO_VOICES_FILE_PATH}`);
        } catch (saveError) {
            console.warn(`Kokoro音声一覧の保存に失敗しました: ${saveError.message}`);
        }

        return voiceList;

    } catch (error) {
        console.warn(`Kokoro音声一覧のAPI取得に失敗しました: ${error.message}`);
        console.warn('フォールバック: デフォルトの音声一覧を使用します');
        return DEFAULT_KOKORO_VOICES;
    }
}

// ヘルプ表示関数
async function showHelp() {
    console.log(`
Kokoro TTS音声ファイル生成スクリプト

使用方法:
  node generate-audio-kokoro.js [オプション] [開始番号] [終了番号]

オプション:
  --voice-id <id>     音声ID（フォルダ名）[デフォルト: voice2]
  --voice <voice>     Kokoro音声名 [デフォルト: af_bella]
  --speed <value>     速度（0.5〜2.0）[デフォルト: 1.0]
  --help, -h          このヘルプを表示

例:
  node generate-audio-kokoro.js --voice-id voice2_en --voice af_sarah --speed 1.2 1 100
  node generate-audio-kokoro.js --help

利用可能なKokoro音声:
`);

    try {
        const voices = await fetchKokoroVoices();
        voices.forEach(v => {
            console.log(`  ${v.id.padEnd(15)}: ${v.name}`);
        });
    } catch (error) {
        console.error('音声一覧の取得に失敗しました:', error.message);
    }
    console.log('');
}

/**
 * Kokoro TTS APIを使用して音声データを取得し、ファイルに保存する関数
 * @param {string} text 読み上げるテキスト
 * @param {string} baseFilename 保存するファイル名のベース (例: ticket_1)
 * @param {string} voice 音声名
 * @param {number} speed スピード
 * @param {string} outputDir 出力ディレクトリ
 */
async function fetchAndSaveAudio(text, baseFilename, voice, speed, outputDir) {
    const wavFilename = `${baseFilename}.wav`;
    const targetFilename = `${baseFilename}.${TARGET_FORMAT}`;
    console.log(`音声生成開始: "${text}" (Voice: ${voice}, Speed: ${speed}) -> ${targetFilename}`);
    
    try {
        // Kokoro TTS APIで音声合成
        const response = await fetch(`${KOKORO_TTS_API_URL}/v1/audio/speech`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'audio/wav'
            },
            body: JSON.stringify({
                model: 'kokoro',
                input: text,
                voice: voice,
                response_format: 'wav',
                speed: speed
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Kokoro TTS APIエラー (${text} - ${response.status}): ${errorText}`);
            return;
        }

        const audioBuffer = await response.arrayBuffer();
        const wavFilePath = path.join(outputDir, wavFilename);
        const targetFilePath = path.join(outputDir, targetFilename);

        fs.writeFileSync(wavFilePath, Buffer.from(audioBuffer));
        console.log(`WAV保存完了: ${wavFilename}`);

        // ffmpegで変換
        try {
            console.log(`ffmpegで ${TARGET_FORMAT} へ変換開始: ${wavFilename} -> ${targetFilename}`);
            const ffmpegArgs = [
                '-i', wavFilePath,
                '-y',
                '-vn',
                '-ar', '44100',
                '-ac', '1',
                '-b:a', FFMPEG_BITRATE,
                targetFilePath
            ];
            const result = spawnSync(ffmpegPath, ffmpegArgs, { stdio: 'pipe' });
            if (result.status !== 0) {
                const err = new Error(`ffmpeg exited with code ${result.status}`);
                err.stderr = result.stderr;
                throw err;
            }
            console.log(`${TARGET_FORMAT}変換完了: ${targetFilename}`);
            fs.unlinkSync(wavFilePath); // 元のWAVファイルを削除
            console.log(`WAV削除完了: ${wavFilename}`);
        } catch (ffmpegError) {
            console.error(`ffmpeg変換エラー (${wavFilename}):`, ffmpegError.stderr ? ffmpegError.stderr.toString() : ffmpegError.message);
        }

    } catch (error) {
        console.error(`"${text}" の音声処理中に予期せぬエラー:`, error);
    }
}

/**
 * 指定された設定で音声ファイルを生成するメイン関数
 */
async function generateAllAudioFiles(voiceId, voice, speed, ticketStart, ticketEnd) {
    console.log("Kokoro TTS音声ファイルの事前生成を開始します...");
    console.log(`保存先ディレクトリ: ${OUTPUT_BASE_DIR}/${voiceId}`);
    console.log(`音声設定: voiceId=${voiceId}, voice=${voice}, speed=${speed}`);
    console.log(`整理券番号の生成範囲: ${ticketStart} から ${ticketEnd}`);

    // 保存先ディレクトリを作成
    const outputDir = path.join(OUTPUT_BASE_DIR, voiceId);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`ディレクトリを作成しました: ${outputDir}`);
    }

    // 「Ticket number X, please come forward」 (指定範囲)
    for (let i = ticketStart; i <= ticketEnd; i++) {
        const baseTicketFilename = `ticket_${i}`;
        const targetTicketFilename = `${baseTicketFilename}.${TARGET_FORMAT}`;
        if (fs.existsSync(path.join(outputDir, targetTicketFilename))) {
            console.log(`スキップ (既存): ${voiceId}/${targetTicketFilename}`);
            continue;
        }
        await fetchAndSaveAudio(
            `Patient number ${i},`,
            baseTicketFilename,
            voice,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // APIへの負荷軽減
    }

    // 「Please go to examination room Y」 (1から7まで)
    for (let i = 1; i <= 7; i++) {
        const baseRoomFilename = `room_${i}`;
        const targetRoomFilename = `${baseRoomFilename}.${TARGET_FORMAT}`;
        if (fs.existsSync(path.join(outputDir, targetRoomFilename))) {
            console.log(`スキップ (既存): ${voiceId}/${targetRoomFilename}`);
            continue;
        }
        await fetchAndSaveAudio(
            `please come to examination room ${i}.`,
            baseRoomFilename,
            voice,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // APIへの負荷軽減
    }

    // 「Please come to the reception desk.」
    const baseReceptionFilename = `room_reception`;
    const targetReceptionFilename = `${baseReceptionFilename}.${TARGET_FORMAT}`;
    if (!fs.existsSync(path.join(outputDir, targetReceptionFilename))) {
        await fetchAndSaveAudio(
            `please come to the reception desk.`,
            baseReceptionFilename,
            voice,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // APIへの負荷軽減
    } else {
        console.log(`スキップ (既存): ${voiceId}/${targetReceptionFilename}`);
    }

    console.log(`Kokoro TTS音声ファイルの生成が完了しました: ${voiceId}`);
}

// コマンドライン引数の解析
async function parseArguments() {
    const args = process.argv.slice(2);

    // ヘルプ表示チェック
    if (args.includes('--help') || args.includes('-h')) {
        await showHelp();
        process.exit(0);
    }

    // デフォルト値
    let voiceId = 'voice2';
    let voice = 'af_bella';
    let speed = 1.0;
    let ticketStart = 1;
    let ticketEnd = 1000;

    // オプション解析
    const numbers = [];
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--voice-id':
                if (i + 1 < args.length) {
                    voiceId = args[++i];
                } else {
                    console.error('エラー: --voice-id には値が必要です');
                    process.exit(1);
                }
                break;
            case '--voice':
                if (i + 1 < args.length) {
                    voice = args[++i];
                } else {
                    console.error('エラー: --voice には値が必要です');
                    process.exit(1);
                }
                break;
            case '--speed':
                if (i + 1 < args.length) {
                    const value = parseFloat(args[++i]);
                    if (!isNaN(value) && value >= 0.5 && value <= 2.0) {
                        speed = value;
                    } else {
                        console.error('エラー: --speed には0.5から2.0の範囲の値を指定してください');
                        process.exit(1);
                    }
                } else {
                    console.error('エラー: --speed には値が必要です');
                    process.exit(1);
                }
                break;
            default:
                // オプションでない場合は番号として解析
                if (!args[i].startsWith('--')) {
                    const value = parseInt(args[i], 10);
                    if (!isNaN(value) && value > 0) {
                        numbers.push(value);
                    }
                }
                break;
        }
    }

    // 番号の設定
    if (numbers.length >= 1) {
        ticketStart = numbers[0];
    }
    if (numbers.length >= 2) {
        ticketEnd = numbers[1];
    }

    // 終了番号が開始番号より小さい場合の調整
    if (ticketEnd < ticketStart) {
        ticketEnd = ticketStart;
    }

    return { voiceId, voice, speed, ticketStart, ticketEnd };
}

// スクリプト実行（非同期対応）
async function main() {
    try {
        const config = await parseArguments();
        await generateAllAudioFiles(
            config.voiceId,
            config.voice,
            config.speed,
            config.ticketStart,
            config.ticketEnd
        );
    } catch (err) {
        console.error("Kokoro TTS音声生成スクリプト全体でエラーが発生しました:", err);
        process.exit(1);
    }
}

// メイン関数を実行
main();
