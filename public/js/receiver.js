// --- DOM要素 ---
const statusDiv = document.getElementById('status');
const logDiv = document.getElementById('log');
const channelSelect = document.getElementById('channelSelect');
const channelPasswordInput = document.getElementById('channelPassword');
const subscribeButton = document.getElementById('subscribeButton');
const unsubscribeButton = document.getElementById('unsubscribeButton');
const refreshChannelsBtn = document.getElementById('refreshChannels');
const silentAudioToggle = document.getElementById('silentAudioToggle');

let isSpeaking = false; // アナウンス再生中フラグ
let currentSubscribedChannel = null;
<<<<<<< HEAD
let currentChannelInfo = null; // チャンネル情報（voiceIdを含む）を保存
=======
>>>>>>> 7f4a113 (Initial commit of existing project)
let eventSource = null;
let speechSynthesisInitialized = false;

// let announcementAudio = null; // 個別のAudioオブジェクトではなく、逐次再生で管理

// const audioSegmentCache = new Map();
let currentAnnouncementAbortController = null; // 現在のアナウンスを中断するためのコントローラー

<<<<<<< HEAD
// WebAudio API用の変数
let audioContext = null;
let silentOscillator = null;
let silentGainNode = null;
=======
let silentAudio = null;
>>>>>>> 7f4a113 (Initial commit of existing project)
let isSilentAudioPlaying = false;
let silentAudioMonitorInterval = null;

const SILENT_AUDIO_FILE_URL = '/audio/silent.wav';
const CALL_SIGN_AUDIO_URL = '/audio/call-sign.wav';
const PREGENERATED_AUDIO_BASE_PATH = '/audio/pregenerated/'; // 事前生成音声のベースパス

document.addEventListener('DOMContentLoaded', () => {
    const channelSelect = document.getElementById('channelSelect');
    const channelPasswordInput = document.getElementById('channelPassword');
    const announceButton = document.getElementById('announceButton'); // アナウンスボタンも取得

    // --- 1. ページ読み込み時に保存された値を読み込む ---
    const savedChannel = localStorage.getItem('selectedChannel');
    const savedPassword = localStorage.getItem('channelPassword');

    // 保存されたパスワードがあれば入力欄に設定
    if (savedPassword) {
        channelPasswordInput.value = savedPassword;
    }

    // 無音BGMの初期化とイベントリスナー
    const savedSilentAudioState = localStorage.getItem('silentAudioEnabled');
    // 保存された値がない場合(null)はデフォルトでオン、'false'の場合のみオフ
    silentAudioToggle.checked = (savedSilentAudioState === null || savedSilentAudioState === 'true');

<<<<<<< HEAD
    // WebAudio APIの初期化（ユーザー操作後に行う）

=======
>>>>>>> 7f4a113 (Initial commit of existing project)
    silentAudioToggle.addEventListener('change', () => {
        const isEnabled = silentAudioToggle.checked;
        localStorage.setItem('silentAudioEnabled', isEnabled);
        logMessage(`無音再生を${isEnabled ? '有効' : '無効'}に設定しました。`);
        if (isEnabled && !isSilentAudioPlaying && currentSubscribedChannel && speechSynthesisInitialized) {
            // 接続中にトグルがオンにされた場合、再生を試みる (成功するとは限らない)
            logMessage("接続中に無音再生が有効化されました。再生を試みます...");
            playSilentAudio();
        } else if (!isEnabled && isSilentAudioPlaying) {
            // トグルがオフにされたら停止
            stopSilentAudio();
        }
    });

<<<<<<< HEAD


=======
>>>>>>> 7f4a113 (Initial commit of existing project)
    // チャンネルリストが読み込まれた後に、保存されたチャンネルを選択する
    // 注意: チャンネルリストの読み込みが非同期の場合、
    //      読み込み完了後にこの選択処理を行う必要があります。
    //      ここでは、チャンネルリストが既に存在すると仮定します。
    //      もし非同期で読み込んでいる場合は、その完了コールバック内で実行してください。
    const setSavedChannel = () => {
        if (savedChannel && channelSelect) {
            // オプションが存在するか確認してから設定
            const optionExists = Array.from(channelSelect.options).some(option => option.value === savedChannel);
            if (optionExists) {
                channelSelect.value = savedChannel;
            } else {
                console.warn(`Saved channel "${savedChannel}" not found in options.`);
                // 必要であれば、保存された値をクリアするなどの処理を追加
                // localStorage.removeItem('selectedChannel');
            }
        }
    };

    // とりあえず、DOM読み込み完了時点で一度試みる
    setSavedChannel();

    // --- 2. 値が変更された時に localStorage に保存する ---

    // チャンネルが変更されたら保存
    if (channelSelect) {
        channelSelect.addEventListener('change', () => {
            localStorage.setItem('selectedChannel', channelSelect.value);
        });
    }

    // パスワードが入力されたら保存
    // 'input' イベントは入力の度に発火します
    if (channelPasswordInput) {
        channelPasswordInput.addEventListener('input', () => {
            localStorage.setItem('channelPassword', channelPasswordInput.value);
        });
    }
});


function logMessage(message) {
     const p = document.createElement('p');
     p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
     logDiv.prepend(p);
}

// --- API通信 (送信側と同じものを流用可) ---
async function apiCall(endpoint, options = {}) { /* ... 送信側と同じ ... */
    try {
        const response = await fetch(endpoint, options);
        const data = await response.json();
        if (!response.ok) { throw new Error(data.message || `HTTP error! status: ${response.status}`); }
        return data;
    } catch (error) { console.error('API Call Error:', error); throw error; }
}

// --- チャンネルリスト処理 ---
function populateChannelList(channelNames) { /* ... 前回のコードと同じ ... */
    const currentSelection = channelSelect.value;
    channelSelect.innerHTML = '<option value="">-- チャンネルを選択 --</option>';
    channelNames.sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name; option.textContent = name; channelSelect.appendChild(option);
    });
    if (channelNames.includes(currentSelection)) { channelSelect.value = currentSelection; }
}

<<<<<<< HEAD
// チャンネル詳細情報を取得する関数
async function fetchChannelDetails() {
    logMessage("チャンネル詳細情報を要求中...");
    try {
        const response = await fetch('/admin/api/channels');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const channelDetails = await response.json();
        logMessage('チャンネル詳細情報受信: ' + channelDetails.length + '件');
        return channelDetails;
    } catch (error) {
        logMessage(`チャンネル詳細情報取得エラー: ${error.message}`);
        return [];
    }
}

=======
>>>>>>> 7f4a113 (Initial commit of existing project)
async function fetchChannelList() {
     logMessage("チャンネルリストを要求中...");
     try {
         const channelNames = await apiCall('/api/channels');
         logMessage('チャンネルリスト受信: ' + channelNames.join(', '));
         populateChannelList(channelNames);
         updateUIState('idle'); // リスト取得成功したら操作可能に
     } catch (error) {
         statusDiv.textContent = `リスト取得エラー: ${error.message}`;
         updateUIState('error');
     }
}

// --- UI状態更新 ---
function updateUIState(state) {
    switch(state) {
        case 'idle':
            statusDiv.textContent = 'チャンネルを選択して接続してください';
            statusDiv.className = '';
            subscribeButton.disabled = false;
            unsubscribeButton.disabled = true;
            channelSelect.disabled = false;
            channelPasswordInput.disabled = false;
            refreshChannelsBtn.disabled = false;
            break;
        case 'subscribing':
            statusDiv.textContent = `チャンネル「${channelSelect.value}」接続中...`;
            statusDiv.className = 'joining';
            subscribeButton.disabled = true;
            unsubscribeButton.disabled = true;
            channelSelect.disabled = true;
            channelPasswordInput.disabled = true;
            refreshChannelsBtn.disabled = true;
            break;
        case 'listening': // SSE接続中
            statusDiv.textContent = `チャンネル「${currentSubscribedChannel}」接続中`;
            statusDiv.className = 'listening';
            subscribeButton.disabled = true;
            unsubscribeButton.disabled = false; // 解除可能
            channelSelect.disabled = true;
            channelPasswordInput.disabled = true;
            channelPasswordInput.value = ''; // パスワードクリア
            refreshChannelsBtn.disabled = true;
            break;
        case 'error':
            // statusDivのテキストはエラーハンドラで設定
            statusDiv.className = 'error';
             subscribeButton.disabled = false; // 再試行可能
             unsubscribeButton.disabled = true;
             channelSelect.disabled = false;
             channelPasswordInput.disabled = false;
             refreshChannelsBtn.disabled = false;
            break;
         case 'unsubscribing':
            statusDiv.textContent = `チャンネル「${currentSubscribedChannel}」の接続を解除中...`;
            statusDiv.className = 'joining'; // joiningと同じスタイル
            subscribeButton.disabled = true;
            unsubscribeButton.disabled = true;
            channelSelect.disabled = true;
            channelPasswordInput.disabled = true;
            refreshChannelsBtn.disabled = true;
            break;
         case 'initializing':
         default:
            statusDiv.textContent = '初期化中...';
            statusDiv.className = '';
            subscribeButton.disabled = true;
            unsubscribeButton.disabled = true;
            channelSelect.disabled = true;
            channelPasswordInput.disabled = true;
            refreshChannelsBtn.disabled = true;
            break;
    }
}

// --- EventSource 関連 ---
function connectEventSource() {
    if (eventSource) {
        eventSource.close();
    }
    logMessage("接続を開始します (/events)");
    eventSource = new EventSource('/events');

    eventSource.onopen = () => {
        logMessage("接続中...");
    };

    eventSource.onerror = (error) => {
        logMessage("接続エラーが発生しました。");
        console.error("EventSource failed:", error);
        // updateUIState('error'); // エラー状態にするか、自動再接続に任せるか
        // EventSourceは通常自動で再接続を試みる
        statusDiv.textContent = `接続エラー発生、再接続試行中... (チャンネル: ${currentSubscribedChannel})`;
        statusDiv.className = 'error';
        // 必要ならここで eventSource.close() して手動再接続UIを出す
    };

    // --- カスタムイベントリスナー ---
    eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        logMessage(`サーバーからの接続確認: ${data.message}`);
         updateUIState('listening');

         // 接続成功後に無音再生を開始
         if (silentAudioToggle.checked && speechSynthesisInitialized) {
             logMessage("接続成功後、無音再生を開始します。");
             playSilentAudio();
         }
    });

    eventSource.addEventListener('play-announcement', (event) => {
        try {
            const data = JSON.parse(event.data);

            // データ構造の検証 (オプション)
            if (typeof data.ticketNumber === 'undefined' || typeof data.roomNumber === 'undefined') {
                logMessage(`アナウンスデータの形式が不正です。ticketNumberまたはroomNumberがありません。データ: ${event.data}`);
                console.error("Invalid announcement data structure:", data);
                return; // 処理を中断
            }

             logMessage(`アナウンス受信 (チャンネル: ${currentSubscribedChannel}): 整理券 ${data.ticketNumber}, 診察室 ${data.roomNumber}`);
             const textToSpeak = `呼び出し番号 ${data.ticketNumber}番のかた、 ${data.roomNumber}番診察室へお越しください。`;
             // チケット番号と部屋番号を個別に渡す
             speakText(textToSpeak, data.ticketNumber, data.roomNumber);
         } catch (e) {
             logMessage(`アナウンスデータのJSON解析に失敗しました。エラー: ${e.message}`);
             console.error("Failed to parse announcement data:", event.data, e);
         }
    });

    eventSource.addEventListener('error', (event) => {
        // サーバーがSSEエンドポイントでエラーイベントを送ってきた場合
         try {
            const data = JSON.parse(event.data);
            logMessage(`サーバーエラー受信: ${data.message}`);
            statusDiv.textContent = `サーバーエラー: ${data.message}`;
            updateUIState('error');
            if (eventSource) eventSource.close(); // エラーなら接続を切る
        } catch (e) {
            // 解析不能なエラーはonerrorで捕捉されるはず
        }
    });

}

function disconnectEventSource() {
    if (eventSource) {
        logMessage("接続を閉じます。");
        eventSource.close();
        eventSource = null;
    }
}


// --- UIイベントリスナー ---
subscribeButton.addEventListener('click', async () => {
    const channelName = channelSelect.value;
    const password = channelPasswordInput.value;

    if (!speechSynthesisInitialized && 'speechSynthesis' in window) {
        logMessage("接続ボタンクリックを検知。音声合成APIを初期化します...");
        try {
            // ダミーの音声合成を実行（無音、空文字列）
            const utterance = new SpeechSynthesisUtterance('');
            utterance.volume = 0;
            utterance.lang = 'ja-JP'; // 言語指定
            window.speechSynthesis.speak(utterance);

            // 成功したらフラグを立てる
            speechSynthesisInitialized = true;
            logMessage("音声合成APIの準備ができました。チャンネル接続に進みます。");

        } catch (error) {
            logMessage(`音声合成APIの初期化中にエラー: ${error}`);
            console.error("Speech synthesis initialization failed on button click:", error);
            // 初期化失敗をユーザーに通知し、処理を中断
            statusDiv.textContent = `音声初期化エラー: ${error.message}`;
            statusDiv.className = 'error';
            alert(`音声機能の初期化に失敗しました。\n(${error.message})\nページを再読み込みして試してください。`);
            return; // 接続処理に進まない
        }
    } else if (!('speechSynthesis' in window) && !speechSynthesisInitialized) {
        // API非対応の場合 (通常はページ読み込み時に判定済み)
        logMessage("音声合成API非対応のため、音声なしで接続します。");
        speechSynthesisInitialized = true; // 非対応でも「初期化済み」として扱う
    }

    if (!channelName || !password) {
        alert('チャンネルとパスワードを選択/入力してください。');
        return;
    }

    updateUIState('subscribing');
    logMessage(`チャンネル「${channelName}」の接続を試行中...`);

    try {
        const result = await apiCall('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName, password })
        });
        logMessage(`接続成功: ${result.message}`);
        currentSubscribedChannel = channelName;
<<<<<<< HEAD

        // チャンネル詳細情報を取得してvoiceIdを保存
        const channelDetails = await fetchChannelDetails();
        currentChannelInfo = channelDetails.find(ch => ch.name === channelName);
        if (currentChannelInfo && currentChannelInfo.voiceId) {
            logMessage(`チャンネル「${channelName}」の音声ID: ${currentChannelInfo.voiceId}`);
        } else {
            logMessage(`チャンネル「${channelName}」の音声ID情報が見つかりません。デフォルト音声を使用します。`);
            currentChannelInfo = { name: channelName, voiceId: 'voice1' }; // デフォルト
        }

=======
>>>>>>> 7f4a113 (Initial commit of existing project)
        connectEventSource();

    } catch (error) {
        logMessage(`接続失敗: ${error.message}`);
        statusDiv.textContent = `接続エラー: ${error.message}`;
        updateUIState('error');
    }
});

unsubscribeButton.addEventListener('click', async () => {
     if (!currentSubscribedChannel) return;

     updateUIState('unsubscribing');
     logMessage(`チャンネル「${currentSubscribedChannel}」の接続解除を試行中...`);
     disconnectEventSource();

     // 接続解除時に無音再生を停止
     if (isSilentAudioPlaying) {
         logMessage("接続解除のため無音再生を停止します。");
         stopSilentAudio();
     }

     try {
         const result = await apiCall('/api/unsubscribe', { method: 'POST' });
         logMessage(`接続解除成功: ${result.message}`);
         currentSubscribedChannel = null;
<<<<<<< HEAD
         currentChannelInfo = null; // チャンネル情報もクリア
=======
>>>>>>> 7f4a113 (Initial commit of existing project)
         updateUIState('idle');
     } catch (error) {
         logMessage(`接続解除失敗: ${error.message}`);

         updateUIState('error'); // エラー状態にする
         statusDiv.textContent = `解除エラー: ${error.message}`;
     }
});

refreshChannelsBtn.addEventListener('click', fetchChannelList);

// 無音再生用のデータURLを生成する関数
<<<<<<< HEAD
// WebAudio APIを使用した無音再生の初期化
function initializeWebAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            logMessage("WebAudio APIコンテキストを初期化しました。");
        } catch (error) {
            logMessage(`WebAudio APIの初期化に失敗しました: ${error.message}`);
            console.error("WebAudio API initialization failed:", error);
            return false;
        }
    }
    return true;
}

// WebAudio APIを使用したテスト音オシレーターの作成（ブラウザ判定確認用）
function createSilentOscillator() {
    if (!audioContext) {
        logMessage("AudioContextが初期化されていません。");
        return false;
    }

    try {
        // オシレーターを作成（極小音用に非常に低い周波数の音を出す）
        silentOscillator = audioContext.createOscillator();
        silentOscillator.frequency.setValueAtTime(30, audioContext.currentTime); // 30Hzの極低音（ほぼ聞こえない）
        silentOscillator.type = 'sine';

        // ゲインノードを作成（実用レベルの極小音量で音を出す）
        silentGainNode = audioContext.createGain();
        silentGainNode.gain.setValueAtTime(0.001, audioContext.currentTime); // 音量0.1%で音を出す

        // オシレーター → ゲインノード → 出力先 の接続
        silentOscillator.connect(silentGainNode);
        silentGainNode.connect(audioContext.destination);

        logMessage("WebAudio API極小音オシレーターを作成しました（30Hz、音量0.1%）。");
        return true;
    } catch (error) {
        logMessage(`テスト音オシレーターの作成に失敗しました: ${error.message}`);
        console.error("Test oscillator creation failed:", error);
        return false;
    }
}

// WebAudio API無音再生の準備
function prepareSilentAudio() {
    // WebAudio APIコンテキストの初期化
    if (!initializeWebAudioContext()) {
        return false;
    }

    // AudioContextが suspended状態の場合は resume する
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            logMessage("AudioContextを再開しました。");
        }).catch(error => {
            logMessage(`AudioContextの再開に失敗しました: ${error.message}`);
        });
    }

    return true;
}

// WebAudio API無音再生の監視機能
=======
function createSilentAudioDataURL() {
    // 1秒間の無音データを生成（44.1kHz、16bit、モノラル）
    const sampleRate = 44100;
    const duration = 1; // 1秒
    const numSamples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + numSamples * 2); // WAVヘッダー44バイト + データ
    const view = new DataView(buffer);

    // WAVヘッダーを書き込み
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // データ部分は0で埋める（無音）
    for (let i = 0; i < numSamples; i++) {
        view.setInt16(44 + i * 2, 0, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}

// 無音再生
function createSilentAudio() {
    if (!silentAudio) {
        logMessage("無音再生用のAudioオブジェクトを作成します。");

        // まずファイルベースの無音再生を試行
        silentAudio = new Audio(SILENT_AUDIO_FILE_URL);
        silentAudio.loop = true; // ループ再生
        silentAudio.volume = 0.1; // Bluetoothスピーカーの電源切れ防止のため音量1（0.0-1.0の範囲）

        // イベントリスナーを設定
        silentAudio.addEventListener('play', () => {
            logMessage("無音再生が開始/再開されました。");
            isSilentAudioPlaying = true;
            startSilentAudioMonitoring(); // 監視を開始
        });

        silentAudio.addEventListener('pause', () => {
            logMessage(`無音再生がpauseされました。現在時刻: ${silentAudio.currentTime.toFixed(2)}`);
            // 意図しないpauseの場合に再開を試みるロジック（必要に応じて）
            if (isSilentAudioPlaying && silentAudioToggle.checked && currentSubscribedChannel) {
                 logMessage("無音再生が一時停止しました。状態を確認します...");
                 // 自動再開はループやブラウザの挙動に任せる場合が多い
                 // 必要であれば setTimeout で再開を試みる
            } else {
                 logMessage("無音再生が停止されました。");
                 isSilentAudioPlaying = false;
                 stopSilentAudioMonitoring(); // 監視を停止
            }
        });

        silentAudio.addEventListener('error', (e) => {
             logMessage(`無音再生エラーが発生しました: ${e.message || '詳細不明'}`);
             console.error("Silent audio playback error:", e);

             // ファイルベースが失敗した場合、プログラム生成の無音データを試行
             logMessage("プログラム生成の無音データで再試行します。");
             try {
                 const silentDataURL = createSilentAudioDataURL();
                 silentAudio.src = silentDataURL;
                 silentAudio.load();
             } catch (fallbackError) {
                 logMessage(`フォールバック無音再生も失敗しました: ${fallbackError.message}`);
                 console.error("Fallback silent audio creation failed:", fallbackError);
             }

             isSilentAudioPlaying = false; // エラー時は再生中ではない
        });

        // ループが終了した場合の処理（念のため）
        silentAudio.addEventListener('ended', () => {
            if (isSilentAudioPlaying && silentAudioToggle.checked && currentSubscribedChannel) {
                logMessage("無音再生ループが終了しました。再開を試みます。");
                silentAudio.play().catch(err => {
                    logMessage(`無音再生の再開に失敗: ${err.message}`);
                });
            }
        });
    }
}

// 無音再生の監視機能
>>>>>>> 7f4a113 (Initial commit of existing project)
function startSilentAudioMonitoring() {
    if (silentAudioMonitorInterval) {
        clearInterval(silentAudioMonitorInterval);
    }

    silentAudioMonitorInterval = setInterval(() => {
<<<<<<< HEAD
        if (silentAudioToggle.checked && currentSubscribedChannel) {
            if (audioContext && silentOscillator) {
                const contextState = audioContext.state;
                logMessage(`WebAudio無音再生監視: AudioContext状態=${contextState}, 再生中=${isSilentAudioPlaying}`);

                // AudioContextが suspended状態になった場合の対処
                if (contextState === 'suspended' && isSilentAudioPlaying) {
                    logMessage("AudioContextがsuspendされました。再開を試みます。");
                    audioContext.resume().catch(err => {
                        logMessage(`AudioContextの再開に失敗: ${err.message}`);
                    });
                }
            } else if (isSilentAudioPlaying) {
                logMessage("無音再生が停止されているようです。再開を試みます。");
                playSilentAudio();
            }
        }
    }, 10000); // 10秒ごとにチェック（WebAudio APIは安定しているため間隔を長く）
=======
        if (silentAudio && silentAudioToggle.checked && currentSubscribedChannel) {
            const isPaused = silentAudio.paused;
            const currentTime = silentAudio.currentTime;
            const duration = silentAudio.duration || 0;

            // 詳細な状態ログ
            logMessage(`無音再生監視: paused=${isPaused}, playing=${isSilentAudioPlaying}, time=${currentTime.toFixed(2)}/${duration.toFixed(2)}, volume=${silentAudio.volume}`);

            // 再生が停止している場合は再開を試みる
            if (isPaused && isSilentAudioPlaying) {
                logMessage("無音再生が予期せず停止しました。再開を試みます。");
                // フラグをリセットしてから再開
                isSilentAudioPlaying = false;
                silentAudio.play().catch(err => {
                    logMessage(`無音再生の自動再開に失敗: ${err.message}`);
                });
            }

            // フラグと実際の状態が一致しない場合の修正
            if (!isPaused && !isSilentAudioPlaying) {
                logMessage("無音再生フラグが実際の状態と不一致です。修正します。");
                isSilentAudioPlaying = true;
            }

            // 現在時刻とdurationをチェック（ループが正常に動作しているか）
            if (!isPaused && duration > 0) {
                const progress = (currentTime / duration) * 100;
                if (progress > 95) { // 95%以上再生されている場合
                    logMessage(`無音再生進行状況: ${progress.toFixed(1)}% (ループ中)`);
                }
            }
        }
    }, 5000); // 5秒ごとにチェック
>>>>>>> 7f4a113 (Initial commit of existing project)
}

function stopSilentAudioMonitoring() {
    if (silentAudioMonitorInterval) {
        clearInterval(silentAudioMonitorInterval);
        silentAudioMonitorInterval = null;
        logMessage("無音再生の監視を停止しました。");
    }
}

async function playSilentAudio() {
<<<<<<< HEAD
    logMessage(`WebAudio無音再生試行: トグル=${silentAudioToggle.checked}, 再生中=${isSilentAudioPlaying}, チャンネル=${currentSubscribedChannel}, 初期化済=${speechSynthesisInitialized}`);
=======
    logMessage(`無音再生試行: トグル=${silentAudioToggle.checked}, 再生中=${isSilentAudioPlaying}, チャンネル=${currentSubscribedChannel}, 初期化済=${speechSynthesisInitialized}`);

    // 現在のsilentAudioの状態もログ出力
    if (silentAudio) {
        logMessage(`現在の無音オーディオ状態: paused=${silentAudio.paused}, currentTime=${silentAudio.currentTime.toFixed(2)}, duration=${silentAudio.duration || 'unknown'}`);
    }
>>>>>>> 7f4a113 (Initial commit of existing project)

    // トグルがオフ、または既に再生中、またはチャンネル未接続なら何もしない
    if (!silentAudioToggle.checked || isSilentAudioPlaying || !currentSubscribedChannel) {
        if(!silentAudioToggle.checked) logMessage("無音再生が無効のため開始しません。");
        if(isSilentAudioPlaying) logMessage("無音再生は既に実行中です。");
        if(!currentSubscribedChannel) logMessage("チャンネル未接続のため無音再生を開始しません。");
        return;
    }
    if (!speechSynthesisInitialized) {
        logMessage("オーディオコンテキスト未初期化のため、無音再生を開始できません。");
        return;
    }

<<<<<<< HEAD
    // WebAudio APIの準備
    if (!prepareSilentAudio()) {
        logMessage("WebAudio APIの準備に失敗しました。");
        return;
    }

    try {
        // 既存のオシレーターがあれば停止
        if (silentOscillator) {
            try {
                silentOscillator.stop();
            } catch (e) {
                // 既に停止している場合のエラーは無視
            }
        }

        // 新しいオシレーターを作成
        if (!createSilentOscillator()) {
            logMessage("無音オシレーターの作成に失敗しました。");
            return;
        }

        // オシレーターを開始
        silentOscillator.start();
        isSilentAudioPlaying = true;
        startSilentAudioMonitoring();

        logMessage("WebAudio API極小音再生を開始しました（30Hz、音量0.1%）。");

    } catch (error) {
        logMessage(`WebAudio無音再生の開始に失敗しました: ${error.message}`);
        console.error("Failed to start WebAudio silent audio:", error);
=======
    createSilentAudio(); // Audioオブジェクトがなければ作成

    logMessage("無音再生の開始を試みます...");
    try {
        // 再生前に現在時刻をリセット
        if (silentAudio.currentTime > 0) {
            silentAudio.currentTime = 0;
            logMessage("無音再生の再生位置をリセットしました。");
        }

        // ブラウザの自動再生ポリシーに対応するため、複数回試行
        let playAttempts = 0;
        const maxAttempts = 3;

        while (playAttempts < maxAttempts) {
            try {
                await silentAudio.play();
                logMessage(`無音再生の開始に成功しました。音量: ${silentAudio.volume}, ループ: ${silentAudio.loop}`);
                break; // 成功したらループを抜ける
            } catch (playError) {
                playAttempts++;
                logMessage(`無音再生試行 ${playAttempts}/${maxAttempts} 失敗: ${playError.message}`);

                if (playAttempts < maxAttempts) {
                    // 少し待ってから再試行
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    throw playError; // 最後の試行も失敗したら例外を投げる
                }
            }
        }

        // isSilentAudioPlaying = true; // 'play'イベントで設定される
    } catch (error) {
        logMessage(`無音再生の開始に失敗しました: ${error.message}`);
        console.error("Failed to start silent audio:", error);
>>>>>>> 7f4a113 (Initial commit of existing project)
        isSilentAudioPlaying = false;

        // 自動再生が拒否された場合のユーザー向けメッセージ
        if (error.name === 'NotAllowedError') {
<<<<<<< HEAD
            logMessage("ブラウザの自動再生ポリシーによりWebAudio無音再生が拒否されました。ユーザー操作後に再試行されます。");
=======
            logMessage("ブラウザの自動再生ポリシーにより無音再生が拒否されました。ユーザー操作後に再試行されます。");
>>>>>>> 7f4a113 (Initial commit of existing project)
        }
    }
}

function stopSilentAudio() {
    stopSilentAudioMonitoring(); // 監視を停止

<<<<<<< HEAD
    if (silentOscillator) {
        try {
            logMessage("WebAudio極小音再生を停止します。");
            silentOscillator.stop();
        } catch (error) {
            // 既に停止している場合のエラーは無視
            logMessage(`オシレーター停止時のエラー（無視）: ${error.message}`);
        }
        silentOscillator = null;
        silentGainNode = null;
    }

    // フラグを確実に更新
    isSilentAudioPlaying = false;

    logMessage(`WebAudio極小音再生停止完了。再生中=${isSilentAudioPlaying}`);
=======
    if (silentAudio) {
        if (!silentAudio.paused) {
            logMessage("無音再生を停止します。");
            silentAudio.pause();
            silentAudio.currentTime = 0; // 再生位置をリセット
        }
        // フラグを確実に更新
        isSilentAudioPlaying = false;
    } else {
         // オブジェクトが存在しない場合
         isSilentAudioPlaying = false; // 状態を確実に更新
    }

    logMessage(`無音再生停止完了。状態: paused=${silentAudio ? silentAudio.paused : 'N/A'}, playing=${isSilentAudioPlaying}`);
>>>>>>> 7f4a113 (Initial commit of existing project)
}

// 指定された音声ファイルを再生する関数
async function playAudioFile(audioFilePath, abortSignal) {
    if (abortSignal && abortSignal.aborted) {
        logMessage(`再生中止 (シグナル): "${audioFilePath}"`);
        throw new DOMException('Aborted', 'AbortError');
    }

    return new Promise((resolve, reject) => {
        if (abortSignal && abortSignal.aborted) {
            logMessage(`再生開始前に中止: "${audioFilePath}"`);
            return reject(new DOMException('Aborted', 'AbortError'));
        }

        const audio = new Audio(audioFilePath); // audioUrl -> audioFilePath に変更
        let resolved = false;

        const cleanupAndResolve = () => {
            if (resolved) return;
            resolved = true;
            resolve();
        };

        const cleanupAndReject = (err) => {
            if (resolved) return;
            resolved = true;
            reject(err);
        };

        audio.addEventListener('ended', () => {
            logMessage(`再生終了: "${audioFilePath}"`);
            cleanupAndResolve();
        });

        audio.addEventListener('error', (e) => {
            logMessage(`再生エラー: "${audioFilePath}": ${e.message || e.type}`);
            console.error("Audio playback error for file:", audioFilePath, e);
            cleanupAndReject(e);
        });

        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                if (resolved) return;
                logMessage(`再生中止トリガー: "${audioFilePath}"`);
                audio.pause();
                cleanupAndReject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
        }

        logMessage(`再生開始: "${audioFilePath}"`);
        audio.play().catch(err => { // play() は Promise を返すので catch も追加
            logMessage(`再生開始エラー: "${audioFilePath}": ${err.message}`);
            cleanupAndReject(err);
        });
    });
}

// 音声合成 (部品ごとのキャッシュと逐次再生に対応)
async function speakText(fullText, ticketNumber, roomNumber) {
    if (isSpeaking) {
        logMessage("既にアナウンスが再生中です。新しいアナウンスはスキップされます。");
        return;
    }
    if (!fullText || !fullText.trim()) {
        logMessage("テキストが空のためアナウンスをスキップします。");
        return;
    }
    if (!speechSynthesisInitialized) {
        logMessage("オーディオ未初期化のためアナウンスできません。");
        return;
    }

    isSpeaking = true;
    currentAnnouncementAbortController = new AbortController();
    const abortSignal = currentAnnouncementAbortController.signal;

<<<<<<< HEAD
    // 現在のチャンネルのvoiceIdに基づいて音声ファイルのパスを組み立てる
    const voiceId = currentChannelInfo?.voiceId || 'voice1'; // デフォルトはvoice1
    const voiceBasePath = `${PREGENERATED_AUDIO_BASE_PATH}${voiceId}/`;

    const segmentsToPlay = [
        `${voiceBasePath}ticket_${ticketNumber}.mp3`,
        `${voiceBasePath}room_${roomNumber}.mp3`
    ];

    logMessage(`音声再生: voiceId=${voiceId}, チャンネル=${currentSubscribedChannel}`);

=======
    // 再生する音声ファイルのパスを組み立てる
    const segmentsToPlay = [
        `${PREGENERATED_AUDIO_BASE_PATH}ticket_${ticketNumber}.mp3`, // .wav から .mp3 (または .opus) に変更
        `${PREGENERATED_AUDIO_BASE_PATH}room_${roomNumber}.mp3`   // .wav から .mp3 (または .opus) に変更
    ];

>>>>>>> 7f4a113 (Initial commit of existing project)
    // 無音再生中なら一時停止
    let wasSilentPlaying = isSilentAudioPlaying && silentAudioToggle.checked && currentSubscribedChannel;
    if (wasSilentPlaying) {
        logMessage("アナウンスのため無音再生を一時停止します。");
        stopSilentAudio();
    }

    try {
        // チャイム音の再生
        logMessage("チャイム音の再生を試みます...");
        const chimeAudio = new Audio(CALL_SIGN_AUDIO_URL);
        await new Promise((resolveChime, rejectChime) => {
            if (abortSignal.aborted) return rejectChime(new DOMException('Aborted', 'AbortError'));

            const onChimeEnd = () => { logMessage("チャイム音再生終了。アナウンスを開始します。"); resolveChime(); };
            const onChimeError = (e) => {
                logMessage(`チャイム音の再生に失敗しました: ${e.message || '詳細不明'}。アナウンス処理を続行します。`);
                console.error("Call sign audio playback error:", e);
                resolveChime(); // チャイムが失敗してもアナウンスは試みる
            };

            chimeAudio.addEventListener('ended', onChimeEnd, { once: true });
            chimeAudio.addEventListener('error', onChimeError, { once: true });

            abortSignal.addEventListener('abort', () => {
                chimeAudio.pause();
                rejectChime(new DOMException('Aborted', 'AbortError'));
            }, { once: true });

            chimeAudio.play().catch(onChimeError); // play自体のエラーも処理
        });

        logMessage(`アナウンス再生処理開始 (事前生成ファイル): "${fullText}"`);
        for (const audioFilePath of segmentsToPlay) {
            if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
            await playAudioFile(audioFilePath, abortSignal);
        }
        logMessage("全セグメントのアナウンス再生が完了しました。");

    } catch (error) {
        if (error.name === 'AbortError') {
            logMessage("アナウンス処理が中止されました。");
        } else {
            logMessage(`アナウンス処理中にエラー (事前生成ファイル): ${error.message}`);
            console.error("Error during segmented announcement playback:", error);
        }
    } finally {
        isSpeaking = false;
        currentAnnouncementAbortController = null;
        if (wasSilentPlaying && silentAudioToggle.checked && currentSubscribedChannel) {
            // 中断されていない場合のみ無音再生を再開（中断時も再開したい場合は条件変更）
            if (!abortSignal || !abortSignal.aborted) {
                logMessage("アナウンス処理完了後、無音再生の再開を試みます。");
                // フラグを明示的にリセットしてから再開
                isSilentAudioPlaying = false;
                // 少し待ってから再開（アナウンス音声の完全終了を待つ）
                setTimeout(() => {
                    if (silentAudioToggle.checked && currentSubscribedChannel) {
                        playSilentAudio();
                    }
                }, 500);
            }
        }
    }
}


// --- 初期化 ---
updateUIState('initializing');
fetchChannelList(); // ページ読み込み時にリスト取得

if ('Audio' in window) {
    logMessage("HTML Audio Element はサポートされています。");
} else {
    logMessage('HTML Audio Element がサポートされていません。音声再生は利用できません。');
    speechSynthesisInitialized = true; // 非対応の場合は「初期化済み」として扱う
    statusDiv.textContent = 'エラー: このブラウザは音声再生に対応していません。';
    statusDiv.className = 'error';
    silentAudioToggle.disabled = true;
    const toggleLabel = document.querySelector('label[for="silentAudioToggle"]');
    if(toggleLabel) toggleLabel.style.color = '#aaa';
}

stopSilentAudio(); // 初期状態では無音再生を停止
logMessage("初期化完了。ユーザー操作待機中。");