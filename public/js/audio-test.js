document.addEventListener('DOMContentLoaded', () => {
    const languageSelect = document.getElementById('language-select');
    const speakerSelect = document.getElementById('speaker-select');
    const textInput = document.getElementById('text-input');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    const pitchSlider = document.getElementById('pitch-slider');
    const pitchValue = document.getElementById('pitch-value');
    const playBtn = document.getElementById('play-btn');
    const downloadBtn = document.getElementById('download-btn');
    const voicevoxParams = document.getElementById('voicevox-params');
    const loadingOverlay = document.getElementById('loading');

    let speakers = {
        voicevox: [],
        kokoro: []
    };

    async function loadSpeakers() {
        try {
            const [voicevoxRes, kokoroRes] = await Promise.all([
                fetch('/api/voicevox-speakers'),
                fetch('/api/kokoro-voices')
            ]);
            speakers.voicevox = await voicevoxRes.json();
            speakers.kokoro = await kokoroRes.json();
            updateSpeakerOptions();
        } catch (error) {
            console.error('話者リストの読み込みに失敗しました:', error);
            alert('話者リストの読み込みに失敗しました。');
        }
    }

    function updateSpeakerOptions() {
        const lang = languageSelect.value;
        speakerSelect.innerHTML = '';
        speakers[lang].forEach(speaker => {
            const option = document.createElement('option');
            option.value = speaker.id;
            option.textContent = speaker.name;
            speakerSelect.appendChild(option);
        });

        // パラメータUIの表示/非表示
        voicevoxParams.style.display = lang === 'voicevox' ? 'block' : 'none';
    }

    async function generateAudio() {
        const lang = languageSelect.value;
        const text = textInput.value.trim();
        if (!text) {
            alert('読み上げるテキストを入力してください。');
            return null;
        }

        loadingOverlay.style.display = 'flex';

        try {
            let url, body;
            if (lang === 'voicevox') {
                url = '/api/test-voice/voicevox';
                body = {
                    text: text,
                    speakerId: parseInt(speakerSelect.value, 10),
                    speed: parseFloat(speedSlider.value),
                    pitch: parseFloat(pitchSlider.value)
                };
            } else { // kokoro
                url = '/api/test-voice/kokoro';
                body = {
                    text: text,
                    voiceId: speakerSelect.value
                };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `音声の生成に失敗しました (status: ${response.status})`);
            }

            return await response.blob();

        } catch (error) {
            console.error('音声生成エラー:', error);
            alert(`エラー: ${error.message}`);
            return null;
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    playBtn.addEventListener('click', async () => {
        const audioBlob = await generateAudio();
        if (audioBlob) {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
        }
    });

    downloadBtn.addEventListener('click', async () => {
        const audioBlob = await generateAudio();
        if (audioBlob) {
            const audioUrl = URL.createObjectURL(audioBlob);
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = `synthesis_${new Date().getTime()}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(audioUrl);
        }
    });

    languageSelect.addEventListener('change', updateSpeakerOptions);

    speedSlider.addEventListener('input', () => speedValue.textContent = speedSlider.value);
    pitchSlider.addEventListener('input', () => pitchValue.textContent = pitchSlider.value);

    // 初期化
    loadSpeakers();
});
