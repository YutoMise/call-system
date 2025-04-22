
// --- DOM要素 (変更なし) ---
const channelSelect = document.getElementById('channelSelect');
const refreshChannelsBtn = document.getElementById('refreshChannels');
const channelPasswordInput = document.getElementById('channelPassword');
const ticketNumberInput = document.getElementById('ticketNumber');
const roomButtonsContainer = document.getElementById('roomButtons');
const announceButton = document.getElementById('announceButton');
const announcementStatus = document.getElementById('announcement-status');
const toggleCreateChannelBtn = document.getElementById('toggleCreateChannel');
const createChannelDialog = document.getElementById('create-channel-dialog');
const newChannelNameInput = document.getElementById('newChannelName');
const newChannelPasswordInput = document.getElementById('newChannelPassword');
const createChannelButton = document.getElementById('createChannelButton');
const createChannelStatus = document.getElementById('create-channel-status');
let selectedRoom = null;

// --- 診察室ボタン生成 (変更なし) ---
for (let i = 1; i <= 7; i++) {
    const button = document.createElement('button');
    button.textContent = i; button.dataset.room = i;
    button.addEventListener('click', (event) => {
        event.preventDefault(); // フォーム送信を防ぐ
        // すべてのボタンから 'selected' クラスを削除
        roomButtonsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
        // クリックされたボタンに 'selected' クラスを追加
        button.classList.add('selected');
        selectedRoom = button.dataset.room; // 選択された部屋番号を保持
    });
    roomButtonsContainer.appendChild(button);
}

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

    /*
    // --- 別案: アナウンス開始時にのみ保存する場合 ---
    // パスワードの保存タイミングをより限定したい場合（例：アナウンス成功時など）はこちらを参考にします。
    // 上記の channelPasswordInput の 'input' イベントリスナーを削除し、
    // announceButton のクリックイベントリスナー（既存のものがあればそれに追記）内で保存します。

    if (announceButton && channelPasswordInput && channelSelect) {
        announceButton.addEventListener('click', () => {
            // ここでアナウンス実行処理が行われると仮定
            // 成功した場合や、ボタンが押されたタイミングで保存
            console.log('Saving channel and password on announce click.'); // デバッグ用
            localStorage.setItem('selectedChannel', channelSelect.value);
            localStorage.setItem('channelPassword', channelPasswordInput.value);

            // 注意: 本来のアナウンス処理を妨げないようにしてください。
            //       非同期処理がある場合は、その完了を待つ必要はありません。
        });
    }
    */

    document.addEventListener('keydown', (e) => {
        // '*' キーが押された場合
        if (e.key === "*") {
            e.preventDefault();

            // 現在フォーカスされている要素を取得
            const currentElement = document.activeElement;

            // フォーカス可能な要素のリストを取得
            const focusableElements = Array.from(
                document.querySelectorAll(
                    'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
                )
            ).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);

            // フォーカス可能な要素がない場合
            if (focusableElements.length === 0) return;

            const currentIndex = focusableElements.indexOf(currentElement);

            // 次の要素のインデックスを計算
            const nextIndex = (currentIndex + 1) % focusableElements.length;

            // 次の要素にフォーカスを移動
            focusableElements[nextIndex].focus();
        }
        // '-' キーが押された場合
        else if (e.key === '-') {
            const activeElement = document.activeElement;
            // INPUT または TEXTAREA 要素にフォーカスがある場合のみ実行
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                // テキスト入力系の input type かどうかをもう少し限定する場合
                const textInputTypes = ['text', 'password', 'email', 'number', 'search', 'tel', 'url'];
                if (activeElement.tagName === 'TEXTAREA' || (activeElement.tagName === 'INPUT' && textInputTypes.includes(activeElement.type.toLowerCase())) ) {
                    e.preventDefault(); // '-' の入力を防ぐ

                    const inputElement = activeElement;
                    const start = inputElement.selectionStart;
                    const end = inputElement.selectionEnd;
                    const value = inputElement.value;

                    if (start === end && start > 0) {
                        // カーソルがあり、先頭でない場合: カーソルの前の1文字を削除
                        inputElement.value = value.substring(0, start - 1) + value.substring(end);
                        inputElement.setSelectionRange(start - 1, start - 1); // カーソル位置を更新
                    } else if (start < end) {
                        // テキストが選択されている場合: 選択範囲を削除
                        inputElement.value = value.substring(0, start) + value.substring(end);
                        inputElement.setSelectionRange(start, start); // カーソル位置を選択開始位置に更新
                    }
                    // カーソルが先頭にある場合などは何もしない
                     const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                     inputElement.dispatchEvent(inputEvent);
                }
            }
        }
    });
    // ウインドウクリックで整理券番号にフォーカスを合わせる
    document.addEventListener('click', (e) => {
        if (!e.target.closest('input, button, select, a, textarea, label')) {
            if (ticketNumberInput && ticketNumberInput.offsetParent !== null) {
                ticketNumberInput.focus();
            }
        }
    });

});


// 必要に応じて、チャンネルリストを更新する関数 (例)
async function updateChannelList() {
    // ここにチャンネルリストを取得し、<select>要素を更新する処理を記述
    console.log('Updating channel list...');
    // 例: fetch('/api/channels').then(...).then(...)
    // 更新が完了したら Promise を resolve するか、完了を示すイベントを発火させる
}

// --- API通信 (変更なし) ---
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, options);
        const data = await response.json(); // エラー時もJSONを期待する設計
        if (!response.ok) {
            // APIからのエラーメッセージがあれば使う
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error('API Call Error:', error);
        // エラーオブジェクトに詳細情報を含める (可能であれば)
        if (error instanceof Response) { // fetchがResponseオブジェクトを直接スローする場合
                try {
                    const errData = await error.json();
                    error.message = errData.message || error.statusText;
                } catch (parseError) {
                // JSONパース失敗
                }
        }
        throw error; // エラーを再スローして呼び出し元で処理
    }
}

// --- チャンネルリスト処理 (変更なし) ---
function populateChannelList(channelNames) {
    channelSelect.innerHTML = '<option value="">-- チャンネルを選択 --</option>'; // 初期オプション
    if (Array.isArray(channelNames)) { // 配列であることを確認
        channelNames.sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name; option.textContent = name; channelSelect.appendChild(option);
        });
    } else {
            console.error("受信したチャンネルリストが配列ではありません:", channelNames);
            // エラー表示など
    }
}

async function fetchChannelList() {
    console.log("チャンネルリストを要求中...");
    announcementStatus.textContent = 'チャンネルリストを読込中...'; // ユーザーにフィードバック
    announcementStatus.className = '';
    try {
        const channelNames = await apiCall('/api/channels'); // GETリクエスト
        console.log('チャンネルリスト受信:', channelNames);
        populateChannelList(channelNames);
        announcementStatus.textContent = ''; // 成功したらメッセージを消す
    } catch (error) {
        announcementStatus.textContent = `リスト取得エラー: ${error.message || 'サーバーとの通信に失敗しました。'}`;
        announcementStatus.className = 'error';
    }
}

// --- UIイベントリスナー (変更なし) ---
refreshChannelsBtn.addEventListener('click', (e) => {
        e.preventDefault(); // ボタンのデフォルト動作を防ぐ
        fetchChannelList();
});

announceButton.addEventListener('click', async (e) => {
    e.preventDefault();
    const channelName = channelSelect.value;
    const password = channelPasswordInput.value;
    const ticketNumber = ticketNumberInput.value;
    const roomNumber = selectedRoom;

    // --- 入力チェック (変更なし) ---
    if (!channelName || !password || !ticketNumber || !roomNumber) {
        announcementStatus.textContent = 'エラー: 全ての項目を入力/選択してください。';
        announcementStatus.className = 'error';
        return;
    }

    announcementStatus.textContent = 'アナウンスを送信中...';
    announcementStatus.className = ''; // ステータスクラスリセット

    try {
        const result = await apiCall('/api/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName, password, ticketNumber, roomNumber })
        });
        announcementStatus.textContent = result.message || 'アナウンスを送信しました。';
        announcementStatus.className = 'success';
            // フォームの内容をリセット (任意)
            // ticketNumberInput.value = '';
            // roomButtonsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
            // selectedRoom = null;
        setTimeout(() => announcementStatus.textContent = '', 5000); // 少し長めに表示
    } catch (error) {
        announcementStatus.textContent = `送信エラー: ${error.message || 'サーバーとの通信に失敗しました。'}`;
        announcementStatus.className = 'error';
    }
});

toggleCreateChannelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        createChannelDialog.classList.toggle('hidden');
        toggleCreateChannelBtn.textContent = createChannelDialog.classList.contains('hidden') ? '新しいチャンネルを作成' : 'チャンネル作成を閉じる';
});

// --- 初期化 ---
fetchChannelList(); // ページ読み込み時にリスト取得
