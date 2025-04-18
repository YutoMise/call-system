// --- DOM要素 ---
const statusDiv = document.getElementById('status');
const logDiv = document.getElementById('log');
const channelSelect = document.getElementById('channelSelect');
const channelPasswordInput = document.getElementById('channelPassword');
const subscribeButton = document.getElementById('subscribeButton');
const unsubscribeButton = document.getElementById('unsubscribeButton');
const refreshChannelsBtn = document.getElementById('refreshChannels');

let isSpeaking = false;
let currentSubscribedChannel = null;
let eventSource = null;
let speechSynthesisInitialized = false;

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

    // 例: チャンネルリスト更新ボタン(#refreshChannels)がクリックされた後や、
    //     初期のチャンネルリスト読み込み完了後に setSavedChannel() を呼び出すようにする
    //     (具体的な実装は既存のチャンネルリスト読み込み処理によります)

    // とりあえず、DOM読み込み完了時点で一度試みる
    setSavedChannel();

    // もしチャンネルリストの更新機能があるなら、更新後にも呼び出す
    const refreshButton = document.getElementById('refreshChannels');
    if (refreshButton) {
        // refreshButton がチャンネルリストを更新する処理の完了後に
        // setSavedChannel() を実行するように実装を調整してください。
        // 例 (仮): refreshButton.addEventListener('click', async () => {
        //     await updateChannelList(); // チャンネルリスト更新処理 (非同期と仮定)
        //     setSavedChannel(); // 更新後に保存されたチャンネルを選択
        // });
    }


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
         speakText('');
    });

    eventSource.addEventListener('play-announcement', (event) => {
        try {
            const data = JSON.parse(event.data);
             logMessage(`アナウンス受信 (チャンネル: ${currentSubscribedChannel}): 整理券 ${data.ticketNumber}, 診察室 ${data.roomNumber}`);
             const textToSpeak = `整理券番号 ${data.ticketNumber} 番のかた、 ${data.roomNumber} 番診察室にお越しください。`;
             speakText(textToSpeak);
         } catch (e) {
             logMessage("アナウンスデータの解析に失敗しました。");
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

     try {
         const result = await apiCall('/api/unsubscribe', { method: 'POST' });
         logMessage(`接続解除成功: ${result.message}`);
         currentSubscribedChannel = null;
         updateUIState('idle');
     } catch (error) {
         logMessage(`接続解除失敗: ${error.message}`);

         updateUIState('error'); // エラー状態にする
         statusDiv.textContent = `解除エラー: ${error.message}`;
     }
});

refreshChannelsBtn.addEventListener('click', fetchChannelList);

// --- 音声合成 (変更なし) ---
function speakText(text) { /* ... 前回のコードと同じ ... */
     if ('speechSynthesis' in window) {
        if (isSpeaking && text !== '') { logMessage("再生中スキップ"); return; }
        if (!text && isSpeaking) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP'; utterance.rate = 1.0; utterance.pitch = 1.0;
        utterance.onstart = () => { if(text) { isSpeaking = true; logMessage("再生開始: " + text); } };
        utterance.onend = () => { isSpeaking = false; if(text) { logMessage("再生終了"); } };
        utterance.onerror = (event) => { isSpeaking = false; logMessage(`再生エラー: ${event.error}`); };
        utterance.pitch = 1.2;
        window.speechSynthesis.speak(utterance);
    } else { logMessage('Web Speech API非対応'); if(text) alert('音声読み上げ非対応'); }
}

// --- 初期化 ---
updateUIState('initializing');
fetchChannelList(); // ページ読み込み時にリスト取得

// Web Speech APIのサポート状況を確認し、ログに出力
if ('speechSynthesis' in window) {
    logMessage("音声合成APIはサポートされています。「チャンネルに接続」ボタンクリック時に初期化されます。");
    // ページ読み込み時に前の音声が残っている可能性を考慮してキャンセル
    window.speechSynthesis.cancel();
} else {
    logMessage('Web Speech APIはこのブラウザではサポートされていません。音声読み上げは利用できません。');
    speechSynthesisInitialized = true; // 非対応の場合は「初期化済み」として扱い、関連エラーを防ぐ
    // 必要ならUIにも非対応であることを表示
    // 例: statusDiv.textContent = 'エラー: 音声読み上げ非対応ブラウザです。';
    // 例: statusDiv.className = 'error';
}
