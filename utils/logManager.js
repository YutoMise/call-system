const fs = require('fs').promises;
const path = require('path');

// ログディレクトリのパス
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'system.log');

// ログレベル定義
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN', 
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

// ログタイプ定義（Notion連携を考慮した構造化）
const LOG_TYPES = {
    ANNOUNCEMENT: 'ANNOUNCEMENT',      // アナウンス送信
    CONNECTION: 'CONNECTION',          // 接続・切断
    AUTHENTICATION: 'AUTHENTICATION', // 認証関連
    CHANNEL: 'CHANNEL',               // チャンネル管理
    SYSTEM: 'SYSTEM',                 // システム起動・停止
    ERROR: 'ERROR'                    // エラー
};

// 現在の日時を取得（日本時間）
function getCurrentTimestamp() {
    return new Date().toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ログディレクトリを作成
async function ensureLogDirectory() {
    try {
        await fs.access(LOG_DIR);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(LOG_DIR, { recursive: true });
            console.log(`ログディレクトリを作成しました: ${LOG_DIR}`);
        }
    }
}

// 構造化ログエントリを作成
function createLogEntry(level, type, message, metadata = {}) {
    return {
        timestamp: getCurrentTimestamp(),
        level,
        type,
        message,
        metadata,
        id: Date.now() + Math.random().toString(36).substr(2, 9) // 簡易ID生成
    };
}

// ログをファイルに書き込み
async function writeLog(logEntry) {
    try {
        await ensureLogDirectory();
        const logLine = JSON.stringify(logEntry) + '\n';
        await fs.appendFile(LOG_FILE, logLine, 'utf8');
    } catch (error) {
        console.error('ログ書き込みエラー:', error);
    }
}

// 汎用ログ関数
async function log(level, type, message, metadata = {}) {
    const logEntry = createLogEntry(level, type, message, metadata);
    
    // コンソールにも出力（既存の動作を維持）
    const consoleMessage = `${logEntry.timestamp}: ${message}`;
    switch (level) {
        case LOG_LEVELS.ERROR:
            console.error(consoleMessage);
            break;
        case LOG_LEVELS.WARN:
            console.warn(consoleMessage);
            break;
        default:
            console.log(consoleMessage);
    }
    
    // ファイルに書き込み
    await writeLog(logEntry);
}

// 便利関数群
const logger = {
    // アナウンス送信ログ
    announcement: async (channelName, ticketNumber, roomNumber, clientCount = 0) => {
        await log(LOG_LEVELS.INFO, LOG_TYPES.ANNOUNCEMENT, 
            `アナウンス送信 -> チャンネル「${channelName}」: 整理券 ${ticketNumber}, 診察室 ${roomNumber}`,
            { channelName, ticketNumber, roomNumber, clientCount }
        );
    },

    // 接続ログ
    connection: async (action, clientId, channelName, clientCount = 0) => {
        const actionText = action === 'connect' ? '接続開始' : '接続解除';
        await log(LOG_LEVELS.INFO, LOG_TYPES.CONNECTION,
            `クライアント ${clientId} が${actionText} (チャンネル: ${channelName})。現在 ${clientCount} クライアント。`,
            { action, clientId, channelName, clientCount }
        );
    },

    // 認証ログ
    authentication: async (success, channelName, reason = '') => {
        const level = success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN;
        const message = success 
            ? `チャンネル「${channelName}」認証成功`
            : `チャンネル「${channelName}」認証失敗: ${reason}`;
        await log(level, LOG_TYPES.AUTHENTICATION, message,
            { success, channelName, reason }
        );
    },

    // チャンネル管理ログ
    channel: async (action, channelName, details = {}) => {
        const actionText = {
            'create': '作成',
            'update': '更新', 
            'delete': '削除',
            'load': '読み込み',
            'save': '保存'
        }[action] || action;
        
        await log(LOG_LEVELS.INFO, LOG_TYPES.CHANNEL,
            `チャンネル${actionText}: ${channelName}`,
            { action, channelName, ...details }
        );
    },

    // システムログ
    system: async (message, metadata = {}) => {
        await log(LOG_LEVELS.INFO, LOG_TYPES.SYSTEM, message, metadata);
    },

    // エラーログ
    error: async (message, error = null, metadata = {}) => {
        const errorDetails = error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
        } : {};
        
        await log(LOG_LEVELS.ERROR, LOG_TYPES.ERROR, message,
            { ...metadata, error: errorDetails }
        );
    },

    // 汎用ログ
    info: async (message, metadata = {}) => {
        await log(LOG_LEVELS.INFO, LOG_TYPES.SYSTEM, message, metadata);
    },

    warn: async (message, metadata = {}) => {
        await log(LOG_LEVELS.WARN, LOG_TYPES.SYSTEM, message, metadata);
    }
};

// ログファイル読み取り
async function readLogs(limit = 100) {
    try {
        await ensureLogDirectory();
        
        // ファイルが存在しない場合は空配列を返す
        try {
            await fs.access(LOG_FILE);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }

        const data = await fs.readFile(LOG_FILE, 'utf8');
        const lines = data.trim().split('\n').filter(line => line.length > 0);
        
        // 最新のログから指定数を取得
        const recentLines = lines.slice(-limit);
        
        // JSONパース
        const logs = recentLines.map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                // パースエラーの場合は生ログとして扱う
                return {
                    timestamp: getCurrentTimestamp(),
                    level: LOG_LEVELS.INFO,
                    type: LOG_TYPES.SYSTEM,
                    message: line,
                    metadata: {},
                    id: Date.now() + Math.random().toString(36).substr(2, 9)
                };
            }
        });

        // 時系列順（新しい順）でソート
        return logs.reverse();
        
    } catch (error) {
        console.error('ログ読み取りエラー:', error);
        return [];
    }
}

// ログ統計取得（将来の統計機能用）
async function getLogStats(days = 7) {
    try {
        const logs = await readLogs(10000); // 大量取得
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const recentLogs = logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= cutoffDate;
        });

        const stats = {
            total: recentLogs.length,
            byType: {},
            byChannel: {},
            announcements: 0
        };

        recentLogs.forEach(log => {
            // タイプ別統計
            stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
            
            // チャンネル別統計
            if (log.metadata.channelName) {
                stats.byChannel[log.metadata.channelName] = 
                    (stats.byChannel[log.metadata.channelName] || 0) + 1;
            }
            
            // アナウンス数
            if (log.type === LOG_TYPES.ANNOUNCEMENT) {
                stats.announcements++;
            }
        });

        return stats;
    } catch (error) {
        console.error('ログ統計取得エラー:', error);
        return { total: 0, byType: {}, byChannel: {}, announcements: 0 };
    }
}

module.exports = {
    logger,
    readLogs,
    getLogStats,
    LOG_LEVELS,
    LOG_TYPES,
    getCurrentTimestamp
};
