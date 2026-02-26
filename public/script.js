// =========================
// My Smile Bot - script.js
// =========================
// Add this at the very top of script.js

let ws;

let currentSector = 'Education';

document.addEventListener('DOMContentLoaded', () => {
    initialiseWebsocket();
    initializemodals();
    initializeSectors();
    initializeInputHandlers();
    initializeVoiceInput();
    initializeFileUpload();
    setupBackendConnection();
    restoreChatFromStorage();
});
// ===== 1. WebSocket Connection =====
function initialiseWebsocket() {
    // Use same-origin WebSocket URL so it works in production behind HTTPS (wss) or http (ws)
    try {
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = location.host; // includes port if present
        const wsUrl = `${wsProtocol}//${wsHost}`;
        ws = new WebSocket(wsUrl);
    } catch (err) {
        console.error('Failed to initialize WebSocket URL:', err);
        ws = new WebSocket('ws://localhost:3000'); // fallback for local dev
    }

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        document.querySelector('.status-dot').style.backgroundColor = '#00ff00';
    };

    ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        document.querySelector('.status-dot').style.backgroundColor = '#ff0000';
        setTimeout(initialiseWebsocket, 3000); // auto-reconnect
    };

    ws.onmessage = (event) => {
        try {
            const response = JSON.parse(event.data);
            if (response.type === 'ai_response') {
                hideTypingIndicator();
                addToChat('bot', formatResponse(response.results));
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    window.ws = ws; // expose globally

}

function initializemodals() {
    const modals = [
        {
            id: 'moviesModal',
            btnId: 'moviesBtn',
            closeClass: 'close-movies'
        },
        {
            id: 'funwhileModal',
            btnSelector: '[data-sector="Funwhile"]',
            closeClass: 'close-funwhile'
        },
        {
            id: 'bibleModal',
            btnId: 'bibleBtn',
            closeClass: 'close-bible'
        },
        {
            id: 'calculatorModal',
            btnId: 'calculatorBtn',
            closeClass: 'close-calculator'
        }
    ];

    modals.forEach(modal => {
        const modalElement = document.getElementById(modal.id);
        const btn = modal.btnId ? 
            document.getElementById(modal.btnId) : 
            document.querySelector(modal.btnSelector);
        const closeBtn = document.querySelector(`.${modal.closeClass}`);

        if (modalElement) {
            // Set up button click handler
            if (btn) {
                btn.addEventListener('click', () => {
                    modalElement.style.display = 'block';
                });
            }

            // Set up close button handler
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modalElement.style.display = 'none';
                });
            }

            // Close on outside click
            modalElement.addEventListener('click', (event) => {
                if (event.target === modalElement) {
                    modalElement.style.display = 'none';
                }
            });
        }
    });

    // Global ESC key handler for all modals
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            modals.forEach(modal => {
                const modalElement = document.getElementById(modal.id);
                if (modalElement && modalElement.style.display === 'block') {
                    modalElement.style.display = 'none';
                }
            });
        }
    });
}

// close by clicking outside 
 window.addEventListener('click', (event) => {
        if (event.target === moviesModal) moviesModal.style.display = 'none';
        if (event.target === funwhileModal) funwhileModal.style.display = 'none';
        if (event.target === bibleModal) bibleModal.style.display = 'none';
        if (event.target === calculatorModal) calculatorModal.style.display = 'none';
    });

function handleBibleClick() {
    const bibleModal = document.getElementById('bibleModal');
    if (bibleModal) {
        bibleModal.style.display = 'block';
    }
}
function initializeSectors() {
    const sectors = document.querySelectorAll('.sector');
    sectors.forEach(sector => {
        // Make sure each has a data-sector attribute
        if (!sector.dataset.sector) {
            sector.dataset.sector = sector.textContent.trim();
        } 

        sector.addEventListener('click', () => {
            // Remove active class from all sectors
            sectors.forEach(s => s.classList.remove('active'));
            // Add active class to clicked sector
            sector.classList.add('active');
            // Update current sector
            currentSector = sector.dataset.sector;

            // Handle special sectors with modals
            switch(currentSector) {
                case 'Movies':
                    const moviesModal = document.getElementById('moviesModal');
                    if (moviesModal) moviesModal.style.display = 'block';
                    break;
                case 'Funwhile':
                    const funwhileModal = document.getElementById('funwhileModal');
                    if (funwhileModal) funwhileModal.style.display = 'block';
                    break;
                case 'Bible':
                    const bibleModal = document.getElementById('bibleModal');
                    if (bibleModal) bibleModal.style.display = 'block';
                    break;
                case 'Calculator':
                    const calculatorModal = document.getElementById('calculatorModal');
                    if (calculatorModal) calculatorModal.style.display = 'block';
                    break;
                default:
                    // For all other sectors, just show the sector change message
                    animateSectorChange(sector);
                    addToChat('bot', `Switched to <strong>${currentSector}</strong> mode. How can I help you?`);
            }
        });
    });
}

// ===== 2. Safe Ripple Animation =====
function animateSectorChange(sector) {
    const ripple = sector.querySelector('.hover-effect');
    if (ripple) {
        ripple.style.animation = 'none';
        ripple.offsetHeight; // reflow
        ripple.style.animation = 'ripple 0.6s ease-out';
    }
}

// ===== 3. Chat Persistence =====
function saveChatToStorage() {
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        localStorage.setItem('chatHistory', chatBox.innerHTML);
    }
}

function restoreChatFromStorage() {
    const chatBox = document.getElementById('chat-box');
    const savedChat = localStorage.getItem('chatHistory');
    if (chatBox && savedChat) {
        chatBox.innerHTML = savedChat;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// ===== 4. Backend Test =====
function setupBackendConnection() {
    // Use relative path so it works whether served from the same origin or deployed behind a domain
    fetch('/test')
        .then(response => response.json())
        .then(data => console.log('Backend connected:', data))
        .catch(error => console.error('Backend connection failed:', error));
}

// ===== Input + Sending =====
function initializeInputHandlers() {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.querySelector('.send-btn');

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (userInput) {
        userInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }
}

// ===== Message Sending =====
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.querySelector('.send-btn');
    const message = userInput.value.trim();
    
    if (!message) return;

    // Handle special sectors first
    if (['Movies', 'Funwhile', 'Bible', 'Calculator'].includes(currentSector)) {
        addToChat('user', message);
        userInput.value = '';
        switch(currentSector) {
            case 'Movies':
                handleMovieClick();
                break;
            case 'Funwhile':
                handleFunwhileClick();
                break;
            case 'Bible':
                handleBibleClick();
                break;
            case 'Calculator':
                const calculatorModal = document.getElementById('calculatorModal');
                if (calculatorModal) calculatorModal.style.display = 'block';
                break;
        }
        return;
    }

    // Disable input while processing
    userInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    
    // Add user message to chat
    addToChat('user', message);
    userInput.value = '';
    showTypingIndicator();

    // Send via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'ai_query',
            query: message,
            sector: currentSector
        }));
    } else {
        console.error('WebSocket is not connected');
        hideTypingIndicator();
        addToChat('bot-error', '⚠️ <strong>Error:</strong> Connection lost. Reconnecting...');
        initialiseWebsocket();
        enableInput(userInput, sendBtn);
        return;
    }

    // Re-enable input
    enableInput(userInput, sendBtn);
}

function enableInput(userInput, sendBtn) {
    userInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    userInput.focus();
}

// ===== Add Messages to Chat =====
function addToChat(sender, text) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const div = document.createElement('div');
    div.classList.add('message');

    if (sender === 'user') div.classList.add('user');
    else if (sender === 'bot-error') div.classList.add('bot', 'error');
    else div.classList.add('bot');

    div.innerHTML = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    saveChatToStorage();
}

// ===== Typing Indicator =====
function showTypingIndicator() {
    addToChat('bot', '<em>⏳ Smile Bot is typing...</em>');
}

function hideTypingIndicator() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;
    const indicators = chatBox.querySelectorAll('em');
    indicators.forEach(indicator => indicator.parentElement.remove());
}

// ===== Movie Sector Options =====
function handleMovieClick() {
    const chatBox = document.getElementById('chat-box');
    const messageHTML = `
        <div class="message bot">
            🎬 Where would you like to watch movies or reels?
            <div class="movie-options">
                <button onclick="openYouTubeMovies()">YouTube Movies</button>
                <button onclick="openTikTokReels()">TikTok Reels</button>
                <button onclick="openVimeo()">Vimeo</button>
            </div>
        </div>`;
    chatBox.insertAdjacentHTML('beforeend', messageHTML);
    chatBox.scrollTop = chatBox.scrollHeight;
    saveChatToStorage();
}

// ===== External Movie Links =====
function openYouTubeMovies() { window.open('https://www.youtube.com/movies', '_blank'); }
function openTikTokReels() { window.open('https://www.tiktok.com/explore', '_blank'); }
function openVimeo() { window.open('https://vimeo.com/watch', '_blank'); }

// ===== Format Bot Response =====
function formatResponse(data) {
    if (typeof data === 'string') return data;
    if (data.message) return data.message;
    if (data.response) return data.response;
    if (data.reply) return data.reply;
    if (data.error) return `❌ ${data.error}`;
    return JSON.stringify(data);
}

/* ===== Modal, Voice Input, File Upload Functions remain unchanged ===== */
// ...existing code...

// ===== Funwhile Sector Options =====
function handleFunwhileClick() {
    const chatBox = document.getElementById('chat-box');
    const messageHTML = `
        <div class="message bot">
            🎮 Ready to play some games?
            <div class="funwhile-options">
                <button onclick="openCrazyGames()" class="funwhile-btn crazy-btn">
                    <i class="fas fa-gamepad"></i>
                    <span>CrazyGames</span>
                </button>
                <button onclick="openPokiGames()" class="funwhile-btn poki-btn">
                    <i class="fas fa-dice"></i>
                    <span>Poki Games</span>
                </button>
            </div>
        </div>`;
    chatBox.insertAdjacentHTML('beforeend', messageHTML);
    chatBox.scrollTop = chatBox.scrollHeight;
    saveChatToStorage();
}

// ===== External Gaming Links =====
function openCrazyGames() { window.open('https://www.crazygames.com', '_blank', 'noopener,noreferrer'); }
function openPokiGames() { window.open('https://poki.com', '_blank', 'noopener,noreferrer'); }

/* ===== Modal, Voice Input, File Upload Functions remain unchanged ===== */