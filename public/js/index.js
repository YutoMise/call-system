
// --- DOM要素（DOMContentLoaded後に初期化） ---
let ticketNumberInput, roomButtonsContainer, announceButton, announcementStatus;
let channelBubble, channelBubbleText;
let channelModal, modalChannelSelect, modalRefreshChannels, modalChannelPassword;
let modalTestConnection, modalSaveChannel, modalClose, modalStatus;
let selectedRoom = null;

// --- グローバル変数 ---
let currentChannelConfig = null;
let currentChannelName = null;
let currentChannelPassword = null;

// DOM要素を初期化する関数
function initializeDOM() {
    // メイン画面要素
    ticketNumberInput = document.getElementById('ticketNumber');
    roomButtonsContainer = document.getElementById('roomButtons');
    announceButton = document.getElementById('announceButton');
    announcementStatus = document.getElementById('announcement-status');

    // チャンネル吹き出しボタン
    channelBubble = document.getElementById('channelBubble');
    channelBubbleText = document.getElementById('channelBubbleText');

    // モーダル要素
    channelModal = document.getElementById('channelModal');
    modalChannelSelect = document.getElementById('modalChannelSelect');
    modalRefreshChannels = document.getElementById('modalRefreshChannels');
    modalChannelPassword = document.getElementById('modalChannelPassword');
    modalTestConnection = document.getElementById('modalTestConnection');
    modalSaveChannel = document.getElementById('modalSaveChannel');
    modalClose = document.querySelector('.modal-close');
    modalStatus = document.getElementById('modalStatus');
}

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



// --- モーダル関連の関数 ---
// モーダルを開く
function openChannelModal() {
    channelModal.style.display = 'block';
    loadChannelsToModal();

    // 現在の設定を復元
    if (currentChannelName) {
        modalChannelSelect.value = currentChannelName;
        modalChannelPassword.value = currentChannelPassword || '';
    }
}

// モーダルを閉じる
function closeChannelModal() {
    channelModal.style.display = 'none';
    modalStatus.textContent = '';
    modalStatus.className = 'modal-status';
}

// モーダルにチャンネルリストを読み込む
async function loadChannelsToModal() {
    try {
        const channelNames = await apiCall('/api/channels');
        modalChannelSelect.innerHTML = '<option value="">-- チャンネルを選択 --</option>';
        if (Array.isArray(channelNames)) {
            channelNames.sort().forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                modalChannelSelect.appendChild(option);
            });
        }
    } catch (error) {
        showModalStatus('チャンネルリストの取得に失敗しました。', 'error');
    }
}

// モーダルステータス表示
function showModalStatus(message, type = '') {
    modalStatus.textContent = message;
    modalStatus.className = `modal-status ${type}`;
}

// 接続テスト
async function testConnection() {
    const channelName = modalChannelSelect.value;
    const password = modalChannelPassword.value;

    if (!channelName || !password) {
        showModalStatus('チャンネルとパスワードを入力してください。', 'error');
        return;
    }

    showModalStatus('接続をテスト中...', '');

    try {
        // テスト用のアナウンス送信（実際には送信しない）
        const response = await fetch('/api/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channelName,
                password,
                ticketNumber: '0',
                roomNumber: '1'
            })
        });

        if (response.ok) {
            showModalStatus('接続に成功しました！', 'success');
        } else {
            const errorData = await response.json();
            showModalStatus(errorData.message || '接続に失敗しました。', 'error');
        }
    } catch (error) {
        showModalStatus('接続テストに失敗しました。', 'error');
    }
}

// チャンネル設定を保存
function saveChannelSettings() {
    const channelName = modalChannelSelect.value;
    const password = modalChannelPassword.value;

    if (!channelName || !password) {
        showModalStatus('チャンネルとパスワードを入力してください。', 'error');
        return;
    }

    // ローカルストレージに保存
    localStorage.setItem('selectedChannel', channelName);
    localStorage.setItem('channelPassword', password);

    // グローバル変数を更新
    currentChannelName = channelName;
    currentChannelPassword = password;

    // 吹き出しボタンを更新
    updateChannelBubble();

    // チャンネル設定に応じて診察室ボタンを更新
    onChannelChange();

    showModalStatus('設定を保存しました！', 'success');

    // 1秒後にモーダルを閉じる
    setTimeout(() => {
        closeChannelModal();
    }, 1000);
}

// チャンネル吹き出しボタンを更新
function updateChannelBubble() {
    if (currentChannelName) {
        channelBubbleText.textContent = currentChannelName;
        channelBubble.classList.remove('not-connected');
    } else {
        channelBubbleText.textContent = 'チャンネル未選択';
        channelBubble.classList.add('not-connected');
    }
}



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

// チャンネル選択時の処理（現在のチャンネル設定に基づく）
async function onChannelChange() {
    if (!currentChannelName) {
        // チャンネルが選択されていない場合はデフォルト設定
        generateRoomButtons(7, true);
        currentChannelConfig = null;
        return;
    }

    try {
        const channelDetails = await fetchChannelDetails();
        const channelConfig = channelDetails.find(ch => ch.name === currentChannelName);

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



// イベントリスナーを設定する関数
function setupEventListeners() {
    // チャンネル吹き出しボタンのイベントリスナー
    if (channelBubble) {
        channelBubble.addEventListener('click', openChannelModal);
    }

    // モーダル関連のイベントリスナー
    if (modalClose) {
        modalClose.addEventListener('click', closeChannelModal);
    }
    if (modalRefreshChannels) {
        modalRefreshChannels.addEventListener('click', (e) => {
            e.preventDefault();
            loadChannelsToModal();
        });
    }
    if (modalTestConnection) {
        modalTestConnection.addEventListener('click', testConnection);
    }
    if (modalSaveChannel) {
        modalSaveChannel.addEventListener('click', saveChannelSettings);
    }

    // モーダル外クリックで閉じる
    if (channelModal) {
        channelModal.addEventListener('click', (e) => {
            if (e.target === channelModal) {
                closeChannelModal();
            }
        });
    }

    // アナウンスボタンのイベントリスナー
    if (announceButton) {
        announceButton.addEventListener('click', handleAnnounceClick);
    }
}

// アナウンス処理関数
async function handleAnnounceClick(e) {
    e.preventDefault();
    const ticketNumber = ticketNumberInput.value;
    const roomNumber = selectedRoom;

    // --- 入力チェック ---
    if (!currentChannelName || !currentChannelPassword) {
        announcementStatus.textContent = 'エラー: チャンネル設定が必要です。上のボタンから設定してください。';
        announcementStatus.className = 'error';
        return;
    }

    if (!ticketNumber || !roomNumber) {
        announcementStatus.textContent = 'エラー: 整理券番号と診察室を入力/選択してください。';
        announcementStatus.className = 'error';
        return;
    }

    announcementStatus.textContent = 'アナウンスを送信中...';
    announcementStatus.className = ''; // ステータスクラスリセット

    try {
        const result = await apiCall('/api/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channelName: currentChannelName,
                password: currentChannelPassword,
                ticketNumber,
                roomNumber
            })
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
}

// --- 初期化 ---
// ページ読み込み時の初期化
function initializeApp() {
    // DOM要素を初期化
    initializeDOM();

    // イベントリスナーを設定
    setupEventListeners();

    // デフォルトの診察室ボタンを生成
    generateRoomButtons(7, true);

    // ローカルストレージから設定を復元
    const savedChannel = localStorage.getItem('selectedChannel');
    const savedPassword = localStorage.getItem('channelPassword');

    if (savedChannel && savedPassword) {
        currentChannelName = savedChannel;
        currentChannelPassword = savedPassword;
        updateChannelBubble();
        onChannelChange(); // チャンネル設定に応じて診察室ボタンを更新
    } else {
        updateChannelBubble(); // 未選択状態で表示
    }
}

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', initializeApp);

// Tutorial Feature
document.addEventListener('DOMContentLoaded', () => {
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
        { selector: '#channelBubble', text: 'チャンネル設定ボタンです。クリックしてチャンネルとパスワードを設定します。' },
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
});