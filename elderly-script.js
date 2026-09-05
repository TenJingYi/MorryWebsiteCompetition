let baseFontSize = 22;
let conversationHistory = [];
let isProcessing = false;

// ========== UI TRANSLATION ==========
// Covers the app's persistent "chrome" — home screen, settings panel, and
// screen titles — the text seen on nearly every screen. Deeper modal content
// (pill forms, game screens, call list) isn't translated yet; those remain
// English regardless of dialect for now. Hokkien/Hakka written forms below
// are a best-effort approximation — written conventions for these are less
// standardized than Mandarin/Cantonese/BM, so a native speaker review is
// worth doing before relying on these for a real launch.
const UI_TEXT = {
    english: {
        goodDay: 'Good Day!', back: 'BACK ◄',
        cardScan: 'Scan Medication', cardPills: 'My Pills', cardCall: 'Call',
        cardTalk: 'Talk to MORY', cardAlert: 'Alert', cardGames: 'Games',
        settingsTitle: 'Settings', textSize: 'Text Size',
        dialectLabel: '🗣️ Speaking Language / Dialect', gonkaLabel: 'Gonka:',
        testConnection: '🔌 Test Connection', quickTest: '💬 Quick Test', close: 'Close',
        pressToTalk: 'Press here to talk', talkToMoryTitle: 'Talk to MORY'
    },
    mandarin: {
        goodDay: '你好！', back: '返回 ◄',
        cardScan: '扫描药物', cardPills: '我的药物', cardCall: '通话',
        cardTalk: '和MORY说话', cardAlert: '紧急求助', cardGames: '游戏',
        settingsTitle: '设置', textSize: '文字大小',
        dialectLabel: '🗣️ 语言/方言', gonkaLabel: 'Gonka：',
        testConnection: '🔌 测试连接', quickTest: '💬 快速测试', close: '关闭',
        pressToTalk: '按这里说话', talkToMoryTitle: '和MORY说话'
    },
    cantonese: {
        goodDay: '你好！', back: '返回 ◄',
        cardScan: '掃描藥物', cardPills: '我嘅藥物', cardCall: '打電話',
        cardTalk: '同MORY傾偈', cardAlert: '緊急求助', cardGames: '遊戲',
        settingsTitle: '設定', textSize: '文字大細',
        dialectLabel: '🗣️ 語言/方言', gonkaLabel: 'Gonka：',
        testConnection: '🔌 測試連接', quickTest: '💬 快速測試', close: '關閉',
        pressToTalk: '撳呢度講嘢', talkToMoryTitle: '同MORY傾偈'
    },
    hokkien: {
        goodDay: '你好！', back: '返回 ◄',
        cardScan: '掃描藥仔', cardPills: '我的藥仔', cardCall: '拍電話',
        cardTalk: '佮MORY講話', cardAlert: '緊急求救', cardGames: '遊戲',
        settingsTitle: '設定', textSize: '字體大細',
        dialectLabel: '🗣️ 語言/腔口', gonkaLabel: 'Gonka：',
        testConnection: '🔌 測試連線', quickTest: '💬 緊來試', close: '關閉',
        pressToTalk: '揤遮講話', talkToMoryTitle: '佮MORY講話'
    },
    hakka: {
        goodDay: '你好！', back: '轉來 ◄',
        cardScan: '掃描藥仔', cardPills: '𠊎个藥仔', cardCall: '打電話',
        cardTalk: '同MORY講話', cardAlert: '緊急求救', cardGames: '遊戲',
        settingsTitle: '設定', textSize: '字體大細',
        dialectLabel: '🗣️ 語言/話', gonkaLabel: 'Gonka：',
        testConnection: '🔌 測試連線', quickTest: '💬 隨時試', close: '關咧',
        pressToTalk: '接𠊎講話', talkToMoryTitle: '同MORY講話'
    },
    bm: {
        goodDay: 'Selamat Sejahtera!', back: 'KEMBALI ◄',
        cardScan: 'Imbas Ubat', cardPills: 'Ubat Saya', cardCall: 'Panggil',
        cardTalk: 'Bercakap dengan MORY', cardAlert: 'Kecemasan', cardGames: 'Permainan',
        settingsTitle: 'Tetapan', textSize: 'Saiz Teks',
        dialectLabel: '🗣️ Bahasa / Dialek', gonkaLabel: 'Gonka:',
        testConnection: '🔌 Uji Sambungan', quickTest: '💬 Uji Pantas', close: 'Tutup',
        pressToTalk: 'Tekan sini untuk bercakap', talkToMoryTitle: 'Bercakap dengan MORY'
    }
};

function applyUiTranslations() {
    const dialect = document.getElementById('dialect-picker')?.value || 'english';
    const dict = UI_TEXT[dialect] || UI_TEXT.english;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });
}

// ========== CONTINUOUS CONVERSATION STATE ==========
let conversationActive = false;   // true while MORY is in an open back-and-forth
let silenceStrikes = 0;           // consecutive "heard nothing" retries this session
const MAX_SILENCE_STRIKES = 2;    // after this many silent turns, stop auto-listening

// Phrases (per dialect) that mean "I'm done talking, MORY" — checked against
// what the elderly person actually said, before we bother calling the AI.
const STOP_PHRASES = {
    cantonese: ['拜拜', '唔使喇', '夠喇', '收line'],
    hokkien: ['拜拜', '好啊', '免啊', '夠啊'],
    hakka: ['拜拜', '毋使', '夠了'],
    mandarin: ['拜拜', '再见', '不用了', '够了', '没事了'],
    english: ['bye', 'goodbye', 'stop', 'that\'s all', 'that is all', 'no more', 'enough', 'i\'m done', 'im done', 'thank you that\'s all', 'nothing else'],
    bm: ['bye', 'selamat tinggal', 'sudah cukup', 'tak payah', 'sudah']
};

// Speech-synthesis language codes, matching the recognition language map below
const TTS_LANG_MAP = {
    cantonese: 'zh-HK',
    hokkien: 'zh-TW',
    hakka: 'zh-CN',
    mandarin: 'zh-CN',
    english: 'en-US',
    bm: 'ms-MY'
};

function saidGoodbye(transcript, dialect) {
    const text = (transcript || '').toLowerCase().trim();
    const phrases = STOP_PHRASES[dialect] || STOP_PHRASES.english;
    return phrases.some(p => text.includes(p.toLowerCase()));
}

// Speak MORY's reply aloud, then (if the conversation is still active)
// automatically start listening for the elderly person's next turn.
function speakReply(text, dialect) {
    if (!('speechSynthesis' in window) || !text) {
        // No TTS available in this browser — just keep the loop going
        // after a short pause so it still feels conversational.
        if (conversationActive) {
            setTimeout(() => startSpeechRecognition(), 800);
        }
        return;
    }

    window.speechSynthesis.cancel(); // stop anything currently speaking

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = TTS_LANG_MAP[dialect] || 'en-US';
    utterance.rate = 0.95; // slightly slower — easier for elderly listeners to follow

    utterance.onend = () => {
        if (conversationActive) {
            startSpeechRecognition();
        }
    };
    utterance.onerror = () => {
        if (conversationActive) {
            startSpeechRecognition();
        }
    };

    window.speechSynthesis.speak(utterance);
}

// Elderly person taps "Stop Talking", or a goodbye phrase was detected.
function endConversation(dialect) {
    conversationActive = false;
    silenceStrikes = 0;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    const goodbyes = {
        cantonese: '好呀，拜拜！有需要隨時嗌我。',
        hokkien: '好啊，拜拜！有需要隨時叫我。',
        hakka: '好，拜拜！有需要隨時喊𠊎。',
        mandarin: '好的，再见！有需要随时叫我。',
        english: "Okay, bye for now! Just tap the heart anytime you want to talk again.",
        bm: 'Baiklah, jumpa lagi! Tekan hati bila-bila masa nak berbual lagi.'
    };
    const msg = goodbyes[dialect] || goodbyes.english;

    openElderlyModal(
        '💜 See You Soon',
        `<div style="text-align:center;padding:10px 0;">${msg}</div>
         <button class="action-btn" onclick="closeElderlyModal()">✅ Done</button>`
    );
    // conversationActive is already false above, so speakReply's onend
    // handler won't re-trigger listening — this just speaks the goodbye once.
    speakReply(msg, dialect);
}

// ========== FONT CONTROLS ==========
function adjustFont(delta) {
    baseFontSize += delta;
    if (baseFontSize < 16) baseFontSize = 16;
    if (baseFontSize > 34) baseFontSize = 34;
    document.documentElement.style.setProperty('--base-font-size', baseFontSize + 'px');
}

function resetFont() {
    baseFontSize = 22;
    document.documentElement.style.setProperty('--base-font-size', '22px');
}

// ========== MODAL CONTROLS ==========
function openElderlyModal(title, contentHtml) {
    document.getElementById('modal-title').innerHTML = title;
    document.getElementById('modal-body').innerHTML = contentHtml;
    document.getElementById('elderly-modal').style.display = 'block';
}

function closeElderlyModal() {
    document.getElementById('elderly-modal').style.display = 'none';
}

function toggleSettingsPanel() {
    document.getElementById('settings-panel').classList.toggle('open');
}

// ========== GONKA STATUS ==========
function updateGonkaStatus(dialect) {
    const statusDot = document.querySelector('.status-dot') || document.getElementById('status-dot');
    const nodeSpan = document.getElementById('gonka-node');
    
    const latencies = {
        'cantonese': '18ms',
        'hokkien': '22ms',
        'hakka': '25ms',
        'mandarin': '15ms',
        'english': '12ms',
        'bm': '30ms'
    };
    
    const nodes = {
        'cantonese': 'Node #482 (Cantonese-Whisper-v2)',
        'hokkien': 'Node #204 (Hokkien-Speech-Local)',
        'hakka': 'Node #308 (Hakka-Dialect-Engine)',
        'mandarin': 'Node #012 (Mandarin-FastLLM)',
        'english': 'Node #001 (English-Llama3)',
        'bm': 'Node #109 (Malay-Local-Node)'
    };
    
    const nodeMap = {
        'cantonese': 'Gonka Node #102 (Cantonese-Whisper-v2)',
        'hokkien': 'Gonka Node #204 (Hokkien-Speech-Local)',
        'hakka': 'Gonka Node #308 (Hakka-Dialect-Engine)',
        'mandarin': 'Gonka Node #012 (Mandarin-FastLLM)',
        'english': 'Gonka Node #001 (English-Llama3)',
        'bm': 'Gonka Node #109 (Malay-Local-Node)'
    };
    
    // Update status dot
    if (statusDot) {
        statusDot.style.backgroundColor = '#2ECC71';
        statusDot.style.boxShadow = '0 0 8px #2ECC71';
    }
    
    // Update node display
    if (nodeSpan) {
        nodeSpan.innerHTML = nodes[dialect] || 'Node #001 (English-Llama3)';
    }
    
    // Update dialect node
    const nodeDisplay = document.getElementById('current-dialect-node');
    if (nodeDisplay) {
        nodeDisplay.innerHTML = nodeMap[dialect] || 'Gonka Edge Mesh';
    }
}

// ========== DIALECT PICKER ==========
document.addEventListener('DOMContentLoaded', function() {
    applyUiTranslations();

    const picker = document.getElementById('dialect-picker');
    if (picker) {
        const defaultDialect = picker.value;
        updateGonkaStatus(defaultDialect);
    }

    // Pills: check status right away, then every 30s while the page is open
    refreshPillsBadge();
    setInterval(refreshPillsBadge, 30000);
});

document.getElementById('dialect-picker')?.addEventListener('change', function(e) {
    const selected = e.target.value;
    updateGonkaStatus(selected);
});

// ========== TEST CONNECTION ==========
async function testServerConnection() {
    openElderlyModal(
        '🔌 Testing Connection', 
        'Checking if MORY server is running...<br><br>' +
        '<div style="font-size:1.2em;">⏳ Testing...</div>'
    );
    
    try {
        const response = await fetch('/api/health');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        openElderlyModal(
            '✅ Server Connected!', 
            'MORY server is running properly!<br><br>' +
            '📡 Gonka Router: ' + data.gonkaRouter + '<br>' +
            '📦 Version: ' + data.version + '<br>' +
            '🕐 Time: ' + new Date(data.timestamp).toLocaleString() + '<br><br>' +
            '✅ You can now use voice input!'
        );
    } catch (error) {
        openElderlyModal(
            '❌ Server Not Found', 
            'MORY server is not running!<br><br>' +
            'Please open a terminal and run:<br>' +
            '<code style="background:#f0f0f0;padding:8px;display:block;border-radius:8px;margin:10px 0;font-size:0.8em;">node server.js</code>' +
            'Then refresh this page and try again.<br><br>' +
            '<small style="color:#666;">Error: ' + error.message + '</small>'
        );
    }
}

// ========== SEND TO GONKA ==========
async function sendToGonkaCompanion(userVoiceText) {
    if (isProcessing) {
        openElderlyModal('⏳ Please Wait', 'MORY is still thinking... Please wait a moment.');
        return;
    }
    
    const selectedDialect = document.getElementById('dialect-picker').value;

    // If the elderly person said a goodbye phrase, end the loop right here —
    // no need to spend a Gonka call on it.
    if (saidGoodbye(userVoiceText, selectedDialect)) {
        endConversation(selectedDialect);
        return;
    }

    isProcessing = true;
    
    // Show loading state with improved UI
    openElderlyModal(
        '💜 Talking to MORY', 
        '<div style="text-align:center;">' +
        '<div style="font-size:3em;margin-bottom:10px;">💜</div>' +
        '⏳ Connecting to Gonka Network...<br><br>' +
        '<span style="font-size:0.8em;opacity:0.7;">Routing via ' + 
        (selectedDialect === 'cantonese' ? 'Cantonese' : 
         selectedDialect === 'hokkien' ? 'Hokkien' : 
         selectedDialect === 'hakka' ? 'Hakka' : 
         selectedDialect === 'mandarin' ? 'Mandarin' : 
         selectedDialect === 'bm' ? 'Bahasa Melayu' : 'English') + 
        ' node</span><br>' +
        '<span style="font-size:0.7em;opacity:0.5;">' + userVoiceText + '</span>' +
        '</div>'
    );

    try {
        const response = await fetch('/api/companion/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                userMessage: userVoiceText,
                dialect: selectedDialect,
                conversationHistory: conversationHistory.slice(-12), // real multi-turn context
                memoryContext: { 
                    favoriteMusic: "Teresa Teng", 
                    homeTown: "Ipoh"
                }
            })
        });

        if (!response.ok) {
            // Try to get error message from response
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Add to conversation history
        conversationHistory.push({ role: 'user', content: userVoiceText });
        conversationHistory.push({ role: 'assistant', content: data.reply });
        
        // Keep history manageable
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }

        // Update UI with real AI reply
        const nodeDisplay = data.routedNode || 'Gonka Network';
        const latencyDisplay = data.latency || '18ms';
        const isFallback = data.fallback ? '📡 Offline Mode' : '🌐 Online';
        const fallbackNote = data.fallback ? '<br><span style="font-size:0.7em;opacity:0.6;color:#FF6B6B;">⚠️ Using offline fallback responses</span>' : '';

        openElderlyModal(
            `💜 MORY (${nodeDisplay})`, 
            `<div style="text-align:left;padding:10px 0;">
                <strong>MORY:</strong> "${data.reply}"<br><br>
                <span style="font-size:0.7em;opacity:0.6;">
                    🗣️ ${selectedDialect} · ⚡ ${latencyDisplay} · ${isFallback}
                </span>
                ${fallbackNote}
                ${conversationActive ? '<br><br><span style="font-size:0.7em;opacity:0.7;">🎙️ Listening again after MORY finishes speaking...</span>' : ''}
             </div>
             <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="action-btn" onclick="sendQuickReply()" style="flex:1;min-width:100px;">💬 Quick Reply</button>
                <button class="action-btn" onclick="endConversation('${selectedDialect}')" style="flex:1;min-width:100px;background-color:#B23A48;">🛑 Stop Talking</button>
             </div>`
        );

        // Reset silence counter — we just had a real exchange
        silenceStrikes = 0;
        // Speak MORY's reply; when it finishes, speakReply() auto-starts
        // listening again as long as conversationActive is still true.
        speakReply(data.reply, selectedDialect);

    } catch (err) {
        console.error('Gonka API Error:', err);
        
        // Get fallback response
        const fallbackReplies = {
            'cantonese': '阿嫲，MORY 聽到你講嘢！你想我幫你做啲咩？',
            'hokkien': '阿嫲，MORY 聽到你講話！你愛我幫你做啥？',
            'hakka': '阿嬤，MORY 聽到你講話！你想 𠊎 幫你做麼個？',
            'mandarin': '奶奶，MORY听到您说话了！您想让我帮您做什么？',
            'english': 'Ah Ma, MORY is listening! How can I help you today?',
            'bm': 'Nenek, MORY sedang mendengar! Apa yang boleh saya bantu?'
        };
        
        const offlineReply = fallbackReplies[selectedDialect] || fallbackReplies.english;

        openElderlyModal(
            '💜 MORY (Offline Mode)', 
            `<div style="text-align:left;padding:10px 0;">
                <strong>MORY:</strong> "${offlineReply}"<br><br>
                <span style="font-size:0.7em;opacity:0.6;">📡 Offline Mode (Gonka reconnecting...)</span>
                <br><br>
                <small style="color:#666;">${err.message || 'Connection issue'}</small>
             </div>
             <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="action-btn" onclick="sendQuickReply()" style="flex:1;min-width:100px;">💬 Try Again</button>
                <button class="action-btn" onclick="endConversation('${selectedDialect}')" style="flex:1;min-width:100px;background-color:#B23A48;">🛑 Stop Talking</button>
             </div>`
        );

        speakReply(offlineReply, selectedDialect);
    } finally {
        isProcessing = false;
    }
}

// ========== QUICK REPLY ==========
function sendQuickReply() {
    const quickMessages = [
        "What medicine do I take next?",
        "Tell me a story",
        "Play some music",
        "What's the weather today?",
        "How are you today?",
        "I'm feeling a bit tired"
    ];
    const randomMessage = quickMessages[Math.floor(Math.random() * quickMessages.length)];
    sendToGonkaCompanion(randomMessage);
}

// ========== VOICE INPUT ==========
function startVoiceInput() {
    // Tapping the heart (re)starts an active conversation session —
    // MORY will keep listening/replying on its own until the elderly
    // person says a goodbye phrase or taps "Stop Talking".
    conversationActive = true;
    silenceStrikes = 0;

    // Check if server is accessible first
    fetch('/api/health')
        .then(response => {
            if (!response.ok) {
                throw new Error('Server not reachable');
            }
            return response.json();
        })
        .then(() => {
            // Server is running, proceed with voice
            startSpeechRecognition();
        })
        .catch((error) => {
            console.warn('Server check failed, trying voice anyway:', error);
            // Still try voice recognition, might work offline
            startSpeechRecognition();
        });
}

function startSpeechRecognition() {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        openElderlyModal(
            '📱 Not Supported', 
            'Voice input is not supported in your browser.<br><br>' +
            'Please use Chrome, Edge, or Safari for voice features.<br><br>' +
            '<button class="action-btn" onclick="sendQuickReply()">💬 Use Quick Reply Instead</button>'
        );
        return;
    }

    const recognition = new SpeechRecognition();
    const selectedDialect = document.getElementById('dialect-picker').value;
    
    // Map dialect to speech recognition language codes
    const languageMap = {
        'cantonese': 'zh-HK',
        'hokkien': 'zh-TW',
        'hakka': 'zh-CN',
        'mandarin': 'zh-CN',
        'english': 'en-US',
        'bm': 'ms-MY'
    };
    
    recognition.lang = languageMap[selectedDialect] || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    // Show listening status with animation
    openElderlyModal(
        '🎤 Listening...', 
        '<div style="text-align:center;padding:20px 0;">' +
        '<div style="font-size:4em;animation:pulse 1s infinite;">🎙️</div>' +
        '<p style="margin-top:10px;">Please speak clearly into the microphone.</p>' +
        '<p style="font-size:0.8em;opacity:0.6;">Speaking: ' + selectedDialect + '</p>' +
        '<style>' +
        '@keyframes pulse {' +
        '  0% { transform: scale(1); }' +
        '  50% { transform: scale(1.1); }' +
        '  100% { transform: scale(1); }' +
        '}' +
        '</style>' +
        '</div>'
    );
    
    // Update voice hint
    const hint = document.getElementById('voiceHint');
    if (hint) {
        hint.textContent = '🎤 Listening... Speak now!';
        hint.style.background = 'rgba(255,255,255,0.3)';
    }
    
    recognition.onstart = function() {
        console.log('🎤 Speech recognition started');
    };
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        console.log('✅ Speech recognized:', transcript);
        
        // Update hint
        const hint = document.getElementById('voiceHint');
        if (hint) {
            hint.textContent = '"' + transcript + '"';
            hint.style.background = 'rgba(255,255,255,0.2)';
        }
        
        // Send to MORY
        sendToGonkaCompanion(transcript);
    };
    
    recognition.onerror = function(event) {
        console.error('❌ Speech recognition error:', event.error);
        
        // Reset hint
        const hint = document.getElementById('voiceHint');
        if (hint) {
            hint.textContent = 'Tap the heart to speak';
            hint.style.background = 'rgba(255,255,255,0.2)';
        }
        
        const selectedDialect = document.getElementById('dialect-picker')?.value || 'english';

        // Handle specific errors
        if (event.error === 'not-allowed') {
            conversationActive = false; // can't auto-recover from a permission denial
            openElderlyModal(
                '🔇 Microphone Access Denied', 
                'Please allow microphone access in your browser settings, then try again.<br><br>' +
                '<button class="action-btn" onclick="startVoiceInput()">🔄 Try Again</button>'
            );
        } else if (event.error === 'no-speech') {
            if (conversationActive) {
                // Mid-conversation: don't interrupt with an error popup every
                // time — just quietly try listening again, up to a limit.
                silenceStrikes++;
                if (silenceStrikes <= MAX_SILENCE_STRIKES) {
                    setTimeout(() => startSpeechRecognition(), 600);
                    return;
                }
                // Gave the elderly person a couple of quiet chances — stop
                // listening on our own so the mic doesn't run forever.
                endConversation(selectedDialect);
                return;
            }
            openElderlyModal(
                '🎤 No Speech Detected', 
                'No speech was detected. Please try again and speak clearly.<br><br>' +
                '<button class="action-btn" onclick="startVoiceInput()">🔄 Try Again</button><br>' +
                '<button class="action-btn" onclick="sendQuickReply()" style="background-color:#3B5E43;">💬 Use Quick Reply</button>'
            );
        } else if (event.error === 'audio-capture') {
            conversationActive = false;
            openElderlyModal(
                '🎤 Microphone Error', 
                'Could not access microphone. Please check:<br><br>' +
                '• Microphone is plugged in<br>' +
                '• Browser has permission<br>' +
                '• No other app is using it<br><br>' +
                '<button class="action-btn" onclick="startVoiceInput()">🔄 Try Again</button>'
            );
        } else {
            conversationActive = false;
            openElderlyModal(
                '🎤 Microphone Error', 
                'Error: ' + event.error + '<br><br>Please try again or use quick reply.<br><br>' +
                '<button class="action-btn" onclick="startVoiceInput()">🔄 Try Again</button><br>' +
                '<button class="action-btn" onclick="sendQuickReply()" style="background-color:#3B5E43;">💬 Quick Reply</button>'
            );
        }
    };
    
    recognition.onend = function() {
        console.log('🎤 Speech recognition ended');
        // Reset hint if no result was received
        const hint = document.getElementById('voiceHint');
        if (hint && !hint.textContent.includes('"')) {
            hint.textContent = 'Tap the heart to speak';
            hint.style.background = 'rgba(255,255,255,0.2)';
        }
    };
    
    // Start recognition with a timeout
    try {
        recognition.start();
        
        // Auto-stop after 10 seconds if no speech
        setTimeout(() => {
            try {
                recognition.stop();
            } catch (e) {
                // Already stopped
            }
        }, 10000);
        
    } catch (error) {
        console.error('Error starting speech recognition:', error);
        openElderlyModal(
            '⚠️ Error', 
            'Could not start voice input. Please try again.<br><br>' +
            '<button class="action-btn" onclick="startVoiceInput()">🔄 Try Again</button>'
        );
    }
}

// ========== MAKE FUNCTIONS GLOBAL ==========
// ========== MEDICINE SCANNER ==========
// This feature is a READING AID ONLY — every result carries a visible
// disclaimer, and we never show fabricated fields when the photo is unclear.

const MEDICINE_DISCLAIMER_TEXT = "⚠️ This is a reading guide only, based on your photo. It is not medical advice — please always confirm with your pharmacist or doctor before taking any medication.";

function triggerMedicineScan() {
    document.getElementById('medicine-photo-input').click();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // data: URL — server accepts this directly
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function handleMedicinePhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    // Reset the input so selecting the *same* file again (e.g. after a retake) still fires onchange
    event.target.value = '';
    if (!file) return;

    const selectedDialect = document.getElementById('dialect-picker').value;

    openElderlyModal(
        '📷 Reading Label...',
        `<div class="scanner-box">
            📷 <strong>Reading your photo...</strong><br><br>
            This can take a few seconds.
         </div>
         <div style="font-size:0.75em;opacity:0.7;margin-top:8px;">${MEDICINE_DISCLAIMER_TEXT}</div>`
    );

    try {
        const imageBase64 = await fileToBase64(file);

        const response = await fetch('/api/scan-medicine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, dialect: selectedDialect })
        });

        const data = await response.json();
        renderMedicineResult(data, selectedDialect);

    } catch (err) {
        console.error('Medicine scan failed:', err);
        openElderlyModal(
            '📷 Couldn\'t Read That',
            `<div style="text-align:left;">
                Something went wrong reading the photo. Please check your connection and try again.<br><br>
                <small style="color:#666;">${err.message || ''}</small><br><br>
                <div style="font-size:0.75em;opacity:0.7;">${MEDICINE_DISCLAIMER_TEXT}</div>
             </div>
             <button class="action-btn" onclick="triggerMedicineScan()">🔁 Try Again</button>`
        );
    }
}

function renderMedicineResult(data, dialect) {
    const disclaimer = data.disclaimer || MEDICINE_DISCLAIMER_TEXT.replace('⚠️ ', '');

    if (!data.legible) {
        // Never show fabricated fields — only the "please retake" message.
        openElderlyModal(
            '📷 Photo Not Clear',
            `<div style="text-align:left;padding:6px 0;">
                <strong>MORY:</strong> "${data.elderlySummary || "I couldn't read this clearly. Could you try again?"}"
                <div style="font-size:0.75em;opacity:0.7;margin-top:10px;">⚠️ ${disclaimer}</div>
             </div>
             <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="action-btn" onclick="triggerMedicineScan()" style="flex:1;min-width:100px;">🔁 Retake Photo</button>
                <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;min-width:100px;background-color:#3B5E43;">✅ Done</button>
             </div>`
        );
        speakReply(data.elderlySummary, dialect);
        return;
    }

    // Ah Ma's view: big, warm, plain-language, spoken aloud.
    // Caregiver's view: collapsible, shows the exact printed fields + raw OCR
    // text so a family member can double-check nothing was misread.
    const caregiverDetailsId = 'caregiver-details-' + Date.now();

    openElderlyModal(
        `💊 ${data.medicineName || 'Medicine Info'}`,
        `<div style="text-align:left;padding:6px 0;">
            <strong>MORY:</strong> "${data.elderlySummary || ''}"
         </div>
         <div style="font-size:0.75em;opacity:0.7;margin-top:10px;text-align:left;">⚠️ ${disclaimer}</div>

         <button class="action-btn" style="background-color:#3B5E43;margin-top:14px;"
                 onclick="const el=document.getElementById('${caregiverDetailsId}'); el.style.display = el.style.display==='none' ? 'block' : 'none';">
            👨‍👩‍👧 Show Details for Caregiver
         </button>

         <div id="${caregiverDetailsId}" style="display:none;text-align:left;margin-top:12px;background:var(--sage-bg);border-radius:14px;padding:14px;font-size:0.85em;">
            <strong>Medicine:</strong> ${escapeHtml(data.medicineName) || '—'}<br>
            <strong>Purpose:</strong> ${escapeHtml(data.purposePlain) || '—'}<br>
            <strong>Dosage (as printed):</strong> ${escapeHtml(data.dosage) || '—'}<br>
            <strong>Timing (as printed):</strong> ${escapeHtml(data.timing) || '—'}<br>
            <strong>Warnings (as printed):</strong> ${escapeHtml(data.warnings) || 'None printed'}<br><br>
            <strong>Note:</strong> ${escapeHtml(data.caregiverNote) || ''}<br><br>
            ${renderRxNormBadge(data.rxNormCheck)}
            <details>
                <summary style="cursor:pointer;">Raw scanned text (to verify against the label)</summary>
                <div style="white-space:pre-wrap;font-size:0.9em;opacity:0.8;margin-top:6px;">${escapeHtml(data.ocrText) || '(none)'}</div>
            </details>
         </div>

         <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button class="action-btn" onclick="triggerMedicineScan()" style="flex:1;min-width:100px;">🔁 Scan Another</button>
            <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;min-width:100px;background-color:#3B5E43;">✅ Done</button>
         </div>`
    );

    speakReply(data.elderlySummary, dialect);
}

// Best-effort confirmation against NLM's RxNorm database — shown only to
// caregivers, never presented as a pass/fail medical verdict. RxNorm is a
// US drug database, so a "not found" is common and expected for Malaysian
// brand names — this is informational, not a red flag on its own.
function renderRxNormBadge(check) {
    if (!check || !check.checked) {
        return `<div style="font-size:0.8em;opacity:0.6;">RxNorm check: unavailable right now.</div>`;
    }
    if (check.matched) {
        return `<div style="font-size:0.8em;background:#E2F0D9;border-radius:8px;padding:8px;">
            ✅ Matches a known drug name in NLM's RxNorm database: <strong>${escapeHtml(check.standardizedName)}</strong>
        </div>`;
    }
    return `<div style="font-size:0.8em;background:#FFF3CD;border-radius:8px;padding:8px;">
        ⚠️ Not found in RxNorm (a US drug database) — common for Malaysian brand names, not necessarily a problem. Verify against the physical label.
    </div>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}


// ========== PILLS REMINDER ==========

let currentPillsData = [];      // last fetched medications list, cached for edit/delete forms
let remindedKeys = new Set();   // `${id}:${date}:${status}` already alerted this session — avoids alert spam
let editingMedId = null;        // set while the add/edit form is in "editing" mode

const STATUS_LABELS = {
    taken: { emoji: '✅', text: 'Taken', color: '#3B5E43' },
    due: { emoji: '⏰', text: 'Due Now', color: '#C97A1E' },
    overdue: { emoji: '🔴', text: 'Overdue', color: '#B23A48' },
    upcoming: { emoji: '🕒', text: 'Upcoming', color: '#6D3B97' }
};

function formatTime12h(timeStr) {
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

async function fetchPills() {
    const res = await fetch('/api/pills');
    const data = await res.json();
    currentPillsData = data.medications || [];
    return currentPillsData;
}

// ---- Due-count badge on the "My Pills" card ----
async function refreshPillsBadge() {
    try {
        const meds = await fetchPills();
        const urgentCount = meds.filter(m => m.status === 'due' || m.status === 'overdue').length;
        const badge = document.getElementById('pills-due-badge');
        if (badge) {
            if (urgentCount > 0) {
                badge.textContent = urgentCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
        checkForReminders(meds);
    } catch (err) {
        console.log('Pills badge refresh failed (server may be offline):', err.message);
    }
}

// ---- Active reminders ----
function checkForReminders(meds) {
    const today = new Date().toISOString().slice(0, 10);
    meds.forEach(med => {
        if (med.status !== 'due' && med.status !== 'overdue') return;
        const key = `${med.id}:${today}:${med.status}`;
        if (remindedKeys.has(key)) return;
        remindedKeys.add(key);
        fireReminder(med);
    });
}

function fireReminder(med) {
    const dialect = document.getElementById('dialect-picker')?.value || 'english';
    const label = STATUS_LABELS[med.status];

    const reminderText = {
        cantonese: `阿嫲，係時候食藥喇：${med.name}，${med.dosage}，治療${med.purpose}。`,
        hokkien: `阿嫲，時間到愛食藥矣：${med.name}，${med.dosage}，治療${med.purpose}。`,
        hakka: `阿嬤，該食藥了：${med.name}，${med.dosage}，治療${med.purpose}。`,
        mandarin: `奶奶，该吃药了：${med.name}，${med.dosage}，治疗${med.purpose}。`,
        english: `Ah Ma, it's time for your ${med.name}, ${med.dosage}, for ${med.purpose}.`,
        bm: `Nenek, sudah masa untuk ubat ${med.name}, ${med.dosage}, untuk ${med.purpose}.`
    };
    const text = reminderText[dialect] || reminderText.english;

    openElderlyModal(
        `${label.emoji} Time for Your Medicine`,
        `<div style="text-align:left;padding:6px 0;">
            <strong>MORY:</strong> "${text}"<br><br>
            <strong>${escapeHtml(med.name)}</strong> — ${escapeHtml(med.dosage)}<br>
            <span style="opacity:0.7;">${escapeHtml(med.purpose)} · ${formatTime12h(med.time)}</span>
         </div>
         <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button class="action-btn" onclick="markPillTaken('${med.id}')" style="flex:1;min-width:100px;">✅ Mark as Taken</button>
            <button class="action-btn" onclick="snoozePill('${med.id}')" style="flex:1;min-width:100px;background-color:#8E4EC6;">⏰ Remind in 10 min</button>
         </div>`
    );
    speakReply(text, dialect);
}

function snoozePill(id) {
    closeElderlyModal();
    // Let this medication alert again after 10 minutes, even if it's still
    // technically the same status, by clearing today's recorded key for it.
    const today = new Date().toISOString().slice(0, 10);
    setTimeout(() => {
        ['due', 'overdue'].forEach(s => remindedKeys.delete(`${id}:${today}:${s}`));
    }, 10 * 60 * 1000);
}

async function markPillTaken(id) {
    try {
        const res = await fetch(`/api/pills/${id}/take`, { method: 'POST' });
        const data = await res.json();
        currentPillsData = data.medications || [];
        openPillsChecklist(); // refresh the visible list right away
        refreshPillsBadge();
    } catch (err) {
        console.error('Failed to mark pill taken:', err);
    }
}

// ---- Main checklist screen ----
async function openPillsChecklist() {
    openElderlyModal('💊 Daily Pill Checklist', '<div style="text-align:center;">Loading...</div>');

    let meds;
    try {
        meds = await fetchPills();
    } catch (err) {
        openElderlyModal('💊 My Pills', `Couldn't load your medicine list. Please check your connection.<br><br><small style="color:#666;">${err.message}</small>`);
        return;
    }

    const rows = meds.map(med => {
        const label = STATUS_LABELS[med.status];
        return `
        <div style="border:2px solid ${label.color}22;border-left:6px solid ${label.color};border-radius:14px;padding:12px 14px;margin-bottom:10px;text-align:left;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div>
                    <strong>${escapeHtml(med.name)}</strong> — ${escapeHtml(med.dosage)}<br>
                    <span style="opacity:0.7;font-size:0.85em;">${escapeHtml(med.purpose)} · ${formatTime12h(med.time)}</span>
                </div>
                <span style="color:${label.color};font-weight:800;white-space:nowrap;">${label.emoji} ${label.text}</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                ${med.status !== 'taken'
                    ? `<button class="action-btn" style="flex:1;min-height:44px;padding:8px;" onclick="markPillTaken('${med.id}')">✅ Mark Taken</button>`
                    : `<span style="flex:1;font-size:0.8em;opacity:0.6;align-self:center;">Taken today</span>`}
                <button class="action-btn" style="flex:0 0 auto;min-height:44px;padding:8px 14px;background-color:#8E4EC6;" onclick="openMedicineForm('${med.id}')">✏️</button>
                <button class="action-btn" style="flex:0 0 auto;min-height:44px;padding:8px 14px;background-color:#B23A48;" onclick="deleteMedicine('${med.id}')">🗑️</button>
            </div>
        </div>`;
    }).join('');

    openElderlyModal(
        '💊 Daily Pill Checklist',
        `<div style="max-height:50vh;overflow-y:auto;">
            ${rows || '<div style="opacity:0.6;">No medications added yet.</div>'}
         </div>
         <button class="action-btn" style="background-color:#3B5E43;margin-top:8px;" onclick="openMedicineForm()">➕ Add Medicine</button>
         <button class="action-btn" style="background-color:var(--sage-green);margin-top:8px;" onclick="openPillsHistory()">📜 View History</button>`
    );
}

// ---- Add / Edit form (intended for family/caregiver use) ----
function openMedicineForm(id) {
    editingMedId = id || null;
    const med = id ? currentPillsData.find(m => m.id === id) : null;

    openElderlyModal(
        med ? '✏️ Edit Medicine' : '➕ Add Medicine',
        `<div style="text-align:left;font-size:0.7em;opacity:0.7;margin-bottom:10px;">For family/caregiver use — enter exactly what's on the label.</div>
         <div style="display:flex;flex-direction:column;gap:10px;text-align:left;">
            <label>Medicine Name<br>
                <input id="pf-name" type="text" value="${med ? escapeHtml(med.name) : ''}" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--sage-green);font-size:1em;">
            </label>
            <label>Purpose (plain words, e.g. "Blood Pressure")<br>
                <input id="pf-purpose" type="text" value="${med ? escapeHtml(med.purpose) : ''}" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--sage-green);font-size:1em;">
            </label>
            <label>Dosage (e.g. "1 Tablet")<br>
                <input id="pf-dosage" type="text" value="${med ? escapeHtml(med.dosage) : ''}" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--sage-green);font-size:1em;">
            </label>
            <label>Time<br>
                <input id="pf-time" type="time" value="${med ? med.time : '08:00'}" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--sage-green);font-size:1em;">
            </label>
         </div>
         <div style="display:flex;gap:8px;margin-top:14px;">
            <button class="action-btn" style="flex:1;" onclick="saveMedicineForm()">💾 Save</button>
            <button class="action-btn" style="flex:1;background-color:#3B5E43;" onclick="openPillsChecklist()">← Back</button>
         </div>`
    );
}

async function saveMedicineForm() {
    const name = document.getElementById('pf-name').value.trim();
    const purpose = document.getElementById('pf-purpose').value.trim();
    const dosage = document.getElementById('pf-dosage').value.trim();
    const time = document.getElementById('pf-time').value;

    if (!name || !time) {
        alert('Please enter at least a medicine name and time.');
        return;
    }

    try {
        if (editingMedId) {
            await fetch(`/api/pills/${editingMedId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, purpose, dosage, time })
            });
        } else {
            await fetch('/api/pills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, purpose, dosage, time })
            });
        }
        editingMedId = null;
        openPillsChecklist();
        refreshPillsBadge();
    } catch (err) {
        alert('Could not save: ' + err.message);
    }
}

async function deleteMedicine(id) {
    if (!confirm('Remove this medicine from the list?')) return;
    try {
        await fetch(`/api/pills/${id}`, { method: 'DELETE' });
        openPillsChecklist();
        refreshPillsBadge();
    } catch (err) {
        alert('Could not remove: ' + err.message);
    }
}

// ---- History (caregiver-facing) ----
async function openPillsHistory() {
    openElderlyModal('📜 Medicine History', '<div style="text-align:center;">Loading...</div>');
    try {
        const res = await fetch('/api/pills/history');
        const data = await res.json();
        const rows = (data.history || []).map(h => {
            const when = new Date(h.takenAt);
            return `<div style="text-align:left;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.08);">
                <strong>${escapeHtml(h.medicationName)}</strong><br>
                <span style="opacity:0.7;font-size:0.85em;">${when.toLocaleDateString()} at ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>`;
        }).join('');

        openElderlyModal(
            '📜 Medicine History',
            `<div style="max-height:50vh;overflow-y:auto;">${rows || '<div style="opacity:0.6;">No history yet.</div>'}</div>
             <button class="action-btn" style="background-color:#3B5E43;margin-top:10px;" onclick="openPillsChecklist()">← Back to Checklist</button>`
        );
    } catch (err) {
        openElderlyModal('📜 Medicine History', `Couldn't load history.<br><br><small>${err.message}</small>`);
    }
}


// ========== CALL FAMILY ==========

let currentContacts = [];
let editingContactId = null;

async function fetchContacts() {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    currentContacts = data.contacts || [];
    return currentContacts;
}

async function openCallFamily() {
    openElderlyModal('📞 Call Family', '<div style="text-align:center;">Loading...</div>');

    let contacts;
    try {
        contacts = await fetchContacts();
    } catch (err) {
        openElderlyModal('📞 Call Family', `Couldn't load contacts.<br><br><small>${err.message}</small>`);
        return;
    }

    const cards = contacts.map(c => `
        <div style="border:3px solid var(--lavender-card);border-radius:20px;padding:16px;margin-bottom:12px;text-align:left;display:flex;align-items:center;gap:14px;">
            <div style="width:56px;height:56px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--purple-light);display:flex;align-items:center;justify-content:center;font-size:1.6em;">
                ${c.photo ? `<img src="${c.photo}" alt="${escapeHtml(c.name)}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
            </div>
            <div style="flex:1;">
                <strong style="font-size:1.1em;">${escapeHtml(c.name)}</strong><br>
                <span style="opacity:0.7;">${escapeHtml(c.relation)}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <a href="tel:${escapeHtml(c.phone)}" class="action-btn" style="margin:0;padding:12px 20px;display:block;text-decoration:none;">📞 Call</a>
            </div>
        </div>
        <div style="display:flex;gap:8px;margin:-6px 0 14px 0;justify-content:flex-end;">
            <button class="action-btn" style="flex:0 0 auto;min-height:38px;padding:6px 14px;font-size:0.8em;background-color:#8E4EC6;" onclick="openContactForm('${c.id}')">✏️ Edit</button>
            <button class="action-btn" style="flex:0 0 auto;min-height:38px;padding:6px 14px;font-size:0.8em;background-color:#B23A48;" onclick="deleteContact('${c.id}')">🗑️ Remove</button>
        </div>
    `).join('');

    openElderlyModal(
        '📞 Call Family',
        `<div style="max-height:50vh;overflow-y:auto;">
            ${cards || '<div style="opacity:0.6;">No contacts added yet.</div>'}
         </div>
         <button class="action-btn" style="background-color:#3B5E43;" onclick="openContactForm()">➕ Add Family Member</button>`
    );
}

function openContactForm(id) {
    editingContactId = id || null;
    const c = id ? currentContacts.find(x => x.id === id) : null;

    openElderlyModal(
        c ? '✏️ Edit Contact' : '➕ Add Family Member',
        `<div style="display:flex;flex-direction:column;gap:10px;text-align:left;">
            <label>Name<br>
                <input id="cf-name" type="text" value="${c ? escapeHtml(c.name) : ''}" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--sage-green);font-size:1em;">
            </label>
            <label>Relation (e.g. "Daughter", "Caregiver")<br>
                <input id="cf-relation" type="text" value="${c ? escapeHtml(c.relation) : ''}" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--sage-green);font-size:1em;">
            </label>
            <label>Phone Number<br>
                <input id="cf-phone" type="tel" value="${c ? escapeHtml(c.phone) : ''}" placeholder="+60123456789" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--sage-green);font-size:1em;">
            </label>
            <label>Photo<br>
                <input id="cf-photo-input" type="file" accept="image/*" onchange="previewContactPhoto(event)" style="width:100%;padding:8px 0;">
            </label>
            <div style="display:flex;align-items:center;gap:10px;">
                <img id="cf-photo-preview" src="${c && c.photo ? c.photo : ''}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;background:var(--purple-light);${c && c.photo ? '' : 'display:none;'}">
                ${c && c.photo ? '<button type="button" class="action-btn" style="margin:0;width:auto;padding:8px 14px;font-size:0.8em;background-color:#B23A48;" onclick="clearContactPhoto()">Remove Photo</button>' : ''}
            </div>
         </div>
         <div style="display:flex;gap:8px;margin-top:14px;">
            <button class="action-btn" style="flex:1;" onclick="saveContactForm()">💾 Save</button>
            <button class="action-btn" style="flex:1;background-color:#3B5E43;" onclick="openCallFamily()">← Back</button>
         </div>`
    );
}

let pendingContactPhoto = null; // base64 data URL staged for the next save, or 'CLEAR' to remove

async function previewContactPhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    pendingContactPhoto = base64;
    const preview = document.getElementById('cf-photo-preview');
    preview.src = base64;
    preview.style.display = 'inline-block';
}

function clearContactPhoto() {
    pendingContactPhoto = 'CLEAR';
    const preview = document.getElementById('cf-photo-preview');
    preview.src = '';
    preview.style.display = 'none';
}

async function saveContactForm() {
    const name = document.getElementById('cf-name').value.trim();
    const relation = document.getElementById('cf-relation').value.trim();
    const phone = document.getElementById('cf-phone').value.trim();

    if (!name || !phone) {
        alert('Please enter at least a name and phone number.');
        return;
    }

    const payload = { name, relation, phone };
    if (pendingContactPhoto === 'CLEAR') {
        payload.photo = null;
    } else if (pendingContactPhoto) {
        payload.photo = pendingContactPhoto;
    }
    // if pendingContactPhoto is null and editing, existing photo is left untouched
    // (server only overwrites photo when the field is explicitly present)

    try {
        if (editingContactId) {
            await fetch(`/api/contacts/${editingContactId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        editingContactId = null;
        pendingContactPhoto = null;
        openCallFamily();
    } catch (err) {
        alert('Could not save: ' + err.message);
    }
}

async function deleteContact(id) {
    if (!confirm('Remove this contact?')) return;
    try {
        await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
        openCallFamily();
    } catch (err) {
        alert('Could not remove: ' + err.message);
    }
}


// ========== BRAIN GAMES ==========
// Elderly-facing screens stay warm and fun — no accuracy numbers, no
// reaction-time stats, no clinical language. Those live ONLY in the
// caregiver-facing progress view (openBrainGameProgress), matching the
// "not a medical exam" principle from the spec.

let currentGameSession = null; // tracks in-progress game state

async function openBrainGamesMenu() {
    openElderlyModal('🧠 Brain Games', '<div style="text-align:center;">Loading...</div>');

    let summary;
    try {
        const res = await fetch('/api/brain-games/summary');
        summary = await res.json();
    } catch (err) {
        summary = { streak: { current: 0 }, points: 0 };
    }

    openElderlyModal(
        '🧠 Brain Games',
        `<div style="text-align:center;margin-bottom:14px;">
            <span style="font-size:1.3em;">🔥 ${summary.streak?.current || 0}-Day Streak</span><br>
            <span style="opacity:0.8;">⭐ ${summary.points || 0} points</span>
         </div>
         <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="action-btn" onclick="startMemoryMatchGame()">🧩 Memory Match</button>
            <button class="action-btn" onclick="startNumberSequenceGame()">🔢 Number Sequence</button>
            <button class="action-btn" onclick="startReactionGame()">⚡ Reaction Game</button>
         </div>
         <button class="action-btn" style="background-color:#3B5E43;margin-top:14px;" onclick="openBrainGameProgress()">👨‍👩‍👧 Family: View Progress</button>`
    );
}

// Log a finished session to the server, then show a warm (non-clinical) result screen
async function finishGameSession(gameType, accuracy, reactionTimeMs, durationSec, resultLine) {
    let earnedPoints = 0, streak = { current: 0 };
    try {
        const res = await fetch('/api/brain-games/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameType, accuracy, reactionTimeMs, durationSec })
        });
        const data = await res.json();
        earnedPoints = data.earnedPoints || 0;
        streak = data.streak || { current: 0 };
    } catch (err) {
        console.log('Could not log game session:', err.message);
    }

    openElderlyModal(
        '🎉 Well Done!',
        `<div style="text-align:center;padding:10px 0;">
            ${resultLine}<br><br>
            <span style="font-size:1.2em;">🔥 ${streak.current}-Day Streak</span><br>
            <span style="opacity:0.8;">+${earnedPoints} points earned</span>
         </div>
         <div style="display:flex;gap:8px;margin-top:14px;">
            <button class="action-btn" style="flex:1;" onclick="openBrainGamesMenu()">🎮 Play Another</button>
            <button class="action-btn" style="flex:1;background-color:#3B5E43;" onclick="closeElderlyModal()">✅ Done</button>
         </div>`
    );
}

// ---- Caregiver-facing progress view (this is the ONLY place numbers/trend show) ----
async function openBrainGameProgress() {
    openElderlyModal('📊 Progress (Family View)', '<div style="text-align:center;">Loading...</div>');

    try {
        const res = await fetch('/api/brain-games/summary');
        const data = await res.json();
        const t = data.trend || {};

        const sessionRows = (data.recentSessions || []).slice(0, 6).map(s =>
            `<div style="display:flex;justify-content:space-between;font-size:0.85em;padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                <span>${escapeHtml(s.gameType)} · ${s.date}</span>
                <span>${s.accuracy}% · ${s.reactionTimeMs ? Math.round(s.reactionTimeMs) + 'ms' : '—'}</span>
             </div>`
        ).join('');

        let trendBlock;
        if (!t.available) {
            trendBlock = `<div style="opacity:0.7;font-size:0.85em;">${escapeHtml(t.message || 'Not enough data yet.')}</div>`;
        } else {
            trendBlock = `
                <div style="background:${t.concern ? '#FFEAE3' : 'var(--sage-bg)'};border-radius:14px;padding:12px;font-size:0.85em;text-align:left;">
                    <strong>${t.concern ? '⚠️ Trend Notice' : '✅ Trend Looks Stable'}</strong><br>
                    Baseline accuracy: ${t.baselineAccuracy}% → Recent: ${t.recentAccuracy}%<br>
                    Baseline reaction: ${t.baselineReactionMs}ms → Recent: ${t.recentReactionMs}ms<br><br>
                    ${escapeHtml(t.message)}
                </div>`;
        }

        openElderlyModal(
            '📊 Progress (Family View)',
            `<div style="text-align:left;">
                <div style="text-align:center;margin-bottom:12px;">
                    🔥 ${data.streak?.current || 0}-day streak (best: ${data.streak?.longest || 0}) · ⭐ ${data.points || 0} points
                </div>
                ${trendBlock}
                <div style="margin-top:14px;">
                    <strong style="font-size:0.9em;">Recent Sessions</strong>
                    ${sessionRows || '<div style="opacity:0.6;font-size:0.85em;">No sessions yet.</div>'}
                </div>
                <div style="font-size:0.7em;opacity:0.6;margin-top:10px;">
                    This is an observational trend, not a diagnosis. If a change continues, consider discussing it with a healthcare professional.
                </div>
             </div>
             <button class="action-btn" style="background-color:#3B5E43;margin-top:12px;" onclick="openBrainGamesMenu()">← Back to Games</button>`
        );
    } catch (err) {
        openElderlyModal('📊 Progress', `Couldn't load progress.<br><br><small>${err.message}</small>`);
    }
}

// ---- Game 1: Memory Match ----
const MEMORY_MATCH_EMOJIS = ['🍎', '🐶', '🌸', '☀️', '🐟', '🍵'];

function startMemoryMatchGame() {
    const pairs = [...MEMORY_MATCH_EMOJIS, ...MEMORY_MATCH_EMOJIS]
        .map(e => ({ emoji: e, matched: false }))
        .sort(() => Math.random() - 0.5);

    currentGameSession = {
        type: 'memory-match',
        cards: pairs,
        flipped: [],      // indices currently face-up (max 2)
        moves: 0,
        matches: 0,
        startedAt: Date.now(),
        locked: false
    };

    renderMemoryMatchBoard();
}

function renderMemoryMatchBoard() {
    const s = currentGameSession;
    const cardsHtml = s.cards.map((c, i) => {
        const faceUp = c.matched || s.flipped.includes(i);
        return `<button ${s.locked ? 'disabled' : ''} onclick="flipMemoryCard(${i})"
                    style="aspect-ratio:1;font-size:1.8em;border-radius:12px;border:3px solid var(--lavender-card);
                           background:${faceUp ? 'var(--purple-light)' : 'var(--white)'};cursor:pointer;">
                    ${faceUp ? c.emoji : '❓'}
                </button>`;
    }).join('');

    openElderlyModal(
        '🧩 Memory Match',
        `<div style="text-align:center;font-size:0.85em;opacity:0.7;margin-bottom:8px;">Tap two cards to find matching pairs</div>
         <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">${cardsHtml}</div>`
    );
}

function flipMemoryCard(index) {
    const s = currentGameSession;
    if (!s || s.locked) return;
    if (s.cards[index].matched || s.flipped.includes(index)) return;

    s.flipped.push(index);
    renderMemoryMatchBoard();

    if (s.flipped.length === 2) {
        s.moves++;
        const [a, b] = s.flipped;
        if (s.cards[a].emoji === s.cards[b].emoji) {
            s.cards[a].matched = true;
            s.cards[b].matched = true;
            s.matches++;
            s.flipped = [];
            renderMemoryMatchBoard();

            if (s.matches === MEMORY_MATCH_EMOJIS.length) {
                const durationSec = Math.round((Date.now() - s.startedAt) / 1000);
                const accuracy = Math.round((MEMORY_MATCH_EMOJIS.length / s.moves) * 100);
                currentGameSession = null;
                finishGameSession('memory-match', Math.min(100, accuracy), 0, durationSec,
                    `You matched all the pairs in ${s.moves} moves! 🧩`);
            }
        } else {
            s.locked = true;
            setTimeout(() => {
                s.flipped = [];
                s.locked = false;
                renderMemoryMatchBoard();
            }, 900);
        }
    }
}

// ---- Game 2: Number Sequence ----
function generateSequenceRound() {
    const step = [1, 2, 3, 5][Math.floor(Math.random() * 4)];
    const start = Math.floor(Math.random() * 10) + 1;
    const sequence = [0, 1, 2, 3, 4].map(i => start + i * step);
    const hiddenIndex = 1 + Math.floor(Math.random() * 3); // hide one of the middle numbers
    const answer = sequence[hiddenIndex];

    // 3 wrong options near the real answer, shuffled in with the answer
    const options = new Set([answer]);
    while (options.size < 4) {
        const offset = (Math.floor(Math.random() * 6) - 3) || 1;
        const candidate = answer + offset;
        if (candidate > 0) options.add(candidate);
    }

    return {
        display: sequence.map((n, i) => i === hiddenIndex ? '?' : n),
        answer,
        options: [...options].sort(() => Math.random() - 0.5)
    };
}

function startNumberSequenceGame() {
    currentGameSession = {
        type: 'number-sequence',
        round: 0,
        totalRounds: 5,
        correct: 0,
        reactionTimes: [],
        current: generateSequenceRound(),
        roundStartedAt: Date.now()
    };
    renderNumberSequenceRound();
}

function renderNumberSequenceRound() {
    const s = currentGameSession;
    const optionsHtml = s.current.options.map(opt =>
        `<button class="action-btn" style="min-width:70px;" onclick="answerSequence(${opt})">${opt}</button>`
    ).join('');

    openElderlyModal(
        `🔢 Number Sequence (${s.round + 1} of ${s.totalRounds})`,
        `<div style="text-align:center;font-size:1.5em;letter-spacing:4px;margin-bottom:16px;">
            ${s.current.display.join('   ')}
         </div>
         <div style="text-align:center;font-size:0.85em;opacity:0.7;margin-bottom:10px;">What number is missing?</div>
         <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">${optionsHtml}</div>`
    );
    s.roundStartedAt = Date.now();
}

function answerSequence(chosen) {
    const s = currentGameSession;
    if (!s) return;

    s.reactionTimes.push(Date.now() - s.roundStartedAt);
    if (chosen === s.current.answer) s.correct++;
    s.round++;

    if (s.round >= s.totalRounds) {
        const accuracy = Math.round((s.correct / s.totalRounds) * 100);
        const avgReaction = Math.round(s.reactionTimes.reduce((a, b) => a + b, 0) / s.reactionTimes.length);
        const durationSec = Math.round(s.reactionTimes.reduce((a, b) => a + b, 0) / 1000);
        currentGameSession = null;
        finishGameSession('number-sequence', accuracy, avgReaction, durationSec,
            `You got ${s.correct} out of ${s.totalRounds} right! 🔢`);
        return;
    }

    s.current = generateSequenceRound();
    renderNumberSequenceRound();
}

// ---- Game 3: Reaction Game ----
function startReactionGame() {
    currentGameSession = { type: 'reaction', round: 0, totalRounds: 3, times: [], falseStarts: 0 };
    runReactionRound();
}

function runReactionRound() {
    const s = currentGameSession;
    openElderlyModal(
        `⚡ Reaction Game (${s.round + 1} of ${s.totalRounds})`,
        `<div style="text-align:center;padding:30px 0;font-size:1.2em;">
            🕒 Wait for the button to turn green...
         </div>
         <button class="action-btn" disabled style="opacity:0.5;">Not Yet</button>`
    );

    const delay = 1500 + Math.random() * 2500;
    const timeoutId = setTimeout(() => {
        s.waitingSince = Date.now();
        openElderlyModal(
            `⚡ Reaction Game (${s.round + 1} of ${s.totalRounds})`,
            `<div style="text-align:center;padding:20px 0;">
                <button class="action-btn" style="background-color:#3B5E43;font-size:1.3em;padding:24px;" onclick="tapReaction(false)">
                    ✅ TAP NOW!
                </button>
             </div>`
        );
    }, delay);

    // Store so an early tap can cancel the pending "go" signal
    s.pendingTimeout = timeoutId;

    // Attach a one-time early-tap catch on the disabled-looking button via a
    // simple keyboard-free approach: we just rely on the button being
    // genuinely disabled during the wait, so there's nothing to mis-tap.
}

function tapReaction(early) {
    const s = currentGameSession;
    if (!s) return;

    const reactionMs = s.waitingSince ? Date.now() - s.waitingSince : 0;
    s.times.push(reactionMs);
    s.round++;

    if (s.round >= s.totalRounds) {
        const avg = Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length);
        const accuracy = Math.round(((s.totalRounds - s.falseStarts) / s.totalRounds) * 100);
        const durationSec = Math.round(s.times.reduce((a, b) => a + b, 0) / 1000);
        currentGameSession = null;
        finishGameSession('reaction', accuracy, avg, durationSec,
            `Your average reaction time was ${avg}ms! ⚡`);
        return;
    }

    runReactionRound();
}


// ========== NEW LANDING SCREENS (visual restyle — reuse existing logic underneath) ==========

function openScanMedicationLanding() {
    openElderlyModal(
        '📷 Scan Medication',
        `<div style="text-align:center;">
            <div class="scanner-box" style="cursor:pointer;" onclick="triggerMedicineScan()">
                <strong>Scan your medication here</strong><br><br>
                <p style="font-size:0.85em;opacity:0.8;">Please close your medication packaging into the frame below</p>
                <p style="font-size:0.8em;opacity:0.7;">📐 Hold the phone level and straight-on — avoid tilting the label at an angle</p>
                <div style="height:200px;background:var(--purple-light);border-radius:14px;margin-top:14px;display:flex;align-items:center;justify-content:center;font-size:2.5em;">📷</div>
            </div>
            <button class="action-btn" onclick="triggerMedicineScan()">Take Photo</button>
            <div style="font-size:0.75em;opacity:0.7;margin-top:14px;text-align:left;">
                ⚠️ Your medication information is yours. MORY only processes the minimum information needed to provide medication-recording and reminder functions. We do not provide prescriptions or medical advice, and medication information is not disclosed to third parties for unrelated purposes.
            </div>
        </div>`
    );
}

function openTalkToMoryScreen() {
    const dialect = document.getElementById('dialect-picker')?.value || 'english';
    const dict = UI_TEXT[dialect] || UI_TEXT.english;
    openElderlyModal(
        dict.talkToMoryTitle,
        `<div style="text-align:center;">
            <p style="opacity:0.7;">Speaking language: <strong>${document.getElementById('dialect-picker')?.selectedOptions[0]?.text || 'English'}</strong> (change in ☰ menu)</p>
            <button class="talk-circle-btn" onclick="startVoiceInput()">
                ${dict.pressToTalk}
                <div class="talk-circle-inner">
                    <img src="mory-mascot.svg" alt="" style="width:70px;height:70px;" onerror="this.style.display='none';">
                </div>
            </button>
        </div>`
    );
}

// ---- In-app Emergency Alert (Alert card) ----
let inAppAlertTimer = null;
let inAppAlertHolding = false;

function openAlertScreen() {
    openElderlyModal(
        '🚨 Emergency Alert',
        `<div style="text-align:center;">
            <p style="opacity:0.8;">Press and hold the button below for 3 seconds to call your emergency contact.</p>
            <button class="alert-hold-btn" id="in-app-alert-btn"
                onmousedown="startInAppAlertHold()" onmouseup="endInAppAlertHold()" onmouseleave="endInAppAlertHold()"
                ontouchstart="startInAppAlertHold()" ontouchend="endInAppAlertHold()">
                Press and hold<br>for 3 seconds
            </button>
        </div>`
    );
}

function startInAppAlertHold() {
    if (inAppAlertHolding) return;
    inAppAlertHolding = true;
    const btn = document.getElementById('in-app-alert-btn');
    if (btn) btn.classList.add('holding');
    inAppAlertTimer = setTimeout(() => {
        triggerInAppAlert();
    }, 3000);
}

function endInAppAlertHold() {
    inAppAlertHolding = false;
    const btn = document.getElementById('in-app-alert-btn');
    if (btn) btn.classList.remove('holding');
    clearTimeout(inAppAlertTimer);
}

async function triggerInAppAlert() {
    let latitude = null, longitude = null;
    try {
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject('no geolocation');
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
    } catch (err) {
        console.log('Location unavailable for SOS alert:', err);
    }

    try {
        await fetch('/api/emergency/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude, seniorName: 'Ah Ma' })
        });
    } catch (err) {
        console.error('Failed to send SOS alert:', err);
    }

    openElderlyModal(
        '🚨 Emergency Alert',
        `<div style="text-align:center;">
            <div style="background:var(--danger);color:white;font-weight:800;padding:14px;border-radius:16px;font-size:1.2em;margin-bottom:16px;">
                HELP IS ON THE WAY!
            </div>
            <p style="color:var(--purple-main);font-weight:700;">Your family members have been notified.</p>
            <button class="action-btn" onclick="cancelInAppAlert()">
                Tap here to cancel if you accidentally pressed the button
            </button>
        </div>`
    );
}

async function cancelInAppAlert() {
    try {
        await fetch('/api/emergency/cancel', { method: 'POST' });
    } catch (err) {
        // ignore — closing either way
    }
    closeElderlyModal();
}


window.openElderlyModal = openElderlyModal;
window.closeElderlyModal = closeElderlyModal;
window.toggleSettingsPanel = toggleSettingsPanel;
window.applyUiTranslations = applyUiTranslations;
window.startVoiceInput = startVoiceInput;
window.sendQuickReply = sendQuickReply;
window.testServerConnection = testServerConnection;
window.adjustFont = adjustFont;
window.resetFont = resetFont;
window.endConversation = endConversation;
window.triggerMedicineScan = triggerMedicineScan;
window.handleMedicinePhotoSelected = handleMedicinePhotoSelected;
window.openPillsChecklist = openPillsChecklist;
window.markPillTaken = markPillTaken;
window.snoozePill = snoozePill;
window.openMedicineForm = openMedicineForm;
window.saveMedicineForm = saveMedicineForm;
window.deleteMedicine = deleteMedicine;
window.openPillsHistory = openPillsHistory;
window.openCallFamily = openCallFamily;
window.openContactForm = openContactForm;
window.previewContactPhoto = previewContactPhoto;
window.clearContactPhoto = clearContactPhoto;
window.saveContactForm = saveContactForm;
window.deleteContact = deleteContact;
window.openBrainGamesMenu = openBrainGamesMenu;
window.openBrainGameProgress = openBrainGameProgress;
window.startMemoryMatchGame = startMemoryMatchGame;
window.flipMemoryCard = flipMemoryCard;
window.startNumberSequenceGame = startNumberSequenceGame;
window.answerSequence = answerSequence;
window.startReactionGame = startReactionGame;
window.tapReaction = tapReaction;
window.openScanMedicationLanding = openScanMedicationLanding;
window.openTalkToMoryScreen = openTalkToMoryScreen;
window.openAlertScreen = openAlertScreen;
window.startInAppAlertHold = startInAppAlertHold;
window.endInAppAlertHold = endInAppAlertHold;
window.cancelInAppAlert = cancelInAppAlert;

// ========== INITIALIZATION ==========
console.log('🚀 MORY Senior Companion loaded');
console.log('📡 Gonka Router integration active');
console.log('💜 Tap the heart button to speak');

// Update the response display
function handleResponse(data) {
    const dialectName = LANGUAGE_NAMES[data.dialect] || data.dialect;
    const routedNode = data.routedNode || 'Unknown';
    const model = data.model || 'Unknown';
    const isFallback = data.fallback ? '📡 Offline' : '🌐 Online';
    const latency = data.latency || '--';
    
    openElderlyModal(
        `💜 MORY (${routedNode})`,
        `<div style="text-align:left;padding:10px 0;">
            <strong>MORY:</strong> "${data.reply}"<br><br>
            <span style="font-size:0.7em;opacity:0.6;">
                🗣️ ${dialectName} · ⚡ ${latency} · ${isFallback}
                ${data.model ? ` · 🤖 ${data.model}` : ''}
            </span>
            ${data.fallback ? '<br><span style="font-size:0.7em;color:#FF6B6B;">⚠️ Using offline fallback</span>' : ''}
         </div>
         <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
            <button class="action-btn" onclick="sendQuickReply()" style="flex:1;min-width:100px;">💬 Quick Reply</button>
            <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;min-width:100px;background-color:#3B5E43;">✅ Done</button>
         </div>`
    );
}

// Language names for display
const LANGUAGE_NAMES = {
    'cantonese': '廣東話',
    'hokkien': '福建話',
    'hakka': '客家話',
    'mandarin': '华语',
    'english': 'English',
    'bm': 'Bahasa Melayu'
};