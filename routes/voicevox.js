// CALL-SYSTEM/routes/voicevox.js
const express = require('express');
const router = express.Router();
const settingsManager = require('../utils/settingsManager');

// --- ルート定義 ---

/** GET /api/voicevox/settings - 現在の設定と話者リストを取得 */
router.get('/settings', (req, res) => {
    const currentSettings = settingsManager.getCurrentSettings(); // speedScaleも含まれる
    const speakers = settingsManager.getAvailableSpeakers();
    res.json({
        currentSpeakerId: currentSettings.speakerId,
        currentPitch: currentSettings.pitch,
        currentSpeedScale: currentSettings.speedScale, // ★ speedScale を追加
        availableSpeakers: speakers
    });
});

/** POST /api/voicevox/settings - 設定を更新・保存 */
router.post('/settings', async (req, res) => {
    const { speakerId, pitch, speedScale } = req.body; // ★ speedScale を受け取る
    const speakers = settingsManager.getAvailableSpeakers();

    // バリデーション
    if ( speakerId === undefined || pitch === undefined || speedScale === undefined || // ★ speedScale をチェック
         isNaN(parseInt(speakerId, 10)) || isNaN(parseFloat(pitch)) || isNaN(parseFloat(speedScale)) // ★ speedScale をチェック
        ) {
        return res.status(400).json({ message: '無効な speakerId, pitch, または speedScale です。' });
    }
    // ★ speedScale の範囲チェックを追加しても良い (例: 0.5 ~ 2.0)
    const speed = parseFloat(speedScale);
    if (speed < 0.5 || speed > 2.0) { // 例としての範囲
         return res.status(400).json({ message: 'speedScale は 0.5 から 2.0 の範囲で指定してください。' });
    }

    // 話者IDのバリデーション
    const isValidSpeaker = speakers.some(speaker =>
        speaker.styles.some(style => style.id === parseInt(speakerId, 10))
    );
    if (!isValidSpeaker && speakers.length > 0) {
        return res.status(400).json({ message: `指定された speakerId (${speakerId}) は利用可能な話者リストに存在しません。` });
    }

    try {
        // ★ saveSettings に speedScale を渡す
        await settingsManager.saveSettings(speakerId, pitch, speed);
        res.json({ message: '設定を更新しました。', currentSettings: settingsManager.getCurrentSettings() });
    } catch (error) {
        console.error("設定の保存中にエラー(API):", error);
        res.status(500).json({ message: '設定の保存中にサーバーエラーが発生しました。' });
    }
});

/** GET /api/voicevox/audio?text=... - テキストから音声データを生成して返す */
router.get('/audio', async (req, res) => {
    // ... (変更なし) ...
    const text = req.query.text;
    if (!text) { /* ... */ }
    try {
        const audioBuffer = await settingsManager.synthesizeSpeechInternal(String(text));
        res.set('Content-Type', 'audio/wav');
        res.send(audioBuffer);
    } catch (error) { /* ... */ }
});

module.exports = router;