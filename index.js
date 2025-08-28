const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
require('date-utils');
require('dotenv').config();



const app = express();
const PORT = 3002;
const CHANNELS_FILE = path.join(__dirname, 'channels.json');

let channels = [];
let activeClients = {};
function getCurrentTimestampIntl() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',    // 年 (例: 2025)
        month: '2-digit',   // 月 (例: 04)
        day: '2-digit',     // 日 (例: 16)
        hour: '2-digit',    // 時 (例: 10) - hourCycleで24時間制を指定
        minute: '2-digit',  // 分 (例: 40)
        second: '2-digit',  // 秒 (例: 59)
        hourCycle: 'h23',   // 24時間表記 (00-23) を強制
        timeZone: 'Asia/Tokyo' // タイムゾーンを指定 (サーバー環境に依存しないように)
    });

    const parts = formatter.formatToParts(now);
    const partsMap = {};
    parts.forEach(({ type, value }) => {
        partsMap[type] = value;
    });
    const timestamp = `${partsMap.year}/${partsMap.month}/${partsMap.day} ${partsMap.hour}:${partsMap.minute}:${partsMap.second}`;


    return timestamp;
}

async function loadChannels() {
    try {
        await fs.access(CHANNELS_FILE);
        const data = await fs.readFile(CHANNELS_FILE, 'utf8');
        channels = JSON.parse(data);
        console.log(`${getCurrentTimestampIntl()}: チャンネルデータを読み込みました:`, channels.map(c => c.name));
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`${getCurrentTimestampIntl()}: channels.jsonが見つかりません。空のリストで開始します。`);
            channels = []; await saveChannels();
        } else {
            console.error(`${getCurrentTimestampIntl()}: チャンネルデータの読み込みに失敗:`, error); channels = [];
        }
    }
}
async function saveChannels() {
    try {
        const data = JSON.stringify(channels, null, 2);
        await fs.writeFile(CHANNELS_FILE, data, 'utf8');
        console.log(`${getCurrentTimestampIntl()}: チャンネルデータを保存しました。`);
    } catch (error) { console.error(`${getCurrentTimestampIntl()}: チャンネルデータの保存に失敗:`, error); }
}
async function comparePassword(plainPassword, storedPassword) {
    return plainPassword === storedPassword;
}

// 管理者認証ミドルウェア
function requireAdminAuth(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ message: '管理者認証が必要です。' });
}
loadChannels();

// Middleware
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// JSONボディパーサー
app.use(express.json());

// 静的ファイル提供
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// スピーカー性別更新API
app.post('/api/update-speaker-gender', async (req, res) => {
    try {
        const { speakerId, gender } = req.body;

        if (speakerId === undefined || speakerId === null || !gender || !['male', 'female', 'unknown'].includes(gender)) {
            return res.status(400).json({ error: '無効なパラメータです' });
        }

        const speakersFilePath = path.join(__dirname, 'data/voicevox-speakers.json');

        // 現在のスピーカーデータを読み込み
        let speakers = [];
        try {
            const data = await fs.readFile(speakersFilePath, 'utf8');
            speakers = JSON.parse(data);
        } catch (error) {
            console.error('スピーカーファイルの読み込みエラー:', error);
            return res.status(500).json({ error: 'スピーカーファイルの読み込みに失敗しました' });
        }

        // 該当スピーカーを検索して性別を更新
        const speaker = speakers.find(s => s.id === parseInt(speakerId));
        if (!speaker) {
            return res.status(404).json({ error: 'スピーカーが見つかりません' });
        }

        speaker.gender = gender;

        // ファイルに書き戻し
        try {
            await fs.writeFile(speakersFilePath, JSON.stringify(speakers, null, 2), 'utf8');
            console.log(`Speaker ${speakerId} の性別を ${gender} に更新しました`);
            res.json({ success: true, speakerId, gender });
        } catch (error) {
            console.error('スピーカーファイルの書き込みエラー:', error);
            res.status(500).json({ error: 'スピーカーファイルの更新に失敗しました' });
        }

    } catch (error) {
        console.error('性別更新エラー:', error);
        res.status(500).json({ error: '内部サーバーエラー' });
    }
});

// サンプル音声一覧API
app.get('/api/samples', async (req, res) => {
    try {
        const samplesDir = path.join(__dirname, 'public/audio/samples');

        if (!await fs.access(samplesDir).then(() => true).catch(() => false)) {
            return res.json({ japanese: [], english: [] });
        }

        const result = {
            japanese: [],
            english: []
        };

        // 日本語サンプル（VOICEVOX）を取得
        const japaneseDir = path.join(samplesDir, 'japanese');
        if (await fs.access(japaneseDir).then(() => true).catch(() => false)) {
            const japaneseItems = await fs.readdir(japaneseDir);
            const speakerDirs = japaneseItems.filter(item => {
                const fullPath = path.join(japaneseDir, item);
                return fs.statSync(fullPath).isDirectory() && item.startsWith('speaker_');
            });

            // 話者一覧を読み込み（名前取得用）
            let speakers = [];
            try {
                const speakersFile = path.join(__dirname, 'data/voicevox-speakers.json');
                const speakersData = await fs.readFile(speakersFile, 'utf8');
                speakers = JSON.parse(speakersData);
            } catch (error) {
                console.warn('話者一覧の読み込みに失敗しました:', error.message);
            }

            for (const speakerDir of speakerDirs) {
                const speakerId = parseInt(speakerDir.replace('speaker_', ''));
                const speakerPath = path.join(japaneseDir, speakerDir);

                // sample_call.wav または sample_call.mp3 を探す
                const audioFiles = ['sample_call.mp3', 'sample_call.wav'];
                let audioFile = null;

                for (const file of audioFiles) {
                    if (await fs.access(path.join(speakerPath, file)).then(() => true).catch(() => false)) {
                        audioFile = file;
                        break;
                    }
                }

                if (audioFile) {
                    const speaker = speakers.find(s => s.id === speakerId);
                    const speakerName = speaker ? speaker.name : `Speaker ${speakerId}`;

                    result.japanese.push({
                        speakerId: speakerId,
                        speakerName: speakerName,
                        audioUrl: `/audio/samples/japanese/${speakerDir}/${audioFile}`,
                        type: 'voicevox'
                    });
                }
            }
        }

        // 英語サンプル（Kokoro TTS）を取得
        const englishDir = path.join(samplesDir, 'english');
        if (await fs.access(englishDir).then(() => true).catch(() => false)) {
            const englishItems = await fs.readdir(englishDir);
            const voiceDirs = englishItems.filter(item => {
                const fullPath = path.join(englishDir, item);
                return fs.statSync(fullPath).isDirectory();
            });

            // Kokoro音声一覧を読み込み（名前取得用）
            let kokoroVoices = [];
            try {
                const kokoroVoicesFile = path.join(__dirname, 'data/kokoro-voices.json');
                const kokoroVoicesData = await fs.readFile(kokoroVoicesFile, 'utf8');
                kokoroVoices = JSON.parse(kokoroVoicesData);
            } catch (error) {
                console.warn('Kokoro音声一覧の読み込みに失敗しました:', error.message);
            }

            for (const voiceDir of voiceDirs) {
                const voicePath = path.join(englishDir, voiceDir);

                // sample_call.wav または sample_call.mp3 を探す
                const audioFiles = ['sample_call.mp3', 'sample_call.wav'];
                let audioFile = null;

                for (const file of audioFiles) {
                    if (await fs.access(path.join(voicePath, file)).then(() => true).catch(() => false)) {
                        audioFile = file;
                        break;
                    }
                }

                if (audioFile) {
                    const voice = kokoroVoices.find(v => v.id === voiceDir);
                    const voiceName = voice ? voice.name : voiceDir.charAt(0).toUpperCase() + voiceDir.slice(1).replace(/_/g, ' ');

                    result.english.push({
                        voiceId: voiceDir,
                        voiceName: voiceName,
                        audioUrl: `/audio/samples/english/${voiceDir}/${audioFile}`,
                        type: 'kokoro'
                    });
                }
            }
        }

        // ソート
        result.japanese.sort((a, b) => a.speakerId - b.speakerId);
        result.english.sort((a, b) => a.voiceName.localeCompare(b.voiceName));

        res.json(result);

    } catch (error) {
        console.error('サンプル一覧取得エラー:', error);
        res.status(500).json({ error: 'サンプル一覧の取得に失敗しました' });
    }
});

// --- API Endpoints ---
// GET /api/channels - チャンネルリスト取得
app.get('/api/channels', (req, res) => {
    const channelNames = channels.map(c => c.name);
    res.json(channelNames);
});

// POST /api/channels - チャンネル作成
app.post('/api/channels', async (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
        return res.status(400).json({ message: 'チャンネル名とパスワードは必須です。' });
    }
    if (channels.some(c => c.name === name)) {
        return res.status(409).json({ message: `チャンネル名「${name}」は既に使用されています。` });
    }

    const newChannel = { name, password };
    channels.push(newChannel);
    await saveChannels();
    console.log(`新しいチャンネル作成: ${name}`);
    res.status(201).json({ message: `チャンネル「${name}」を作成しました。`});
});

// POST /api/subscribe
app.post('/api/subscribe', async (req, res) => {
    const { channelName, password } = req.body;
    const channel = channels.find(c => c.name === channelName);

    if (!channel) {
        return res.status(404).json({ message: `チャンネル「${channelName}」が見つかりません。` });
    }

    const isPasswordValid = await comparePassword(password, channel.password);

    if (isPasswordValid) {
        req.session.subscribedChannel = channelName;
        console.log(`${getCurrentTimestampIntl()}: クライアント ${req.session.id} がチャンネル「${channelName}」接続開始`);
        res.json({ message: `チャンネル「${channelName}」の接続に成功しました。` });
    } else {
        delete req.session.subscribedChannel;
        console.log(`${getCurrentTimestampIntl()}: クライアント ${req.session.id} がチャンネル「${channelName}」のパスワード認証失敗`);
        res.status(401).json({ message: 'パスワードが違います。' });
    }
});

// POST /api/unsubscribe
app.post('/api/unsubscribe', (req, res) => {
    if (req.session.subscribedChannel) {
        const channel = req.session.subscribedChannel;
        delete req.session.subscribedChannel;
        console.log(`${getCurrentTimestampIntl()}: クライアント ${req.session.id} がチャンネル「${channel}」接続を解除`);
        res.json({ message: 'チャンネルへの接続を解除しました。' });
    } else {
        res.status(400).json({ message: '接続中のチャンネルはありません。' });
    }
});

// POST /api/announce
app.post('/api/announce', async (req, res) => {
    const { channelName, password, ticketNumber, roomNumber } = req.body;
    const channel = channels.find(c => c.name === channelName);

    if (!channel) {
        return res.status(404).json({ message: `チャンネル「${channelName}」が見つかりません。` });
    }

    const isPasswordValid = await comparePassword(password, channel.password);

    if (isPasswordValid) {
        if (channelName && ticketNumber && roomNumber) {
            const announcementData = { ticketNumber, roomNumber };
            sendEventToChannel(channelName, 'play-announcement', announcementData);

            console.log(`${getCurrentTimestampIntl()}: アナウンス送信 -> チャンネル「${channelName}」: 整理券 ${ticketNumber}, 診察室 ${roomNumber}`);
            res.json({ message: 'アナウンスを送信しました。' });
        } else {
             res.status(400).json({ message: 'アナウンス情報が不足しています。' });
        }
    } else {
        console.log(`${getCurrentTimestampIntl()}: アナウンス送信時にチャンネル「${channelName}」のパスワード認証失敗 (送信元不明)`);
        res.status(401).json({ message: 'パスワードが違います。' });
    }
});


// --- Server-Sent Events (SSE) Endpoint ---
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = req.session.id;
    const subscribedChannel = req.session.subscribedChannel;

    if (!subscribedChannel) {
        console.log(`${getCurrentTimestampIntl()}: クライアント ${clientId} はチャンネル未接続のため接続を拒否`);
        res.write('event: error\ndata: {"message": "チャンネルに接続されていません。再接続してください。"}\n\n');
        res.end();
        return;
    }

    if (!activeClients[subscribedChannel]) {
        activeClients[subscribedChannel] = [];
    }
    const newClient = { clientId, res };
    activeClients[subscribedChannel].push(newClient);
    console.log(`${getCurrentTimestampIntl()}: クライアント ${clientId} が接続開始 (チャンネル: ${subscribedChannel})。現在 ${activeClients[subscribedChannel].length} クライアント。`);

    // 接続成功をクライアントに通知
    sendEvent(res, 'connected', { message: `チャンネル「${subscribedChannel}」への接続完了` });

    // 接続維持
    const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    // クライアント切断時の処理
    req.on('close', () => {
        clearInterval(heartbeatInterval);
        if (activeClients[subscribedChannel]) {
            activeClients[subscribedChannel] = activeClients[subscribedChannel].filter(client => client.clientId !== clientId);
             console.log(`${getCurrentTimestampIntl()}: クライアント ${clientId} が接続終了 (チャンネル: ${subscribedChannel})。残り ${activeClients[subscribedChannel].length} クライアント。`);
            if (activeClients[subscribedChannel].length === 0) {
                delete activeClients[subscribedChannel];
            }
        }
    });
});



// --- 管理者ページルート ---
// 管理者ログイン
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';

    if (username === adminUsername && password === adminPassword) {
        req.session.isAdmin = true;
        res.json({ success: true, message: 'ログインに成功しました。' });
    } else {
        res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが間違っています。' });
    }
});

// 管理者ログアウト
app.post('/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    res.json({ success: true, message: 'ログアウトしました。' });
});

// 管理者ページ表示
app.get('/admin/channel/edit', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// チャンネル情報取得（管理者用）
app.get('/admin/api/channels', requireAdminAuth, (req, res) => {
    res.json(channels);
});

// チャンネル情報更新（管理者用）
app.post('/admin/api/channels', requireAdminAuth, async (req, res) => {
    try {
        const newChannels = req.body;
        if (!Array.isArray(newChannels)) {
            return res.status(400).json({ message: 'チャンネルデータは配列である必要があります。' });
        }

        // バリデーション
        for (const channel of newChannels) {
            if (!channel.name || !channel.password) {
                return res.status(400).json({ message: 'すべてのチャンネルにnameとpasswordが必要です。' });
            }
        }

        channels.length = 0; // 配列をクリア
        channels.push(...newChannels); // 新しいデータを追加
        await saveChannels();

        console.log(`${getCurrentTimestampIntl()}: 管理者によりチャンネルデータが更新されました。`);
        res.json({ success: true, message: 'チャンネルデータを更新しました。' });
    } catch (error) {
        console.error(`${getCurrentTimestampIntl()}: チャンネルデータの更新に失敗:`, error);
        res.status(500).json({ message: 'サーバーエラーが発生しました。' });
    }
});

// 管理者認証状態確認
app.get('/admin/api/auth-status', (req, res) => {
    res.json({ isAuthenticated: !!req.session.isAdmin });
});


// --- Helper Functions for SSE ---
function sendEvent(res, eventName, data) {
    const jsonData = JSON.stringify(data);
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${jsonData}\n\n`);
}

function sendEventToChannel(channelName, eventName, data) {
    if (activeClients[channelName]) {
        const jsonData = JSON.stringify(data);
        const message = `event: ${eventName}\ndata: ${jsonData}\n\n`;
        console.log(`${getCurrentTimestampIntl()}: チャンネル「${channelName}」の ${activeClients[channelName].length} クライアントに送信: ${eventName}`);
        activeClients[channelName].forEach(client => {
            client.res.write(message);
        });
    } else {
        console.log(`${getCurrentTimestampIntl()}: イベント送信試行: チャンネル「${channelName}」にアクティブなクライアントがいません。`);
    }
}


// --- 静的HTMLルート ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/receiver', (req, res) => res.sendFile(path.join(__dirname, 'public', 'receiver.html')));


async function startServer() {
    try {
        app.listen(PORT, () => {
            console.log(`${getCurrentTimestampIntl()}: サーバー起動完了 Port: ${PORT}`);
            console.log(`${getCurrentTimestampIntl()}: 操作用ページ: http://localhost:${PORT}`);
            console.log(`${getCurrentTimestampIntl()}: 音声再生用ページ: http://localhost:${PORT}/receiver`);
            console.log(`${getCurrentTimestampIntl()}: 管理者ページ: http://localhost:${PORT}/admin/channel/edit`);
        });
    } catch (error) {
        console.error("サーバーの起動に失敗しました:", error);
        process.exit(1); // エラーで終了
    }
}
startServer();