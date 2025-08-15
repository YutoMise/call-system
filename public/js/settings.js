document.addEventListener('DOMContentLoaded', () => {
    const speakerSelect = document.getElementById('speakerSelect');
    const pitchSlider = document.getElementById('pitchSlider');
    const pitchValue = document.getElementById('pitchValue');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const saveButton = document.getElementById('saveButton');
    const saveStatus = document.getElementById('saveStatus');

    let currentSettings = {};
    let availableSpeakers = [];

    // ピッチスライダーの値を表示
    pitchSlider.addEventListener('input', () => {
        pitchValue.textContent = parseFloat(pitchSlider.value).toFixed(2);
    });

    speedSlider.addEventListener('input', () => {
        speedValue.textContent = parseFloat(speedSlider.value).toFixed(2);
    });

    // 話者リストを<select>要素に設定
    function populateSpeakerList() {
        speakerSelect.innerHTML = '<option value="">-- 話者を選択 --</option>';
        if (!availableSpeakers || availableSpeakers.length === 0) {
             speakerSelect.innerHTML = '<option value="">-- 話者リスト取得失敗 --</option>';
             return;
        }
        availableSpeakers.forEach(speaker => {
            speaker.styles.forEach(style => {
                const option = document.createElement('option');
                option.value = style.id;
                option.textContent = `${speaker.name} (${style.name})`;
                speakerSelect.appendChild(option);
            });
        });
        // 現在の設定を選択
        if (currentSettings.currentSpeakerId !== undefined) {
            speakerSelect.value = currentSettings.currentSpeakerId;
             if(!speakerSelect.value && speakerSelect.options.length > 1){ // もしIDが存在しない場合
                 console.warn(`現在の話者ID ${currentSettings.currentSpeakerId} がリストにありません。`);
                 speakerSelect.selectedIndex = 1; // リストの先頭を選択
             }
        } else if (speakerSelect.options.length > 1){
             speakerSelect.selectedIndex = 1; // デフォルトを選択
        }
    }

    // 初期設定値と話者リストをサーバーから取得
    async function loadInitialData() {
        saveStatus.textContent = "設定を読み込み中...";
        saveStatus.style.color = 'black';
        try {
            const response = await fetch('/api/voicevox/settings');
            if (!response.ok) {
                throw new Error(`サーバーエラー: ${response.status}`);
            }
            const data = await response.json();
            currentSettings = {
                currentSpeakerId: data.currentSpeakerId,
                currentPitch: data.currentPitch,
                currentSpeedScale: data.currentSpeedScale
            };
            availableSpeakers = data.availableSpeakers || [];

            // UIに反映
            pitchSlider.value = currentSettings.currentPitch;
            pitchValue.textContent = parseFloat(currentSettings.currentPitch).toFixed(2);
            speedSlider.value = currentSettings.currentSpeedScale;
            speedValue.textContent = parseFloat(currentSettings.currentSpeedScale).toFixed(2);
            populateSpeakerList();

            saveStatus.textContent = "設定を読み込みました。";

        } catch (error) {
            console.error("設定の読み込みに失敗:", error);
            saveStatus.textContent = `設定の読み込みに失敗しました: ${error.message}`;
            saveStatus.style.color = 'red';
            speakerSelect.innerHTML = '<option value="">-- 取得失敗 --</option>';
        }
    }

    // 設定をサーバーに保存
    async function saveSettingsToServer() {
        const selectedSpeakerId = speakerSelect.value;
        const selectedPitch = pitchSlider.value;
        const selectedSpeedScale = speedSlider.value;

        if (!selectedSpeakerId) {
             saveStatus.textContent = "話者を選択してください。";
             saveStatus.style.color = 'red';
             return;
        }

        saveStatus.textContent = "設定を保存中...";
        saveStatus.style.color = 'black';
        saveButton.disabled = true;

        try {
            const response = await fetch('/api/voicevox/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    speakerId: parseInt(selectedSpeakerId, 10),
                    pitch: parseFloat(selectedPitch),
                    speedScale: parseFloat(selectedSpeedScale)
                })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || `サーバーエラー: ${response.status}`);
            }
            saveStatus.textContent = `設定を保存しました！ (話者ID: ${result.currentSettings.speakerId}, ピッチ: ${result.currentSettings.pitch.toFixed(2)})`;
            saveStatus.style.color = 'green';
            // ローカルの currentSettings も更新 (再読み込みしない場合)
            currentSettings.currentSpeakerId = result.currentSettings.speakerId;
            currentSettings.currentPitch = result.currentSettings.pitch;
            currentSettings.speedScale = result.currentSettings.speedScale;

        } catch (error) {
            console.error("設定の保存に失敗:", error);
            saveStatus.textContent = `設定の保存に失敗しました: ${error.message}`;
            saveStatus.style.color = 'red';
        } finally {
             saveButton.disabled = false;
        }
    }

    // イベントリスナー
    saveButton.addEventListener('click', saveSettingsToServer);

    // 初期データの読み込み
    loadInitialData();
});