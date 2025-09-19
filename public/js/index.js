// --- DOM要素（DOMContentLoaded後に初期化） ---
let ticketNumberInput, roomButtonsContainer, announceJapaneseButton, announceEnglishButton, announceChineseButton, announcementStatus;
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
    announceJapaneseButton = document.getElementById('announceJapaneseButton');
    announceEnglishButton = document.getElementById('announceEnglishButton');
    announceChineseButton = document.getElementById('announceChineseButton'); // 追加
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

// 言語を指定してアナウンス実行
async function announceWithLanguage(language) {
    const ticketNumber = ticketNumberInput.value.trim();
    const roomNumber = selectedRoom;

    // 入力検証
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

    // ボタンを無効化
    if(announceJapaneseButton) announceJapaneseButton.disabled = true;
    if(announceEnglishButton) announceEnglishButton.disabled = true;
    if(announceChineseButton) announceChineseButton.disabled = true;
    
    const languageText = language === 'japanese' ? '日本語' : (language === 'english' ? '英語' : '中国語');
    announcementStatus.textContent = `${languageText}でアナウンス送信中...`;
    announcementStatus.className = '';

    try {
        const result = await apiCall('/api/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channelName: currentChannelName,
                password: currentChannelPassword,
                ticketNumber,
                roomNumber,
                language: language
            })
        });
        
        announcementStatus.textContent = result.message || `${languageText}でアナウンスを送信しました。`;
        announcementStatus.className = 'success';
        
        setTimeout(() => announcementStatus.textContent = '', 5000);
    } catch (error) {
        announcementStatus.textContent = `送信エラー: ${error.message || 'サーバーとの通信に失敗しました。'}`;
        announcementStatus.className = 'error';
    } finally {
        // ボタンを有効化
        if(announceJapaneseButton) announceJapaneseButton.disabled = false;
        if(announceEnglishButton) announceEnglishButton.disabled = false;
        if(announceChineseButton) announceChineseButton.disabled = false;
    }
}

// --- モーダル関連の関数 ---
function openChannelModal() {
    channelModal.style.display = 'block';
    loadChannelsToModal();
    if (currentChannelName) {
        modalChannelSelect.value = currentChannelName;
        modalChannelPassword.value = currentChannelPassword || '';
    }
}

function closeChannelModal() {
    channelModal.style.display = 'none';
    modalStatus.textContent = '';
    modalStatus.className = 'modal-status';
}

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

function showModalStatus(message, type = '') {
    modalStatus.textContent = message;
    modalStatus.className = `modal-status ${type}`;
}

async function testConnection() {
    const channelName = modalChannelSelect.value;
    const password = modalChannelPassword.value;

    if (!channelName || !password) {
        showModalStatus('チャンネルとパスワードを入力してください。', 'error');
        return;
    }

    showModalStatus('接続をテスト中...', '');

    try {
        const response = await fetch('/api/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName, password, ticketNumber: '0', roomNumber: '1' })
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

function saveChannelSettings() {
    const channelName = modalChannelSelect.value;
    const password = modalChannelPassword.value;

    if (!channelName || !password) {
        showModalStatus('チャンネルとパスワードを入力してください。', 'error');
        return;
    }

    localStorage.setItem('selectedChannel', channelName);
    localStorage.setItem('channelPassword', password);

    currentChannelName = channelName;
    currentChannelPassword = password;

    updateChannelBubble();
    onChannelChange();

    showModalStatus('設定を保存しました！', 'success');
    setTimeout(() => closeChannelModal(), 1000);
}

function updateChannelBubble() {
    if (currentChannelName) {
        channelBubbleText.textContent = currentChannelName;
        channelBubble.classList.remove('not-connected');
    } else {
        channelBubbleText.textContent = 'チャンネル未選択';
        channelBubble.classList.add('not-connected');
    }
}

// --- API通信 ---
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, options);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error('API Call Error:', error);
        if (error instanceof Response) {
            try {
                const errData = await error.json();
                error.message = errData.message || error.statusText;
            } catch (parseError) {}
        }
        throw error;
    }
}

// --- チャンネル設定関連 ---
async function fetchChannelDetails() {
    try {
        const response = await fetch('/api/channel-details');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return await response.json();
    } catch (error) {
        console.error('チャンネル詳細情報取得エラー:', error.message);
        return [];
    }
}

async function onChannelChange() {
    if (!currentChannelName) {
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
            generateRoomButtons(7, true);
            currentChannelConfig = null;
        }
    } catch (error) {
        console.error('チャンネル設定取得エラー:', error);
        generateRoomButtons(7, true);
        currentChannelConfig = null;
    }
}

// --- イベントリスナー設定 ---
function setupEventListeners() {
    if (channelBubble) channelBubble.addEventListener('click', openChannelModal);
    if (modalClose) modalClose.addEventListener('click', closeChannelModal);
    if (modalRefreshChannels) modalRefreshChannels.addEventListener('click', (e) => { e.preventDefault(); loadChannelsToModal(); });
    if (modalTestConnection) modalTestConnection.addEventListener('click', testConnection);
    if (modalSaveChannel) modalSaveChannel.addEventListener('click', saveChannelSettings);
    if (channelModal) channelModal.addEventListener('click', (e) => { if (e.target === channelModal) closeChannelModal(); });

    // 各アナウンスボタン
    if (announceJapaneseButton) announceJapaneseButton.addEventListener('click', () => announceWithLanguage('japanese'));
    if (announceEnglishButton) announceEnglishButton.addEventListener('click', () => announceWithLanguage('english'));
    if (announceChineseButton) announceChineseButton.addEventListener('click', () => announceWithLanguage('chinese'));
}

// --- 初期化 ---
function initializeApp() {
    initializeDOM();
    setupEventListeners();
    generateRoomButtons(7, true);

    const savedChannel = localStorage.getItem('selectedChannel');
    const savedPassword = localStorage.getItem('channelPassword');

    if (savedChannel && savedPassword) {
        currentChannelName = savedChannel;
        currentChannelPassword = savedPassword;
        updateChannelBubble();
        onChannelChange();
    } else {
        updateChannelBubble();
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);