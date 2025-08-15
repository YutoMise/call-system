// /home/m41/call-system/scripts/generate-audio.js
const fs = require('node:fs');
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') }); // .envファイルを読み込む
const { execSync } = require('node:child_process'); // ffmpeg実行のため追加
const path = require('node:path');
// node-fetchのv3以降はESMのみサポートのため、package.jsonに "type": "module" を追加するか、
// CommonJSで使えるv2系 (npm install node-fetch@2) をインストールしてください。
// 以下は node-fetch v2 を想定した書き方です。
const ffmpegPath = require('ffmpeg-static');
const fetch = require('node-fetch');

const VOICEVOX_API_URL = 'http://localhost:50021'; // .env またはデフォルト
const OUTPUT_DIR = path.join(__dirname, '../public/audio/pregenerated2');
const TARGET_FORMAT = 'mp3'; // 'mp3' または 'opus'
const FFMPEG_BITRATE = '96k'; // ファイルサイズを考慮して少し下げる (例: 96k)

// .env から設定を読み込む (デフォルト値も設定)
const DEFAULT_SPEAKER_ID = parseInt(process.env.DEFAULT_VOICEVOX_SPEAKER_ID, 10) || 1;
const DEFAULT_PITCH = parseFloat(process.env.DEFAULT_VOICEVOX_PITCH) || 0.0;
const DEFAULT_SPEED = parseFloat(process.env.DEFAULT_VOICEVOX_SPEED) || 1.0;

// 保存先ディレクトリが存在しない場合は作成
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Voicevox APIを使用して音声データを取得し、ファイルに保存する関数
 * @param {string} text 読み上げるテキスト
 * @param {string} baseFilename 保存するファイル名のベース (例: ticket_1).
 * @param {number} speakerId スピーカーID.
 * @param {number} pitch ピッチ.
 * @param {number} speed スピード.
 */
async function fetchAndSaveAudio(text, baseFilename, speakerId, pitch, speed) {
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
        const wavFilePath = path.join(OUTPUT_DIR, wavFilename);
        const targetFilePath = path.join(OUTPUT_DIR, targetFilename);

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
 * 指定された範囲の音声ファイルをすべて生成するメイン関数
 */
async function generateAllAudioFiles(ticketStart, ticketEnd) {
    console.log("音声ファイルの事前生成を開始します...");
    console.log(`保存先ディレクトリ: ${OUTPUT_DIR}`);
    console.log(`使用する設定: SpeakerID=${DEFAULT_SPEAKER_ID}, Pitch=${DEFAULT_PITCH}, Speed=${DEFAULT_SPEED}`);
    console.log(`整理券番号の生成範囲: ${ticketStart} から ${ticketEnd}`);

    // 「呼び出し番号 X番のかた」 (1から1000まで)
    for (let i = ticketStart; i <= ticketEnd; i++) {
        // 途中で止まっても再開しやすいように、既にファイルが存在する場合はスキップ
        const baseTicketFilename = `ticket_${i}`;
        const targetTicketFilename = `${baseTicketFilename}.${TARGET_FORMAT}`;
        if (fs.existsSync(path.join(OUTPUT_DIR, targetTicketFilename))) {
            console.log(`スキップ (既存): ${targetTicketFilename}`);
            continue;
        }
        await fetchAndSaveAudio(
            `呼び出し番号 ${i}番のかた`,
            baseTicketFilename,
            DEFAULT_SPEAKER_ID,
            DEFAULT_PITCH,
            DEFAULT_SPEED
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // APIへの負荷軽減のため少し待機
    }

    // 「Y番診察室へお越しください。」 (1から7まで)
    // こちらは範囲指定の対象外とするか、別途引数を設けるかですが、今回は固定とします。
    for (let i = 1; i <= 7; i++) {
        const baseRoomFilename = `room_${i}`;
        const targetRoomFilename = `${baseRoomFilename}.${TARGET_FORMAT}`;
        if (fs.existsSync(path.join(OUTPUT_DIR, targetRoomFilename))) {
            console.log(`スキップ (既存): ${targetRoomFilename}`);
            continue;
        }
        await fetchAndSaveAudio(
            `${i}番診察室へお越しください。`,
            baseRoomFilename,
            DEFAULT_SPEAKER_ID,
            DEFAULT_PITCH,
            DEFAULT_SPEED
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // APIへの負荷軽減
    }

    console.log("すべての音声ファイルの事前生成が完了しました。");
}

// コマンドライン引数から整理券番号の範囲を取得
let ticketGenerationStart = 1;
let ticketGenerationEnd = 1000; // デフォルトの範囲

if (process.argv.length >= 3) { // 第1引数 (開始番号)
    const startArg = parseInt(process.argv[2], 10);
    if (!isNaN(startArg) && startArg > 0) {
        ticketGenerationStart = startArg;
    } else {
        console.warn(`無効な開始番号: "${process.argv[2]}"。デフォルトの ${ticketGenerationStart} を使用します。`);
    }
}
if (process.argv.length >= 4) { // 第2引数 (終了番号)
    const endArg = parseInt(process.argv[3], 10);
    if (!isNaN(endArg) && endArg >= ticketGenerationStart) {
        ticketGenerationEnd = endArg;
    } else {
        console.warn(`無効な終了番号: "${process.argv[3]}"。${ticketGenerationStart} 以上の値を指定してください。デフォルトの ${Math.max(ticketGenerationEnd, ticketGenerationStart)} を使用します。`);
        ticketGenerationEnd = Math.max(ticketGenerationEnd, ticketGenerationStart); // 開始番号より小さくならないように調整
    }
}

// スクリプト実行
generateAllAudioFiles(ticketGenerationStart, ticketGenerationEnd).catch(err => {
    console.error("音声生成スクリプト全体でエラーが発生しました:", err);
});
