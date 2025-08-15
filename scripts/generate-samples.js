// scripts/generate-samples.js
const fs = require('node:fs');
const path = require('node:path');
const fetch = require('node-fetch');
const { spawn } = require('node:child_process');

const VOICEVOX_API_URL = process.env.VOICEVOX_URL || 'http://localhost:50021';
const OUTPUT_BASE_DIR = path.join(__dirname, '../public/audio/samples');
const TARGET_FORMAT = 'mp3';
const FFMPEG_BITRATE = '96k';
const SPEAKERS_FILE_PATH = path.join(__dirname, '../data/voicevox-speakers.json');

// サンプル用の固定文言
const SAMPLE_TEXTS = [
    {
        filename: 'sample_call',
        text: '呼び出し番号 12番のかた、1番診察室へお越しください。'
    }
];

// ファイルから話者一覧を読み込む関数
function loadSpeakersFromFile() {
    try {
        if (fs.existsSync(SPEAKERS_FILE_PATH)) {
            const data = fs.readFileSync(SPEAKERS_FILE_PATH, 'utf8');
            const speakers = JSON.parse(data);
            console.log(`話者一覧をファイルから読み込みました: ${speakers.length}件`);
            return speakers;
        } else {
            console.warn(`話者一覧ファイルが見つかりません: ${SPEAKERS_FILE_PATH}`);
            return null;
        }
    } catch (error) {
        console.warn(`話者一覧ファイルの読み込みに失敗しました: ${error.message}`);
        return null;
    }
}

// 音声合成とファイル保存を行う関数
async function fetchAndSaveAudio(text, filename, speakerId, outputDir) {
    const wavFilename = `${filename}.wav`;
    const targetFilename = `${filename}.${TARGET_FORMAT}`;
    console.log(`音声生成開始: "${text}" (Speaker: ${speakerId}) -> ${targetFilename}`);

    try {
        // 1. audio_query で合成パラメータを取得
        const queryUrl = `${VOICEVOX_API_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;
        const queryResponse = await fetch(queryUrl, {
            method: 'POST'
        });

        if (!queryResponse.ok) {
            throw new Error(`audio_query failed: ${queryResponse.status} ${queryResponse.statusText}`);
        }

        const audioQuery = await queryResponse.json();

        // 2. synthesis で音声データを取得
        const synthesisUrl = `${VOICEVOX_API_URL}/synthesis?speaker=${speakerId}`;
        const synthesisResponse = await fetch(synthesisUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(audioQuery)
        });

        if (!synthesisResponse.ok) {
            throw new Error(`synthesis failed: ${synthesisResponse.status} ${synthesisResponse.statusText}`);
        }

        const audioBuffer = await synthesisResponse.arrayBuffer();
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
        console.error(`音声生成エラー (Speaker: ${speakerId}): ${error.message}`);
        throw error;
    }
}

// ffmpegでMP3に変換する関数
function convertToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
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
function showHelp() {
    console.log(`
サンプル音声ファイル生成スクリプト

使用方法:
  node generate-samples.js [オプション]

オプション:
  --speaker-ids <ids>  生成対象のスピーカーID（カンマ区切り）[例: 1,8,10]
  --all               全スピーカーで生成
  --help, -h          このヘルプを表示

例:
  node generate-samples.js --speaker-ids 1,8,10
  node generate-samples.js --all
  node generate-samples.js --help

生成される音声:
  "${SAMPLE_TEXTS[0].text}"

出力先:
  ${OUTPUT_BASE_DIR}/speaker_{id}/
`);
}

// コマンドライン引数の解析
function parseArguments() {
    const args = process.argv.slice(2);
    
    // ヘルプ表示チェック
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    let speakerIds = [];
    let generateAll = false;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--speaker-ids':
                if (i + 1 < args.length) {
                    const idsString = args[++i];
                    speakerIds = idsString.split(',').map(id => {
                        const parsed = parseInt(id.trim(), 10);
                        if (isNaN(parsed) || parsed < 0) {
                            console.error(`エラー: 無効なスピーカーID "${id}"`);
                            process.exit(1);
                        }
                        return parsed;
                    });
                } else {
                    console.error('エラー: --speaker-ids には値が必要です');
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

    return { speakerIds, generateAll };
}

// メイン関数
async function generateSampleAudioFiles(speakerIds, generateAll) {
    console.log('サンプル音声ファイルの生成を開始します...');
    console.log(`出力先ディレクトリ: ${OUTPUT_BASE_DIR}`);

    // 話者一覧を取得
    const speakers = loadSpeakersFromFile();
    if (!speakers || speakers.length === 0) {
        console.error('話者一覧の取得に失敗しました。先に npm run update-speakers を実行してください。');
        process.exit(1);
    }

    // 生成対象のスピーカーIDを決定
    let targetSpeakerIds;
    if (generateAll) {
        targetSpeakerIds = speakers.map(s => s.id);
        console.log(`全スピーカー（${targetSpeakerIds.length}件）で生成します`);
    } else if (speakerIds.length > 0) {
        // 指定されたIDが存在するかチェック
        const validIds = speakers.map(s => s.id);
        const invalidIds = speakerIds.filter(id => !validIds.includes(id));
        if (invalidIds.length > 0) {
            console.error(`エラー: 存在しないスピーカーID: ${invalidIds.join(', ')}`);
            console.error('利用可能なスピーカーIDを確認するには: npm run generate-audio -- --help');
            process.exit(1);
        }
        targetSpeakerIds = speakerIds;
        console.log(`指定されたスピーカー（${targetSpeakerIds.length}件）で生成します: ${targetSpeakerIds.join(', ')}`);
    } else {
        console.error('エラー: --speaker-ids または --all オプションを指定してください');
        showHelp();
        process.exit(1);
    }

    // ベースディレクトリを作成
    if (!fs.existsSync(OUTPUT_BASE_DIR)) {
        fs.mkdirSync(OUTPUT_BASE_DIR, { recursive: true });
        console.log(`ディレクトリを作成しました: ${OUTPUT_BASE_DIR}`);
    }

    let successCount = 0;
    let errorCount = 0;

    // 各スピーカーで音声生成
    for (const speakerId of targetSpeakerIds) {
        const speaker = speakers.find(s => s.id === speakerId);
        const speakerName = speaker ? speaker.name : `Unknown(${speakerId})`;
        
        console.log(`\n=== Speaker ${speakerId}: ${speakerName} ===`);
        
        // スピーカー別ディレクトリを作成
        const speakerDir = path.join(OUTPUT_BASE_DIR, `speaker_${speakerId}`);
        if (!fs.existsSync(speakerDir)) {
            fs.mkdirSync(speakerDir, { recursive: true });
        }

        try {
            // 各サンプルテキストで音声生成
            for (const sample of SAMPLE_TEXTS) {
                await fetchAndSaveAudio(sample.text, sample.filename, speakerId, speakerDir);
                await new Promise(resolve => setTimeout(resolve, 200)); // API負荷軽減
            }
            successCount++;
        } catch (error) {
            console.error(`Speaker ${speakerId} の音声生成に失敗しました: ${error.message}`);
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
        await generateSampleAudioFiles(config.speakerIds, config.generateAll);
    } catch (err) {
        console.error("サンプル音声生成スクリプトでエラーが発生しました:", err);
        process.exit(1);
    }
}

// メイン関数を実行
if (require.main === module) {
    main();
}

module.exports = { generateSampleAudioFiles };
