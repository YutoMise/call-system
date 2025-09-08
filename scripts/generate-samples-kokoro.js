// scripts/generate-samples-kokoro.js
const fs = require('node:fs');
const path = require('node:path');
const fetch = require('node-fetch');
const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const KOKORO_TTS_API_URL = process.env.KOKORO_TTS_URL || 'http://kokoro_tts:8880';
const OUTPUT_BASE_DIR = path.join(__dirname, '../public/audio/samples/english');
const TARGET_FORMAT = 'mp3';
const FFMPEG_BITRATE = '96k';
const KOKORO_VOICES_FILE_PATH = path.join(__dirname, '../data/kokoro-voices.json');

// サンプル用の固定文言（英語版）
const SAMPLE_TEXTS = [
    {
        filename: 'sample_call',
        text: 'Ticket number 12, please come to examination room 1.'
    }
];

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

// 音声合成とファイル保存を行う関数
async function fetchAndSaveAudio(text, filename, voice, outputDir) {
    const wavFilename = `${filename}.wav`;
    const targetFilename = `${filename}.${TARGET_FORMAT}`;
    console.log(`音声生成開始: "${text}" (Voice: ${voice}) -> ${targetFilename}`);

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
                speed: 1.0
            })
        });

        if (!response.ok) {
            throw new Error(`Kokoro TTS API failed: ${response.status} ${response.statusText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        const wavFilePath = path.join(outputDir, wavFilename);
        const targetFilePath = path.join(outputDir, targetFilename);

        // WAVファイルを保存
        fs.writeFileSync(wavFilePath, Buffer.from(audioBuffer));
        console.log(`WAVファイル保存完了: ${wavFilename}`);

        // ffmpegでMP3に変換を試行
        try {
            await convertToMp3(wavFilePath, targetFilePath);
            // 変換成功時はWAVファイルを削除
            fs.unlinkSync(wavFilePath);
            console.log(`音声生成完了: ${targetFilename}`);
        } catch (ffmpegError) {
            console.warn(`MP3変換に失敗しました: ${ffmpegError.message}`);
            console.log(`WAVファイルのまま保存されました: ${wavFilename}`);
            // WAVファイルをそのまま使用
        }

    } catch (error) {
        console.error(`音声生成エラー (Voice: ${voice}): ${error.message}`);
        throw error;
    }
}

// ffmpegでMP3に変換する関数
function convertToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        // const ffmpeg = spawn('ffmpeg', [
        const ffmpeg = spawn(ffmpegPath, [
            '-i', inputPath,
            '-codec:a', 'libmp3lame',
            '-b:a', FFMPEG_BITRATE,
            '-y', // 上書き
            outputPath
        ]);

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (error) => {
            reject(error);
        });
    });
}

// ヘルプ表示関数
async function showHelp() {
    console.log(`
Kokoro TTSサンプル音声ファイル生成スクリプト

使用方法:
  node generate-samples-kokoro.js [オプション]

オプション:
  --voices <voices>    生成対象の音声名（カンマ区切り）[例: af_bella,af_sarah]
  --all               全音声で生成
  --help, -h          このヘルプを表示

例:
  node generate-samples-kokoro.js --voices af_bella,af_sarah
  node generate-samples-kokoro.js --all
  node generate-samples-kokoro.js --help

生成される音声:
  "${SAMPLE_TEXTS[0].text}"

出力先:
  ${OUTPUT_BASE_DIR}/{voice}/
`);

    console.log('利用可能なKokoro音声:');
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

// コマンドライン引数の解析
function parseArguments() {
    const args = process.argv.slice(2);
    
    // ヘルプ表示チェック
    if (args.includes('--help') || args.includes('-h')) {
        return { showHelp: true };
    }

    let voices = [];
    let generateAll = false;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--voices':
                if (i + 1 < args.length) {
                    const voicesString = args[++i];
                    voices = voicesString.split(',').map(voice => voice.trim());
                } else {
                    console.error('エラー: --voices には値が必要です');
                    process.exit(1);
                }
                break;
            case '--all':
                generateAll = true;
                break;
            default:
                if (args[i].startsWith('--')) {
                    console.error(`エラー: 不明なオプション "${args[i]}"`);
                    process.exit(1);
                }
                break;
        }
    }

    return { voices, generateAll, showHelp: false };
}

// メイン関数
async function generateSampleAudioFiles(voices, generateAll) {
    console.log('Kokoro TTSサンプル音声ファイルの生成を開始します...');
    console.log(`出力先ディレクトリ: ${OUTPUT_BASE_DIR}`);

    // 音声一覧を取得
    const availableVoices = await fetchKokoroVoices();
    if (!availableVoices || availableVoices.length === 0) {
        console.error('音声一覧の取得に失敗しました。Kokoro TTSサーバーが起動しているか確認してください。');
        process.exit(1);
    }

    // 生成対象の音声を決定
    let targetVoices;
    if (generateAll) {
        targetVoices = availableVoices.map(v => v.id);
        console.log(`全音声（${targetVoices.length}件）で生成します`);
    } else if (voices.length > 0) {
        // 指定された音声が存在するかチェック
        const validVoices = availableVoices.map(v => v.id);
        const invalidVoices = voices.filter(voice => !validVoices.includes(voice));
        if (invalidVoices.length > 0) {
            console.error(`エラー: 存在しない音声名: ${invalidVoices.join(', ')}`);
            console.error('利用可能な音声名を確認するには: node generate-samples-kokoro.js --help');
            process.exit(1);
        }
        targetVoices = voices;
        console.log(`指定された音声（${targetVoices.length}件）で生成します: ${targetVoices.join(', ')}`);
    } else {
        console.error('エラー: --voices または --all オプションを指定してください');
        await showHelp();
        process.exit(1);
    }

    // ベースディレクトリを作成
    if (!fs.existsSync(OUTPUT_BASE_DIR)) {
        fs.mkdirSync(OUTPUT_BASE_DIR, { recursive: true });
        console.log(`ディレクトリを作成しました: ${OUTPUT_BASE_DIR}`);
    }

    let successCount = 0;
    let errorCount = 0;

    // 各音声で音声生成
    for (const voice of targetVoices) {
        const voiceInfo = availableVoices.find(v => v.id === voice);
        const voiceName = voiceInfo ? voiceInfo.name : voice;
        
        console.log(`\n=== Voice: ${voice} (${voiceName}) ===`);
        
        // 音声別ディレクトリを作成
        const voiceDir = path.join(OUTPUT_BASE_DIR, voice);
        if (!fs.existsSync(voiceDir)) {
            fs.mkdirSync(voiceDir, { recursive: true });
        }

        try {
            let voiceSkipped = 0;
            let voiceGenerated = 0;

            // 各サンプルテキストで音声生成
            for (const sample of SAMPLE_TEXTS) {
                // 既存ファイルをチェック（MP3とWAVの両方）
                const mp3FilePath = path.join(voiceDir, `${sample.filename}.mp3`);
                const wavFilePath = path.join(voiceDir, `${sample.filename}.wav`);

                if (fs.existsSync(mp3FilePath) || fs.existsSync(wavFilePath)) {
                    console.log(`スキップ (既存): ${voice}/${sample.filename}`);
                    voiceSkipped++;
                    continue;
                }

                await fetchAndSaveAudio(sample.text, sample.filename, voice, voiceDir);
                voiceGenerated++;
                await new Promise(resolve => setTimeout(resolve, 200)); // API負荷軽減
            }

            if (voiceGenerated > 0) {
                console.log(`${voice}: 新規生成 ${voiceGenerated}件, スキップ ${voiceSkipped}件`);
            } else {
                console.log(`${voice}: 全てスキップ (${voiceSkipped}件)`);
            }
            successCount++;
        } catch (error) {
            console.error(`Voice ${voice} の音声生成に失敗しました: ${error.message}`);
            errorCount++;
        }
    }

    console.log(`\n=== 生成完了 ===`);
    console.log(`成功: ${successCount}件`);
    console.log(`失敗: ${errorCount}件`);
    console.log(`出力先: ${OUTPUT_BASE_DIR}`);
}

// スクリプト実行（非同期対応）
async function main() {
    try {
        const config = parseArguments();
        
        if (config.showHelp) {
            await showHelp();
            return;
        }
        
        await generateSampleAudioFiles(config.voices, config.generateAll);
    } catch (err) {
        console.error("Kokoro TTSサンプル音声生成スクリプトでエラーが発生しました:", err);
        process.exit(1);
    }
}

// メイン関数を実行
if (require.main === module) {
    main();
}

module.exports = { generateSampleAudioFiles };
