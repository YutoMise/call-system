// scripts/update-speakers.js
const fs = require('node:fs');
const path = require('node:path');
const fetch = require('node-fetch');

const VOICEVOX_API_URL = process.env.VOICEVOX_URL || 'http://localhost:50021';
const SPEAKERS_FILE_PATH = path.join(__dirname, '../data/voicevox-speakers.json');

/**
 * Voicevoxエンジンから話者一覧を取得して、ファイルに保存する
 */
async function updateSpeakersFile() {
    try {
        console.log(`Voicevox話者一覧を取得中: ${VOICEVOX_API_URL}/speakers`);
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
        
        // ファイルに保存
        const dataDir = path.dirname(SPEAKERS_FILE_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`ディレクトリを作成しました: ${dataDir}`);
        }
        
        fs.writeFileSync(SPEAKERS_FILE_PATH, JSON.stringify(speakerList, null, 2), 'utf8');
        
        console.log(`話者一覧を更新しました: ${SPEAKERS_FILE_PATH}`);
        console.log(`取得した話者数: ${speakerList.length}件`);
        
        // 最初の5件と最後の5件を表示
        console.log('\n最初の5件:');
        speakerList.slice(0, 5).forEach(s => {
            console.log(`  ${s.id.toString().padStart(3)}: ${s.name}`);
        });
        
        if (speakerList.length > 10) {
            console.log('  ...');
            console.log('\n最後の5件:');
            speakerList.slice(-5).forEach(s => {
                console.log(`  ${s.id.toString().padStart(3)}: ${s.name}`);
            });
        }
        
        return speakerList;
        
    } catch (error) {
        console.error(`話者一覧の更新に失敗しました: ${error.message}`);
        console.error('既存のファイルがそのまま使用されます。');
        throw error;
    }
}

// スクリプトが直接実行された場合
if (require.main === module) {
    updateSpeakersFile().catch(err => {
        console.error('話者一覧更新スクリプトでエラーが発生しました:', err);
        process.exit(1);
    });
}

module.exports = { updateSpeakersFile };
