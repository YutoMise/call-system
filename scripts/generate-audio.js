// /home/m41/call-system/scripts/generate-audio.js
const fs = require('node:fs');
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') }); // .envファイルを読み込む
const { execSync } = require('node:child_process'); // ffmpeg実行のため追加
const path = require('node:path');
// node-fetchのv3以降はESMのみサポートのため、package.jsonに "type": "module" を追加するか、
// CommonJSで使えるv2系 (npm install node-fetch@2) をインストールしてください。
// 以下は node-fetch v2 を想定した書き方です。
const ffmpegPath = 'ffmpeg'; // システムのffmpegを使用
const fetch = require('node-fetch');

const VOICEVOX_API_URL = process.env.VOICEVOX_URL || 'http://localhost:50021';
const OUTPUT_BASE_DIR = path.join(__dirname, '../public/audio/pregenerated');
const TARGET_FORMAT = 'mp3'; // 'mp3' または 'opus'
const FFMPEG_BITRATE = '96k'; // ファイルサイズを考慮して少し下げる (例: 96k)
const SPEAKERS_FILE_PATH = path.join(__dirname, '../data/voicevox-speakers.json');

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

// Voicevoxエンジンから話者一覧を取得する関数
async function fetchVoicevoxSpeakers() {
    // まずファイルから読み込みを試行
    const fileSpeakers = loadSpeakersFromFile();
    if (fileSpeakers) {
        return fileSpeakers;
    }

    // ファイルから読み込めない場合はAPIから取得
    try {
        console.log(`Voicevox話者一覧をAPIから取得中: ${VOICEVOX_API_URL}/speakers`);
        const response = await fetch(`${VOICEVOX_API_URL}/speakers`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const speakers = await response.json();
        const speakerList = [];

        // 話者データを整理（各話者の各スタイルを個別のエントリとして展開）
        speakers.forEach(speaker => {
            speaker.styles.forEach(style => {
                speakerList.push({
                    id: style.id,
                    name: `${speaker.name}（${style.name}）`
                });
            });
        });

        // IDでソート
        speakerList.sort((a, b) => a.id - b.id);

        console.log(`話者一覧をAPIから取得完了: ${speakerList.length}件`);

        // 取得した話者一覧をファイルに保存
        try {
            const dataDir = path.dirname(SPEAKERS_FILE_PATH);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(SPEAKERS_FILE_PATH, JSON.stringify(speakerList, null, 2), 'utf8');
            console.log(`話者一覧をファイルに保存しました: ${SPEAKERS_FILE_PATH}`);
        } catch (saveError) {
            console.warn(`話者一覧の保存に失敗しました: ${saveError.message}`);
        }

        return speakerList;

    } catch (error) {
        console.warn(`Voicevox話者一覧のAPI取得に失敗しました: ${error.message}`);
        console.warn('フォールバック: 基本的な話者一覧を使用します');

        // 最終フォールバック用の基本的な話者一覧
        return [
            { id: 0, name: "四国めたん（ノーマル）" },
            { id: 1, name: "ずんだもん（ノーマル）" },
            { id: 2, name: "四国めたん（あまあま）" },
            { id: 3, name: "ずんだもん（あまあま）" },
            { id: 4, name: "四国めたん（ツンツン）" },
            { id: 5, name: "ずんだもん（ツンツン）" },
            { id: 6, name: "四国めたん（セクシー）" },
            { id: 7, name: "ずんだもん（セクシー）" },
            { id: 8, name: "春日部つむぎ（ノーマル）" },
            { id: 9, name: "波音リツ（ノーマル）" },
            { id: 10, name: "雨晴はう（ノーマル）" },
            { id: 11, name: "玄野武宏（ノーマル）" },
            { id: 12, name: "白上虎太郎（ふつう）" },
            { id: 13, name: "青山龍星（ノーマル）" },
            { id: 14, name: "冥鳴ひまり（ノーマル）" },
            { id: 15, name: "九州そら（ノーマル）" }
        ];
    }
}

// ヘルプ表示関数（ファイルから話者一覧を取得）
async function showHelp() {
    console.log(`
音声ファイル生成スクリプト

使用方法:
  node generate-audio.js [オプション] [開始番号] [終了番号]

オプション:
  --voice-id <id>     音声ID（フォルダ名）[デフォルト: voice1]
  --speaker-id <id>   VoicevoxスピーカーID [デフォルト: 1]
  --pitch <value>     ピッチ（-0.15〜0.15）[デフォルト: 0.0]
  --speed <value>     速度（0.5〜2.0）[デフォルト: 1.0]
  --help, -h          このヘルプを表示

例:
  node generate-audio.js --voice-id voice2 --speaker-id 8 --pitch 0.1 --speed 1.2 1 100
  node generate-audio.js --help

話者一覧の更新:
  node scripts/update-speakers.js
`);

    console.log('利用可能なVoicevoxスピーカー:');
    try {
        const speakers = await fetchVoicevoxSpeakers();
        speakers.forEach(s => {
            console.log(`  ${s.id.toString().padStart(3)}: ${s.name}`);
        });

        if (speakers.length > 16) {
            console.log(`\n※ 話者一覧を最新に更新するには: node scripts/update-speakers.js`);
        }
    } catch (error) {
        console.error('話者一覧の取得に失敗しました:', error.message);
    }
    console.log('');
}

/**
 * Voicevox APIを使用して音声データを取得し、ファイルに保存する関数
 * @param {string} text 読み上げるテキスト
 * @param {string} baseFilename 保存するファイル名のベース (例: ticket_1).
 * @param {number} speakerId スピーカーID.
 * @param {number} pitch ピッチ.
 * @param {number} speed スピード.
 */
async function fetchAndSaveAudio(text, baseFilename, speakerId, pitch, speed, outputDir) {
    const wavFilename = `${baseFilename}.wav`;
    const targetFilename = `${baseFilename}.${TARGET_FORMAT}`;
    console.log(`音声生成開始: "${text}" (Speaker: ${speakerId}, Pitch: ${pitch}, Speed: ${speed}) -> ${targetFilename}`);
    try {
        // 1. audio_query (音声合成用のクエリを作成)
        const audioQueryResponse = await fetch(
            `${VOICEVOX_API_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
            {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
            } // speakerId はURLのクエリパラメータで渡す
        );

        if (!audioQueryResponse.ok) {
            const errorText = await audioQueryResponse.text();
            console.error(`audio_queryエラー (${text} - ${audioQueryResponse.status}): ${errorText}`);
            return;
        }
        const audioQuery = await audioQueryResponse.json();

        // audioQueryにピッチと速度を設定
        audioQuery.pitchScale = pitch;
        audioQuery.speedScale = speed;
        // 必要に応じて他のパラメータも設定 (例: audioQuery.volumeScale = 1.0;)

        // 2. synthesis (音声合成を実行)
        const synthesisResponse = await fetch(
            `${VOICEVOX_API_URL}/synthesis?speaker=${speakerId}`, // speakerId はクエリパラメータでも渡す
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'audio/wav',
                },
                body: JSON.stringify(audioQuery),
            } // (synthesisのspeakerパラメータは必須だが、audioQuery内のspeakerが優先される場合もある)
        );

        if (!synthesisResponse.ok) {
            const errorText = await synthesisResponse.text();
            console.error(`synthesisエラー (${text} - ${synthesisResponse.status}): ${errorText}`);
            return;
        }

        const audioBuffer = await synthesisResponse.arrayBuffer();
        const wavFilePath = path.join(outputDir, wavFilename);
        const targetFilePath = path.join(outputDir, targetFilename);

        fs.writeFileSync(wavFilePath, Buffer.from(audioBuffer));
        console.log(`WAV保存完了: ${wavFilename}`);

        // ffmpegで変換
        try {
            console.log(`ffmpegで ${TARGET_FORMAT} へ変換開始: ${wavFilename} -> ${targetFilename}`);
            const ffmpegCommand = `"${ffmpegPath}" -i "${wavFilePath}" -y -vn -ar 44100 -ac 1 -b:a ${FFMPEG_BITRATE} "${targetFilePath}"`;
            execSync(ffmpegCommand, { stdio: 'pipe' }); // stdio: 'pipe' でffmpegの出力を抑制
            console.log(`${TARGET_FORMAT}変換完了: ${targetFilename}`);
            fs.unlinkSync(wavFilePath); // 元のWAVファイルを削除
            console.log(`WAV削除完了: ${wavFilename}`);
        } catch (ffmpegError) {
            console.error(`ffmpeg変換エラー (${wavFilename}):`, ffmpegError.stderr ? ffmpegError.stderr.toString() : ffmpegError.message);
            // WAVファイルは残しておくか、エラー処理の方針による
        }

    } catch (error) {
        console.error(`"${text}" の音声処理中に予期せぬエラー:`, error);
    }
}

/**
 * 指定された設定で音声ファイルを生成するメイン関数
 */
async function generateAllAudioFiles(voiceId, speakerId, pitch, speed, ticketStart, ticketEnd) {
    console.log("音声ファイルの事前生成を開始します...");
    console.log(`保存先ディレクトリ: ${OUTPUT_BASE_DIR}/${voiceId}`);
    console.log(`音声設定: voiceId=${voiceId}, speakerId=${speakerId}, pitch=${pitch}, speed=${speed}`);
    console.log(`整理券番号の生成範囲: ${ticketStart} から ${ticketEnd}`);

    // 保存先ディレクトリを作成
    const outputDir = path.join(OUTPUT_BASE_DIR, voiceId);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`ディレクトリを作成しました: ${outputDir}`);
    }

    // 「呼び出し番号 X番のかた」 (指定範囲)
    for (let i = ticketStart; i <= ticketEnd; i++) {
        const baseTicketFilename = `ticket_${i}`;
        const targetTicketFilename = `${baseTicketFilename}.${TARGET_FORMAT}`;
        if (fs.existsSync(path.join(outputDir, targetTicketFilename))) {
            console.log(`スキップ (既存): ${voiceId}/${targetTicketFilename}`);
            continue;
        }
        await fetchAndSaveAudio(
            `呼び出し番号 ${i}番のかた`,
            baseTicketFilename,
            speakerId,
            pitch,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // APIへの負荷軽減
    }

    // 「Y番診察室へお越しください。」 (1から7まで)
    for (let i = 1; i <= 7; i++) {
        const baseRoomFilename = `room_${i}`;
        const targetRoomFilename = `${baseRoomFilename}.${TARGET_FORMAT}`;
        if (fs.existsSync(path.join(outputDir, targetRoomFilename))) {
            console.log(`スキップ (既存): ${voiceId}/${targetRoomFilename}`);
            continue;
        }
        await fetchAndSaveAudio(
            `${i}番診察室へお越しください。`,
            baseRoomFilename,
            speakerId,
            pitch,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // APIへの負荷軽減
    }

    // 「受付にお越しください。」
    const baseReceptionFilename = `room_reception`;
    const targetReceptionFilename = `${baseReceptionFilename}.${TARGET_FORMAT}`;
    if (!fs.existsSync(path.join(outputDir, targetReceptionFilename))) {
        await fetchAndSaveAudio(
            `受付にお越しください。`,
            baseReceptionFilename,
            speakerId,
            pitch,
            speed,
            outputDir
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // APIへの負荷軽減
    } else {
        console.log(`スキップ (既存): ${voiceId}/${targetReceptionFilename}`);
    }

    console.log(`音声ファイルの生成が完了しました: ${voiceId}`);
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
    let voiceId = 'voice1';
    let speakerId = 1;
    let pitch = 0.0;
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
            case '--speaker-id':
                if (i + 1 < args.length) {
                    const value = parseInt(args[++i], 10);
                    if (!isNaN(value) && value >= 0) {
                        speakerId = value;
                    } else {
                        console.error('エラー: --speaker-id には0以上の整数を指定してください');
                        process.exit(1);
                    }
                } else {
                    console.error('エラー: --speaker-id には値が必要です');
                    process.exit(1);
                }
                break;
            case '--pitch':
                if (i + 1 < args.length) {
                    const value = parseFloat(args[++i]);
                    if (!isNaN(value) && value >= -0.15 && value <= 0.15) {
                        pitch = value;
                    } else {
                        console.error('エラー: --pitch には-0.15から0.15の範囲の値を指定してください');
                        process.exit(1);
                    }
                } else {
                    console.error('エラー: --pitch には値が必要です');
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

    return { voiceId, speakerId, pitch, speed, ticketStart, ticketEnd };
}

// スクリプト実行（非同期対応）
async function main() {
    try {
        const config = await parseArguments();
        await generateAllAudioFiles(
            config.voiceId,
            config.speakerId,
            config.pitch,
            config.speed,
            config.ticketStart,
            config.ticketEnd
        );
    } catch (err) {
        console.error("音声生成スクリプト全体でエラーが発生しました:", err);
        process.exit(1);
    }
}

// メイン関数を実行
main();
