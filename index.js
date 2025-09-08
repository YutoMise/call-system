const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
require('date-utils');
require('dotenv').config();

// ログ管理システムをインポート
const { logger, readLogs, getLogStats } = require('./utils/logManager');



const app = express();
const PORT = process.env.PORT || 3002;
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
        await logger.channel('load', 'システム', {
            channelCount: channels.length,
            channelNames: channels.map(c => c.name)
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            await logger.system('channels.jsonが見つかりません。空のリストで開始します。');
            channels = [];
            await saveChannels();
        } else {
            await logger.error('チャンネルデータの読み込みに失敗', error);
            channels = [];
        }
    }
}
async function saveChannels() {
    try {
        const data = JSON.stringify(channels, null, 2);
        await fs.writeFile(CHANNELS_FILE, data, 'utf8');
        await logger.channel('save', 'システム', { channelCount: channels.length });
    } catch (error) {
        await logger.error('チャンネルデータの保存に失敗', error);
    }
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

// 音声テンプレート設定API
app.get('/api/voice-templates', async (req, res) => {
    try {
        const templatesPath = path.join(__dirname, 'config/voice-templates.json');
        
        if (!await fs.access(templatesPath).then(() => true).catch(() => false)) {
            // フォールバック用のデフォルトテンプレート
            const defaultTemplates = {
                japanese: {
                    ticketTemplate: "呼び出し番号 {number}番のかた",
                    roomTemplate: "{number}番診察室へお越しください。",
                    receptionTemplate: "受付にお越しください。",
                    description: "日本語音声のテンプレート設定（デフォルト）"
                },
                english: {
                    ticketTemplate: "Patient number {number}",
                    roomTemplate: "Please come to room {number}",
                    receptionTemplate: "Please come to the reception desk",
                    description: "English voice template settings (default)"
                }
            };
            return res.json(defaultTemplates);
        }
        
        const data = await fs.readFile(templatesPath, 'utf8');
        const templates = JSON.parse(data);
        res.json(templates);
    } catch (error) {
        console.error('音声テンプレート設定の読み込みに失敗:', error);
        res.status(500).json({ error: 'Failed to load voice templates' });
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
    const { channelName, password, ticketNumber, roomNumber, language = 'japanese' } = req.body;
    const channel = channels.find(c => c.name === channelName);

    if (!channel) {
        return res.status(404).json({ message: `チャンネル「${channelName}」が見つかりません。` });
    }

    const isPasswordValid = await comparePassword(password, channel.password);

    if (isPasswordValid) {
        if (channelName && ticketNumber && roomNumber) {
            // 言語に応じた音声設定を取得
            let voiceConfig = null;
            if (channel.voiceConfig && channel.voiceConfig[language]) {
                voiceConfig = channel.voiceConfig[language];
            } else {
                // フォールバック: 古い形式のvoiceIdを使用
                voiceConfig = {
                    type: 'voicevox',
                    voiceId: channel.voiceId || 'voice1',
                    speakerId: 1
                };
            }
            
            const announcementData = { 
                ticketNumber, 
                roomNumber, 
                language,
                voiceConfig 
            };
            const clientCount = activeClients[channelName] ? activeClients[channelName].length : 0;
            sendEventToChannel(channelName, 'play-announcement', announcementData);

            await logger.announcement(channelName, ticketNumber, roomNumber, clientCount, { language, voiceType: voiceConfig.type });
            res.json({ message: `アナウンスを送信しました（${language === 'japanese' ? '日本語' : '英語'}）。` });
        } else {
             res.status(400).json({ message: 'アナウンス情報が不足しています。' });
        }
    } else {
        await logger.authentication(false, channelName, 'パスワード認証失敗');
        res.status(401).json({ message: 'パスワードが違います。' });
    }
});


// --- Server-Sent Events (SSE) Endpoint ---
app.get('/events', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = req.session.id;
    const subscribedChannel = req.session.subscribedChannel;

    if (!subscribedChannel) {
        await logger.connection('reject', clientId, 'なし', 0);
        res.write('event: error\ndata: {"message": "チャンネルに接続されていません。再接続してください。"}\n\n');
        res.end();
        return;
    }

    if (!activeClients[subscribedChannel]) {
        activeClients[subscribedChannel] = [];
    }
    const newClient = { clientId, res };
    activeClients[subscribedChannel].push(newClient);
    await logger.connection('connect', clientId, subscribedChannel, activeClients[subscribedChannel].length);

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

// ログ表示ページ
app.get('/admin/logs', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-logs.html'));
});

// チャンネル詳細情報取得（一般ユーザー用）- パスワードを除く
app.get('/api/channel-details', (req, res) => {
    const channelDetails = channels.map(channel => ({
        name: channel.name,
        voiceId: channel.voiceId || 'voice1', // デフォルト値を設定
        roomCount: channel.roomCount || 7, // デフォルト値を設定
        useReception: channel.useReception !== false // デフォルト値を設定
    }));
    res.json(channelDetails);
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

            // 診察室数のバリデーション
            if (channel.roomCount !== undefined) {
                const roomCount = parseInt(channel.roomCount);
                if (isNaN(roomCount) || roomCount < 1 || roomCount > 10) {
                    return res.status(400).json({ message: '診察室数は1-10の範囲で入力してください。' });
                }
                channel.roomCount = roomCount; // 数値に変換
            }

            // useReceptionのバリデーション
            if (channel.useReception !== undefined && typeof channel.useReception !== 'boolean') {
                return res.status(400).json({ message: '受付使用設定はboolean値である必要があります。' });
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

// 事前生成音声リスト取得API（管理者用）
app.get('/admin/api/pregenerated-voices', requireAdminAuth, async (req, res) => {
    try {
        // public/audio/pregenerated ディレクトリを基準にする
        const baseDir = path.join(__dirname, 'public', 'audio', 'pregenerated');
        
        const readVoicesFrom = async (langDir) => {
            const dirPath = path.join(baseDir, langDir);
            try {
                // ディレクトリの存在チェック
                await fs.access(dirPath);
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                return entries
                    .filter(entry => entry.isDirectory())
                    .map(entry => entry.name)
                    .sort();
            } catch (error) {
                // ディレクトリが存在しない場合は警告をログに出力し、空配列を返す
                if (error.code === 'ENOENT') {
                    await logger.warn(`Directory not found: ${dirPath}`);
                    return [];
                }
                throw error; // その他のエラーは再スロー
            }
        };

        const japaneseVoices = await readVoicesFrom('japanese');
        const englishVoices = await readVoicesFrom('english');

        res.json({
            success: true,
            japanese: japaneseVoices,
            english: englishVoices
        });

    } catch (error) {
        console.error('Error reading pregenerated directory:', error);
        await logger.error('事前生成音声リストの読み込みに失敗', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ success: false, message: 'Failed to get voice list.' });
    }
});

// ログ取得API（管理者用）
app.get('/admin/api/logs', requireAdminAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = await readLogs(limit);
        res.json(logs);
    } catch (error) {
        await logger.error('ログ取得APIエラー', error);
        res.status(500).json({ message: 'ログの取得に失敗しました。' });
    }
});

// ログ統計API（管理者用）
app.get('/admin/api/log-stats', requireAdminAuth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = await getLogStats(days);
        res.json(stats);
    } catch (error) {
        await logger.error('ログ統計APIエラー', error);
        res.status(500).json({ message: 'ログ統計の取得に失敗しました。' });
    }
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


// --- チャンネル管理API ---

// チャンネル設定一覧を取得
app.get('/api/channels-config', async (req, res) => {
    try {
        res.json(channels);
    } catch (error) {
        console.error('チャンネル設定取得エラー:', error);
        res.status(500).json({ error: 'チャンネル設定の取得に失敗しました' });
    }
});

// 個別チャンネル設定を更新
app.put('/api/channels-config/:index', async (req, res) => {
    try {
        const index = parseInt(req.params.index);
        const channelData = req.body;
        
        if (index < 0 || index >= channels.length) {
            return res.status(404).json({ error: '指定されたチャンネルが見つかりません' });
        }
        
        // バリデーション
        if (!channelData.name || !channelData.password) {
            return res.status(400).json({ error: 'チャンネル名とパスワードは必須です' });
        }
        
        // チャンネル設定を更新
        channels[index] = channelData;
        
        // ファイルに保存
        await fs.writeFile(CHANNELS_FILE, JSON.stringify(channels, null, 2));
        await logger.channel('update', channelData.name, { 
            channelIndex: index, 
            roomCount: channelData.roomCount,
            useReception: channelData.useReception,
            voiceConfigUpdated: true
        });
        
        res.json({ message: 'チャンネル設定を更新しました', channel: channelData });
        
    } catch (error) {
        console.error('チャンネル更新エラー:', error);
        res.status(500).json({ error: 'チャンネル設定の更新に失敗しました' });
    }
});

// チャンネルを削除
app.delete('/api/channels-config/:index', async (req, res) => {
    try {
        const index = parseInt(req.params.index);
        
        if (index < 0 || index >= channels.length) {
            return res.status(404).json({ error: '指定されたチャンネルが見つかりません' });
        }
        
        const deletedChannel = channels[index];
        channels.splice(index, 1);
        
        // ファイルに保存
        await fs.writeFile(CHANNELS_FILE, JSON.stringify(channels, null, 2));
        await logger.channel('delete', deletedChannel.name, { channelIndex: index });
        
        res.json({ message: 'チャンネルを削除しました', deletedChannel });
        
    } catch (error) {
        console.error('チャンネル削除エラー:', error);
        res.status(500).json({ error: 'チャンネルの削除に失敗しました' });
    }
});

// チャンネルテスト
app.post('/api/test-channel', async (req, res) => {
    try {
        const { channelName } = req.body;
        const channel = channels.find(c => c.name === channelName);
        
        if (!channel) {
            return res.status(404).json({ error: 'チャンネルが見つかりません' });
        }
        
        // テスト結果を返す
        res.json({ 
            message: 'チャンネルテストが完了しました',
            channel: channelName,
            config: {
                roomCount: channel.roomCount,
                useReception: channel.useReception,
                hasVoiceConfig: !!channel.voiceConfig,
                jaVoiceId: channel.voiceConfig?.japanese?.voiceId,
                enVoiceId: channel.voiceConfig?.english?.voiceId
            }
        });
        
    } catch (error) {
        console.error('チャンネルテストエラー:', error);
        res.status(500).json({ error: 'チャンネルテストに失敗しました' });
    }
});

// --- 音声管理API ---

// Voicevox話者一覧を取得
app.get('/api/voicevox-speakers', async (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'data/voicevox-speakers.json');
        const data = await fs.readFile(dataPath, 'utf8');
        const speakers = JSON.parse(data);
        res.json(speakers);
    } catch (error) {
        // フォールバック: 基本的な話者一覧
        const fallbackSpeakers = [
            { id: 0, name: "四国めたん（ノーマル）" },
            { id: 1, name: "ずんだもん（ノーマル）" },
            { id: 8, name: "春日部つむぎ（ノーマル）" },
            { id: 14, name: "冥鳴ひまり（ノーマル）" }
        ];
        res.json(fallbackSpeakers);
    }
});

// Kokoro音声一覧を取得
app.get('/api/kokoro-voices', async (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'data/kokoro-voices.json');
        const data = await fs.readFile(dataPath, 'utf8');
        const voices = JSON.parse(data);
        res.json(voices);
    } catch (error) {
        // フォールバック: 基本的な音声一覧
        const fallbackVoices = [
            { id: 'af_bella', name: 'Bella (Female, American)' },
            { id: 'af_sarah', name: 'Sarah (Female, American)' },
            { id: 'am_adam', name: 'Adam (Male, American)' },
            { id: 'bf_emma', name: 'Emma (Female, British)' }
        ];
        res.json(fallbackVoices);
    }
});

// 音声テスト（Voicevox）
app.post('/api/test-voice/voicevox', async (req, res) => {
    const { text, speakerId, pitch = 0.0, speed = 1.0 } = req.body;
    
    try {
        const fetch = require('node-fetch');
        const VOICEVOX_API_URL = process.env.VOICEVOX_URL || 'http://localhost:50021';
        
        // 1. audio_query
        const audioQueryResponse = await fetch(
            `${VOICEVOX_API_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
            { method: 'POST', headers: { 'Accept': 'application/json' } }
        );
        
        if (!audioQueryResponse.ok) {
            throw new Error(`audio_query failed: ${audioQueryResponse.status}`);
        }
        
        const audioQuery = await audioQueryResponse.json();
        audioQuery.pitchScale = pitch;
        audioQuery.speedScale = speed;
        
        // 2. synthesis
        const synthesisResponse = await fetch(
            `${VOICEVOX_API_URL}/synthesis?speaker=${speakerId}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'audio/wav' },
                body: JSON.stringify(audioQuery)
            }
        );
        
        if (!synthesisResponse.ok) {
            throw new Error(`synthesis failed: ${synthesisResponse.status}`);
        }
        
        const audioBuffer = await synthesisResponse.arrayBuffer();
        
        res.setHeader('Content-Type', 'audio/wav');
        res.send(Buffer.from(audioBuffer));
        
    } catch (error) {
        console.error('Voicevox test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 音声テスト（Kokoro）
app.post('/api/test-voice/kokoro', async (req, res) => {
    const { text, voiceId } = req.body;
    
    try {
        const fetch = require('node-fetch');
        const KOKORO_TTS_URL = process.env.KOKORO_TTS_URL || 'http://kokoro_tts:8880';
        
        const response = await fetch(`${KOKORO_TTS_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice: voiceId })
        });
        
        if (!response.ok) {
            throw new Error(`Kokoro TTS failed: ${response.status}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        res.setHeader('Content-Type', 'audio/wav');
        res.send(Buffer.from(audioBuffer));
        
    } catch (error) {
        console.error('Kokoro test error:', error);
        res.status(500).json({ error: error.message });
    }
});


async function startServer() {
    try {
        app.listen(PORT, async () => {
            await logger.system(`サーバー起動完了 Port: ${PORT}`, {
                port: PORT,
                urls: {
                    main: `http://localhost:${PORT}`,
                    receiver: `http://localhost:${PORT}/receiver`,
                    admin: `http://localhost:${PORT}/admin/channel/edit`
                }
            });
        });
    } catch (error) {
        await logger.error("サーバーの起動に失敗しました", error);
        process.exit(1); // エラーで終了
    }
}
startServer();