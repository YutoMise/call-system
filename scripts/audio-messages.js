/**
 * 音声生成スクリプト用の多言語メッセージ設定
 * 
 * 各言語の音声メッセージテンプレートを定義します。
 * {number} プレースホルダーは実際の番号に置き換えられます。
 */

const AUDIO_MESSAGES = {
    // 日本語メッセージ
    japanese: {
        // 整理券番号の呼び出し
        ticket: '呼び出し番号 {number}番のかた',
        // 診察室への案内
        room: '{number}番診察室へお越しください。',
        // 受付への案内
        reception: '受付にお越しください。'
    },

    // 英語メッセージ
    english: {
        // 整理券番号の呼び出し
        ticket: 'Patient number {number},',
        // 診察室への案内
        room: 'please come to examination room {number}.',
        // 受付への案内
        reception: 'please come to the reception desk.'
    },

    // 中国語メッセージ
    chinese: {
        // 整理券番号の呼び出し
        ticket: '{number}號的病人，',
        // 診察室への案内
        room: '請前往{number}號診療室。',
        // 受付への案内
        reception: '請到掛號處。'
    }
};

/**
 * 指定された言語とメッセージタイプに対応するテキストを取得
 * @param {string} language - 言語 ('japanese', 'english', 'chinese')
 * @param {string} messageType - メッセージタイプ ('ticket', 'room', 'reception')
 * @param {number} number - 番号（ticketとroomの場合に使用）
 * @returns {string} 生成されたメッセージテキスト
 */
function getMessage(language, messageType, number = null) {
    if (!AUDIO_MESSAGES[language]) {
        throw new Error(`サポートされていない言語です: ${language}`);
    }

    if (!AUDIO_MESSAGES[language][messageType]) {
        throw new Error(`サポートされていないメッセージタイプです: ${messageType}`);
    }

    let message = AUDIO_MESSAGES[language][messageType];
    
    // {number} プレースホルダーを実際の番号に置き換え
    if (number !== null) {
        message = message.replace('{number}', number);
    }

    return message;
}

/**
 * 利用可能な言語一覧を取得
 * @returns {string[]} 言語名の配列
 */
function getAvailableLanguages() {
    return Object.keys(AUDIO_MESSAGES);
}

/**
 * 指定された言語で利用可能なメッセージタイプ一覧を取得
 * @param {string} language - 言語名
 * @returns {string[]} メッセージタイプの配列
 */
function getAvailableMessageTypes(language) {
    if (!AUDIO_MESSAGES[language]) {
        throw new Error(`サポートされていない言語です: ${language}`);
    }
    return Object.keys(AUDIO_MESSAGES[language]);
}

module.exports = {
    AUDIO_MESSAGES,
    getMessage,
    getAvailableLanguages,
    getAvailableMessageTypes
};
