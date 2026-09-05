function formatTime12hCg(timeStr) {
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const CG_STATUS_CLASS = { taken: 'pill-taken', due: 'pill-due', overdue: 'pill-overdue', upcoming: 'pill-upcoming' };
const CG_STATUS_LABEL = { taken: '✅ Taken', due: '⏰ Due Now', overdue: '🔴 Overdue', upcoming: '🕒 Upcoming' };

let cgUser = null;

async function loadCaregiverDashboard() {
    cgUser = await requireAuth('caregiver');
    if (!cgUser) return;

    document.getElementById('dash-main').innerHTML = ''; // clear "Loading..." placeholder
    await Promise.all([renderCaregiverSummary(), renderCaregiverMedTracker(), renderCareJournalInput()]);
}

async function renderCaregiverSummary() {
    let summary;
    try {
        const res = await fetch('/api/dashboard/summary', { credentials: 'include' });
        summary = await res.json();
    } catch (err) {
        return; // med tracker section will still show its own error if this fails
    }

    const existing = document.getElementById('cg-summary-card');
    const html = `
        <h2>👋 Hi ${escapeHtmlCg(cgUser.name)} — Today's Snapshot</h2>
        <div class="dash-row">
            <span>💊 Medication</span>
            <strong>${summary.medication.completed}/${summary.medication.total} completed</strong>
        </div>
        <div class="dash-row">
            <span>🧠 Brain Game</span>
            <strong>${summary.brainGame.completedToday ? '✅ Completed' : '— Not yet today'}</strong>
        </div>
    `;
    if (existing) {
        existing.innerHTML = html;
    } else {
        const card = document.createElement('div');
        card.className = 'dash-card';
        card.id = 'cg-summary-card';
        card.innerHTML = html;
        document.getElementById('dash-main').prepend(card);
    }
}

async function renderCaregiverMedTracker() {
    const main = document.getElementById('dash-main');
    let existingTracker = document.getElementById('cg-med-card');

    let meds;
    try {
        const res = await fetch('/api/pills', { credentials: 'include' });
        const data = await res.json();
        meds = data.medications || [];
    } catch (err) {
        const card = existingTracker || document.createElement('div');
        card.className = 'dash-card';
        card.id = 'cg-med-card';
        card.innerHTML = `<h2>💊 Medication Tracker</h2>Couldn't load medications.<br><small>${err.message}</small>`;
        if (!existingTracker) main.appendChild(card);
        return;
    }

    const rows = meds.map(m => `
        <div class="dash-row">
            <div>
                <strong>${escapeHtmlCg(m.name)}</strong> — ${escapeHtmlCg(m.dosage)}<br>
                <span class="dash-muted">${escapeHtmlCg(m.purpose)} · ${formatTime12hCg(m.time)}</span>
            </div>
            <div style="text-align:right;">
                <span class="dash-status-pill ${CG_STATUS_CLASS[m.status]}">${CG_STATUS_LABEL[m.status]}</span><br>
                ${m.status !== 'taken' ? `<button class="dash-action-btn" style="margin-top:6px;" onclick="cgMarkTaken('${m.id}')">Mark Taken</button>` : ''}
            </div>
        </div>
    `).join('');

    const card = existingTracker || document.createElement('div');
    card.className = 'dash-card';
    card.id = 'cg-med-card';
    card.innerHTML = `<h2>💊 Medication Tracker</h2>${rows || '<div class="dash-muted">No medications on file.</div>'}`;
    if (!existingTracker) main.appendChild(card);
}

async function cgMarkTaken(id) {
    try {
        await fetch(`/api/pills/${id}/take`, { method: 'POST', credentials: 'include' });
        renderCaregiverMedTracker();
        renderCaregiverSummary();
    } catch (err) {
        alert('Could not mark as taken: ' + err.message);
    }
}

// ========== DAILY CARE JOURNAL (caregiver writes/speaks, Gonka structures it) ==========

const JOURNAL_LANG_MAP = {
    en: 'en-US',
    ms: 'ms-MY',
    tl: 'fil-PH', // Tagalog
    my: 'my-MM'   // Burmese
};

let journalRecognition = null;
let journalListening = false;

function initJournalRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    return recognition;
}

function toggleJournalMic() {
    const langSelect = document.getElementById('journal-lang');
    const textarea = document.getElementById('journal-textarea');
    const micBtn = document.getElementById('journal-mic-btn');

    if (journalListening && journalRecognition) {
        journalRecognition.stop();
        return;
    }

    journalRecognition = initJournalRecognition();
    if (!journalRecognition) {
        alert('Voice input isn\'t supported in this browser. Please type the observation instead.');
        return;
    }

    journalRecognition.lang = JOURNAL_LANG_MAP[langSelect.value] || 'en-US';
    journalListening = true;
    micBtn.textContent = '🔴 Listening... (tap to stop)';

    journalRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        textarea.value = textarea.value ? textarea.value + ' ' + transcript : transcript;
    };
    journalRecognition.onerror = () => {
        journalListening = false;
        micBtn.textContent = '🎙️ Speak Observation';
    };
    journalRecognition.onend = () => {
        journalListening = false;
        micBtn.textContent = '🎙️ Speak Observation';
    };

    journalRecognition.start();
}

async function renderCareJournalInput() {
    const main = document.getElementById('dash-main');
    const card = document.createElement('div');
    card.className = 'dash-card';
    card.id = 'cg-journal-card';
    card.innerHTML = `
        <h2>📝 Daily Care Journal</h2>
        <div class="dash-muted" style="margin-bottom:10px;">
            Write or speak a short note about today — appetite, sleep, mood, anything worth mentioning.
            MORY will turn it into a clean summary for the family.
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap;">
            <label class="dash-muted" style="font-weight:700;">Speak in:</label>
            <select id="journal-lang" style="padding:6px 10px;border-radius:8px;border:2px solid var(--purple-main);">
                <option value="en">English</option>
                <option value="ms">Bahasa Melayu</option>
                <option value="tl">Tagalog</option>
                <option value="my">Burmese</option>
            </select>
        </div>
        <textarea id="journal-textarea" rows="4" placeholder="e.g. Today Ah Ma didn't eat much lunch, but she slept quite well."
            style="width:100%;padding:12px;border-radius:12px;border:2px solid var(--purple-main);font-size:0.95em;font-family:inherit;"></textarea>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button id="journal-mic-btn" class="dash-action-btn secondary" onclick="toggleJournalMic()">🎙️ Speak Observation</button>
            <button class="dash-action-btn" onclick="submitCareJournal()">💾 Save Entry</button>
        </div>
        <div id="journal-result" style="margin-top:12px;"></div>
        <div id="journal-history" style="margin-top:14px;"></div>
    `;
    main.appendChild(card);

    loadJournalHistory();
}

async function submitCareJournal() {
    const textarea = document.getElementById('journal-textarea');
    const resultBox = document.getElementById('journal-result');
    const rawInput = textarea.value.trim();

    if (!rawInput) {
        alert('Please write or speak something first.');
        return;
    }

    resultBox.innerHTML = '<div class="dash-muted">Structuring your note...</div>';

    try {
        const res = await fetch('/api/care-journal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ rawInput })
        });
        const data = await res.json();

        if (!res.ok) {
            resultBox.innerHTML = `<div style="color:#B23A48;">${escapeHtmlCg(data.error || 'Something went wrong.')}</div>`;
            return;
        }

        resultBox.innerHTML = `
            <div class="dash-empty-note" style="background:var(--sage-bg);">
                <strong>Saved ✅</strong><br>
                "${escapeHtmlCg(data.entry.summarySentence)}"<br><br>
                🍚 ${escapeHtmlCg(data.entry.appetite)} · 😴 ${escapeHtmlCg(data.entry.sleepQuality)} · 😊 ${escapeHtmlCg(data.entry.mood)} · 🚶 ${escapeHtmlCg(data.entry.activityLevel)} · 💧 ${escapeHtmlCg(data.entry.hydration)}
                ${data.entry.observationNote ? `<br><br>⚠️ ${escapeHtmlCg(data.entry.observationNote)}` : ''}
            </div>
        `;
        textarea.value = '';
        loadJournalHistory();
    } catch (err) {
        resultBox.innerHTML = `<div style="color:#B23A48;">Connection error: ${escapeHtmlCg(err.message)}</div>`;
    }
}

async function loadJournalHistory() {
    const historyBox = document.getElementById('journal-history');
    try {
        const res = await fetch('/api/care-journal', { credentials: 'include' });
        const data = await res.json();
        const rows = (data.entries || []).slice(0, 5).map(e => `
            <div style="font-size:0.85em;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                <strong>${e.date}</strong> — ${escapeHtmlCg(e.summarySentence)}
            </div>
        `).join('');
        historyBox.innerHTML = rows
            ? `<div class="dash-muted" style="font-weight:700;margin-bottom:4px;">Recent Entries</div>${rows}`
            : '';
    } catch (err) {
        // silent — history is a nice-to-have, not critical
    }
}

function escapeHtmlCg(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', function () {
    loadCaregiverDashboard();
    pollEmergencyStatus();
    setInterval(pollEmergencyStatus, 5000);
});

// ========== EMERGENCY ALERT (takeover screen) ==========
// Poll-based, not push — only surfaces while this dashboard is open. See
// server-side note in server.js for why there's no instant notification here.

let currentEmergencyLocation = null;

async function pollEmergencyStatus() {
    try {
        const res = await fetch('/api/emergency/status', { credentials: 'include' });
        if (!res.ok) return; // not logged in, or session expired — ignore quietly
        const data = await res.json();
        const overlay = document.getElementById('emergency-overlay');

        if (data.active) {
            currentEmergencyLocation = data.active.location;
            const time = new Date(data.active.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            document.getElementById('emergency-detail-text').textContent =
                `${data.active.seniorName} has pressed their emergency button at ${time}.`;
            document.getElementById('emergency-location-btn').style.display = data.active.location ? 'inline-block' : 'none';
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    } catch (err) {
        // silent — this is a background poll, not a user-triggered action
    }
}

function openEmergencyLocation() {
    if (!currentEmergencyLocation) return;
    const { latitude, longitude } = currentEmergencyLocation;
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
}

async function resolveEmergencyAlert() {
    try {
        await fetch('/api/emergency/resolve', { method: 'POST', credentials: 'include' });
    } catch (err) {
        // ignore
    }
    document.getElementById('emergency-overlay').classList.remove('active');
}