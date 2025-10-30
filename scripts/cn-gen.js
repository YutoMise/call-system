// /home/m41/call-system/scripts/cn-gen.js
const fs = require('node:fs');
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') }); // .envファイルを読み込む
const { spawnSync } = require('node:child_process'); // ffmpeg実行のため追加
const path = require('node:path');
const ffmpegPath = require('ffmpeg-static');
const fetch = require('node-fetch');
const { getMessage } = require('./audio-messages'); // メッセージ設定を読み込み

const KOKORO_TTS_API_URL = process.env.KOKORO_TTS_URL || 'http://localhost:8880';
const OUTPUT_BASE_DIR = path.join(__dirname, '../public/audio/pregenerated/chinese'); // ★変更点: 出力ディレクトリ
const TARGET_FORMAT = 'mp3'; // 'mp3' または 'opus'
const FFMPEG_BITRATE = '96k'; // ファイルサイズを考慮して少し下げる (例: 96k)
const KOKORO_VOICES_FILE_PATH = path.join(__dirname, '../data/kokoro-voices.json');

// 利用可能なKokoro TTS音声一覧（デフォルト） - ユーザーが中国語のボイスIDに置き換える必要がある
const DEFAULT_KOKORO_VOICES = [
    { id: 'cmn_hans_bella', name: 'Bella (Female, Chinese)' },
    // ユーザーはここに中国語のボイスを追加/変更する必要がある
];

// ファイルから音声一覧を読み込む関数 (変更なし)
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

// Kokoro TTSエンジンから音声一覧を取得する関数 (変更なし)
async function fetchKokoroVoices() {
    const fileVoices = loadVoicesFromFile();
    if (fileVoices) {
        return fileVoices;
    }
    try {
        console.log(`Kokoro音声一覧をAPIから取得中: ${KOKORO_TTS_API_URL}/v1/audio/voices`);
        const response = await fetch(`${KOKORO_TTS_API_URL}/v1/audio/voices`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        const voices = data.voices || [];
        const voiceList = voices.map(voice => ({
            id: voice,
            name: voice.charAt(0).toUpperCase() + voice.slice(1).replace(/_/g, ' ')
        }));
        console.log(`Kokoro音声一覧をAPIから取得完了: ${voiceList.length}件`);
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
Kokoro TTS音声ファイル生成スクリプト (中国語版)

使用方法:
  node cn-gen.js [オプション] [開始番号] [終了番号]

オプション:
  --voice-id <id>     音声ID（フォルダ名）[デフォルト: voice1]
  --voice <voice>     Kokoro音声名 [デフォルト: zf_xiaobei]
  --speed <value>     速度（0.5〜2.0）[デフォルト: 1.0]
  --help, -h          このヘルプを表示

例:
  node cn-gen.js --voice-id voice1 --voice <chinese_voice_id> --speed 1.0 1 100
  node cn-gen.js --help

利用可能なKokoro音声:
`);
    try {
        const voices = await fetchKokoroVoices();
        voices.forEach(v => {
            console.log(`  ${v.id.padEnd(20)}: ${v.name}`);
        });
    } catch (error) {
        console.error('音声一覧の取得に失敗しました:', error.message);
    }
    console.log('');
}

// 音声取得・保存関数 (変更なし)
async function fetchAndSaveAudio(text, baseFilename, voice, speed, outputDir) {
    const wavFilename = `${baseFilename}.wav`;
    const targetFilename = `${baseFilename}.${TARGET_FORMAT}`;
    console.log(`音声生成開始: "${text}" (Voice: ${voice}, Speed: ${speed}) -> ${targetFilename}`);
    try {
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
            fs.unlinkSync(wavFilePath);
            console.log(`WAV削除完了: ${wavFilename}`);
        } catch (ffmpegError) {
            console.error(`ffmpeg変換エラー (${wavFilename}):`, ffmpegError.stderr ? ffmpegError.stderr.toString() : ffmpegError.message);
        }
    } catch (error) {
        console.error(`"${text}" の音声処理中に予期せぬエラー:`, error);
    }
}

// メインの音声生成関数 (★変更点: 読み上げテキスト)
async function generateAllAudioFiles(voiceId, voice, speed, ticketStart, ticketEnd) {
    console.log("Kokoro TTS音声ファイル(中国語)の事前生成を開始します...");
    console.log(`保存先ディレクトリ: ${OUTPUT_BASE_DIR}/${voiceId}`);
    console.log(`音声設定: voiceId=${voiceId}, voice=${voice}, speed=${speed}`);
    console.log(`整理券番号の生成範囲: ${ticketStart} から ${ticketEnd}`);

    const outputDir = path.join(OUTPUT_BASE_DIR, voiceId);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`ディレクトリを作成しました: ${outputDir}`);
    }

    // 「${i}號的病人，」 (指定範囲)
    for (let i = ticketStart; i <= ticketEnd; i++) {
        const baseTicketFilename = `ticket_${i}`;
        const targetTicketFilename = `${baseTicketFilename}.${TARGET_FORMAT}`;
        if (fs.existsSync(path.join(outputDir, targetTicketFilename))) {
            console.log(`スキップ (既存): ${voiceId}/${targetTicketFilename}`);
            continue;
        }
        await fetchAndSaveAudio(
            getMessage('chinese', 'ticket', i),
            baseTicketFilename,
            voice,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 「請前往${i}號診療室。」 (1から7まで)
    for (let i = 1; i <= 7; i++) {
        const baseRoomFilename = `room_${i}`;
        const targetRoomFilename = `${baseRoomFilename}.${TARGET_FORMAT}`;
        if (fs.existsSync(path.join(outputDir, targetRoomFilename))) {
            console.log(`スキップ (既存): ${voiceId}/${targetRoomFilename}`);
            continue;
        }
        await fetchAndSaveAudio(
            getMessage('chinese', 'room', i),
            baseRoomFilename,
            voice,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 「請到掛號處。」 (受付)
    const baseReceptionFilename = `room_reception`;
    const targetReceptionFilename = `${baseReceptionFilename}.${TARGET_FORMAT}`;
    if (!fs.existsSync(path.join(outputDir, targetReceptionFilename))) {
        await fetchAndSaveAudio(
            getMessage('chinese', 'reception'),
            baseReceptionFilename,
            voice,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200));
    } else {
        console.log(`スキップ (既存): ${voiceId}/${targetReceptionFilename}`);
    }

    console.log(`Kokoro TTS音声ファイル(中国語)の生成が完了しました: ${voiceId}`);
}

// コマンドライン引数解析 (★変更点: デフォルト値)
async function parseArguments() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        await showHelp();
        process.exit(0);
    }

    // ★変更点: デフォルト値
    let voiceId = 'voice1';
    let voice = 'zf_xiaobei'; // 仮の中国語ボイスID。ユーザーは自分の環境に合わせて変更する必要がある。
    let speed = 1.0;
    let ticketStart = 1;
    let ticketEnd = 1000;

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
                if (!args[i].startsWith('--')) {
                    const value = parseInt(args[i], 10);
                    if (!isNaN(value) && value > 0) {
                        numbers.push(value);
                    }
                }
                break;
        }
    }

    if (numbers.length >= 1) {
        ticketStart = numbers[0];
    }
    if (numbers.length >= 2) {
        ticketEnd = numbers[1];
    }

    if (ticketEnd < ticketStart) {
        ticketEnd = ticketStart;
    }

    return { voiceId, voice, speed, ticketStart, ticketEnd };
}

// スクリプト実行
async function main() {
    try {
        const config = await parseArguments();
        // ★注意喚起
        if (config.voice === 'cmn_hans_bella' && !process.argv.includes('--voice')) {
             console.warn('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
             console.warn('注意: --voice オプションが指定されていません。');
             console.warn('仮の中国語音声ID "cmn_hans_bella" を使用します。');
             console.warn('これはあなたの環境では動作しない可能性があります。');
             console.warn('node cn-gen.js --help を実行して利用可能な音声IDを確認し、');
             console.warn('--voice オプションで正しいIDを指定してください。');
             console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
        }
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

main();