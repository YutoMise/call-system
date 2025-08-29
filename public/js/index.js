
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

// --- 診察室ボタン生成（動的） ---
let currentChannelConfig = null;

// 診察室ボタンを動的に生成する関数
function generateRoomButtons(roomCount, useReception) {
    // 既存のボタンをクリア
    roomButtonsContainer.innerHTML = '';
    selectedRoom = null;

    // 診察室ボタンを生成
    for (let i = 1; i <= roomCount; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.dataset.room = i;
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

    // 受付ボタンを生成（useReceptionがtrueの場合のみ）
    if (useReception) {
        const receptionButton = document.createElement('button');
        receptionButton.textContent = '受付';
        receptionButton.dataset.room = 'reception';
        receptionButton.addEventListener('click', (event) => {
            event.preventDefault(); // フォーム送信を防ぐ
            // すべてのボタンから 'selected' クラスを削除
            roomButtonsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
            // クリックされたボタンに 'selected' クラスを追加
            receptionButton.classList.add('selected');
            selectedRoom = receptionButton.dataset.room; // 選択された部屋番号を保持
        });
        roomButtonsContainer.appendChild(receptionButton);
    }
}

// デフォルトの診察室ボタンを生成（初期表示用）
generateRoomButtons(7, true);

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
            // ★変更点: フォーカスが ticketNumberInput にある場合のみ実行
            if (document.activeElement === ticketNumberInput) {
                e.preventDefault(); // '-' の入力を防ぐ

                const inputElement = ticketNumberInput; // 対象を明示
                const start = inputElement.selectionStart;
                const end = inputElement.selectionEnd;
                // type="number" でも .value は文字列として取得・設定できることが多い
                const value = inputElement.value;

                let newValue = value;
                let newCursorPos = start;

                if (start === end && start > 0) {
                    // カーソルがあり、先頭でない場合: カーソルの前の1文字を削除
                    newValue = value.substring(0, start - 1) + value.substring(end);
                    newCursorPos = start - 1;
                } else if (start < end) {
                    // テキストが選択されている場合: 選択範囲を削除
                    newValue = value.substring(0, start) + value.substring(end);
                    newCursorPos = start;
                }

                // 値を更新
                // type="number" の場合、非数値が設定されると空文字になることがあるため注意
                // この Backspace 操作では通常問題ないはず
                inputElement.value = newValue;

                // カーソル位置を設定 (requestAnimationFrame を使うとより確実な場合がある)
                // setTimeout(() => inputElement.setSelectionRange(newCursorPos, newCursorPos), 0);
                // 通常は直接設定で問題ないことが多い
                inputElement.setSelectionRange(newCursorPos, newCursorPos);


                // inputイベントを手動で発火させる
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                inputElement.dispatchEvent(inputEvent);
            }
            // 他の input や textarea では '-' キーによる Backspace は動作しない
        }
    });
    if (ticketNumberInput && ticketNumberInput.type === 'text') {
        ticketNumberInput.addEventListener('beforeinput', (e) => {
            console.log('BeforeInput Event:', e.inputType, e.data); // デバッグ用

            // デフォルトで許可する操作タイプ (削除、選択など)
            const allowedInputTypes = [
                'deleteContentBackward', // Backspace
                'deleteContentForward',  // Delete
                'deleteByCut',
                'deleteByDrag',
                'historyUndo',
                'historyRedo'
                // 他にも許可したい操作があれば追加 (例: insertFromDrop)
            ];

            // insert* 系のイベントでなければ基本的に許可 (削除などは止めない)
            // ※ '-' キーによる Backspace は keydown で処理されるため、
            //   ここでの deleteContentBackward は通常の Backspace キーに対応
            if (!e.inputType.startsWith('insert') && !allowedInputTypes.includes(e.inputType)) {
                 // 上記リストに含まれない非挿入系操作も許可する場合が多い
                 // return;
            } else if (e.inputType.startsWith('insert')) {
                // 挿入系のイベントの場合、挿入されるデータ(e.data)をチェック
                if (e.data != null) {
                     // e.data に数字(0-9)以外の文字が含まれているかチェック
                     if (!/^[0-9]+$/.test(e.data)) {
                         // 数字以外の文字が含まれていたら、入力をキャンセル
                         console.log(`BeforeInput: Preventing insertion of non-numeric data "${e.data}"`);
                         e.preventDefault();
                     }
                     // 数字のみの場合は preventDefault しないので入力が許可される
                 }
                 // e.data が null の場合 (ペースト以外での特殊な入力など) は、
                 // 必要に応じて inputType でさらに細かく制御することも可能
                 // 例: else if (e.inputType === 'insertFromPaste') { /* ペースト処理 */ }
            }
        });
    }
    // ウインドウクリックで整理券番号にフォーカスを合わせる
    document.addEventListener('click', (e) => {
        if (!e.target.closest('input, button, select, a, textarea, label')) {
            if (ticketNumberInput && ticketNumberInput.offsetParent !== null) {
                ticketNumberInput.focus();
            }
        }
    });
    
    // (ここから下は元々2つ目のDOMContentLoaded内にあったチュートリアル機能です)
    // 必要に応じて、チャンネルリストを更新する関数 (例)
    async function updateChannelList() { // この関数はチュートリアルとは直接関係ありませんが、元の位置関係を維持
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

// チャンネル詳細情報を取得する関数
async function fetchChannelDetails() {
    try {
        const response = await fetch('/api/channel-details');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const channelDetails = await response.json();
        return channelDetails;
    } catch (error) {
        console.error('チャンネル詳細情報取得エラー:', error.message);
        return [];
    }
}

// チャンネル選択時の処理
async function onChannelChange() {
    const selectedChannelName = channelSelect.value;
    if (!selectedChannelName) {
        // チャンネルが選択されていない場合はデフォルト設定
        generateRoomButtons(7, true);
        currentChannelConfig = null;
        return;
    }

    try {
        const channelDetails = await fetchChannelDetails();
        const channelConfig = channelDetails.find(ch => ch.name === selectedChannelName);

        if (channelConfig) {
            currentChannelConfig = channelConfig;
            generateRoomButtons(channelConfig.roomCount || 7, channelConfig.useReception !== false);
        } else {
            // 設定が見つからない場合はデフォルト設定
            generateRoomButtons(7, true);
            currentChannelConfig = null;
        }
    } catch (error) {
        console.error('チャンネル設定取得エラー:', error);
        // エラーの場合はデフォルト設定
        generateRoomButtons(7, true);
        currentChannelConfig = null;
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

// --- UIイベントリスナー ---
// チャンネル選択時のイベントリスナー
channelSelect.addEventListener('change', onChannelChange);

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

// --- 初期化 ---
fetchChannelList(); // ページ読み込み時にリスト取得

    
    // Tutorial Feature
    const tutorialButton = document.getElementById('tutorialButton');
    const tutorialOverlay = document.getElementById('tutorialOverlay');
    const tutorialTooltip = document.getElementById('tutorialTooltip');
    const tutorialText = document.getElementById('tutorialText');
    const tutorialNext = document.getElementById('tutorialNext');
    const tutorialPrev = document.getElementById('tutorialPrev');
    const tutorialEnd = document.getElementById('tutorialEnd');

    let currentTutorialStep = 0;
    let highlightedElement = null;
    // To store original styles of the highlighted element if needed (e.g. z-index, position)
    let originalStyles = { zIndex: '', position: '' }; 

    const tutorialSteps = [
        { selector: 'header .sender-button.current-page', text: 'ここは「送信側」ページです。整理券番号や診察室を指定して、呼び出しアナウンスを送信します。' },
        { selector: 'header .receiver-button', text: '「受信側」ページへのリンクです。音声アナウンスの再生やログ確認はこちらで行います。' },
        { selector: '#channel-selection-group', text: 'アナウンスを送信する「チャンネル」を選択します。受信側と同じチャンネルを選んでください。右の「更新」ボタンでチャンネルリストを最新にできます。' },
        { selector: '#password-input-group', text: '選択したチャンネルの「パスワード」を入力します。受信側と一致している必要があります。' },
        { selector: '#ticket-number-input-group', text: '呼び出す「整理券番号」を数字で入力します。' },
        { selector: '#roomButtons', text: '呼び出し先の「診察室番号」を選択します。選択した番号がアナウンス内容に含まれます。' },
        { selector: '#announceButton', text: '入力・選択した内容で「アナウンス開始」します。クリックすると受信側で音声が再生されます。' },
        { selector: '#announcement-status', text: 'アナウンスの送信状況（成功・失敗など）がここに表示されます。' }
    ];

    function clearHighlight() {
        if (highlightedElement) {
            highlightedElement.classList.remove('tutorial-highlight');
            // Restore original styles if they were changed
            highlightedElement.style.zIndex = originalStyles.zIndex;
            highlightedElement.style.position = originalStyles.position;
            highlightedElement = null;
        }
    }

    function showTutorialStep(stepIndex) {
        clearHighlight();

        if (stepIndex < 0 || stepIndex >= tutorialSteps.length) {
            endTutorial();
            return;
        }

        currentTutorialStep = stepIndex;
        const step = tutorialSteps[stepIndex];
        const element = document.querySelector(step.selector);

        if (!element) {
            console.warn(`Tutorial element not found: ${step.selector}. Skipping.`);
            if (tutorialNext.textContent === '完了') {
                 endTutorial();
            } else {
                 showTutorialStep(stepIndex + (tutorialNext.textContent === '次へ' ? 1 : -1)); // Try to proceed
            }
            return;
        }
        
        highlightedElement = element;
        // Store original styles before applying highlight class, especially if .tutorial-highlight changes them
        originalStyles.zIndex = element.style.zIndex;
        originalStyles.position = element.style.position;

        element.classList.add('tutorial-highlight');
        
        // ヘッダーのボタンでない場合のみスクロールする
        const isHeaderButton = element.matches('header .page-button');
        if (!isHeaderButton) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }

        tutorialText.textContent = step.text;
        tutorialTooltip.style.display = 'block';

        const rect = element.getBoundingClientRect();
        const tooltipRect = tutorialTooltip.getBoundingClientRect();

        let tooltipTop = window.scrollY + rect.bottom + 15; // 15px below the element
        let tooltipLeft = window.scrollX + rect.left + (rect.width / 2) - (tooltipRect.width / 2); // Centered

        // Adjust if tooltip goes off-screen
        if (tooltipLeft < 10) tooltipLeft = 10;
        if (tooltipLeft + tooltipRect.width > window.innerWidth - 10) {
            tooltipLeft = window.innerWidth - tooltipRect.width - 10;
        }
        if (tooltipTop + tooltipRect.height > window.innerHeight + window.scrollY - 10) { // Check bottom edge
            tooltipTop = window.scrollY + rect.top - tooltipRect.height - 15; // Place above
        }
         if (tooltipTop < window.scrollY + 10) { // Check top edge
            tooltipTop = window.scrollY + 10;
        }

        tutorialTooltip.style.top = `${tooltipTop}px`;
        tutorialTooltip.style.left = `${tooltipLeft}px`;

        tutorialPrev.disabled = stepIndex === 0;
        tutorialNext.textContent = (stepIndex === tutorialSteps.length - 1) ? '完了' : '次へ';
    }

    function startTutorial() {
        if (!tutorialOverlay || !tutorialTooltip) return;
        tutorialOverlay.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        currentTutorialStep = 0;
        showTutorialStep(currentTutorialStep);
    }

    function endTutorial() {
        if (!tutorialOverlay || !tutorialTooltip) return;
        clearHighlight();
        tutorialOverlay.style.display = 'none';
        tutorialTooltip.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }

    if (tutorialButton) {
        tutorialButton.addEventListener('click', startTutorial);
    }

    if (tutorialNext) {
        tutorialNext.addEventListener('click', () => {
            if (currentTutorialStep === tutorialSteps.length - 1) {
                endTutorial();
            } else {
                showTutorialStep(currentTutorialStep + 1);
            }
        });
    }
    
    if (tutorialPrev) {
        tutorialPrev.addEventListener('click', () => {
            if (currentTutorialStep > 0) {
                showTutorialStep(currentTutorialStep - 1);
            }
        });
    }

    if (tutorialEnd) {
        tutorialEnd.addEventListener('click', endTutorial);
    }
    
    if (tutorialOverlay) {
        tutorialOverlay.addEventListener('click', function(event) {
            // Close only if the overlay itself (not the tooltip) is clicked
            if (event.target === tutorialOverlay) { 
                endTutorial();
            }
        });
    }

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && tutorialOverlay && tutorialOverlay.style.display === 'block') {
            endTutorial();
        }
    });
    // (ここまでが元々2つ目のDOMContentLoaded内にあったチュートリアル機能です)
}); // 最初のDOMContentLoadedの閉じ括弧