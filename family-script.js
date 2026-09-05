function formatTime12h(timeStr) {
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const STATUS_CLASS = { taken: 'pill-taken', due: 'pill-due', overdue: 'pill-overdue', upcoming: 'pill-upcoming' };
const STATUS_LABEL = { taken: '✅ Taken', due: '⏰ Due Now', overdue: '🔴 Overdue', upcoming: '🕒 Upcoming' };

async function loadFamilyDashboard() {
    const user = await requireAuth('family');
    if (!user) return; // requireAuth already redirected

    const main = document.getElementById('dash-main');

    let summary;
    try {
        const res = await fetch('/api/dashboard/summary', { credentials: 'include' });
        summary = await res.json();
    } catch (err) {
        main.innerHTML = `<div class="dash-card">Couldn't load the dashboard right now.<br><small>${err.message}</small></div>`;
        return;
    }

    const medRows = summary.medication.items.map(m => `
        <div class="dash-row">
            <div>
                <strong>${escapeHtmlDash(m.name)}</strong> — ${escapeHtmlDash(m.dosage)}<br>
                <span class="dash-muted">${escapeHtmlDash(m.purpose)} · ${formatTime12h(m.time)}</span>
            </div>
            <span class="dash-status-pill ${STATUS_CLASS[m.status]}">${STATUS_LABEL[m.status]}</span>
        </div>
    `).join('');

    main.innerHTML = `
        <div class="dash-card">
            <h2>👵 ${escapeHtmlDash(summary.elderlyName)} — Today's Overview</h2>
            <div class="dash-row">
                <span>💊 Medication</span>
                <strong>${summary.medication.completed}/${summary.medication.total} completed</strong>
            </div>
            <div class="dash-row">
                <span>🧠 Brain Game</span>
                <strong>${summary.brainGame.completedToday ? '✅ Completed' : '— Not yet today'} · 🔥 ${summary.brainGame.streak.current}-day streak</strong>
            </div>
        </div>

        <div class="dash-card">
            <h2>💊 Medication Tracker</h2>
            ${medRows || '<div class="dash-muted">No medications on file.</div>'}
            <div class="dash-empty-note" style="margin-top:10px;">
                This view is read-only for Family. Ask the caregiver to log doses as they're given.
            </div>
        </div>

        <div class="dash-card" id="family-journal-card">
            <h2>📝 Care Journal</h2>
            <div class="dash-muted">Loading...</div>
        </div>
    `;

    loadFamilyCareJournal();
}

async function loadFamilyCareJournal() {
    const card = document.getElementById('family-journal-card');
    try {
        const res = await fetch('/api/care-journal', { credentials: 'include' });
        const data = await res.json();
        const entries = data.entries || [];

        if (entries.length === 0) {
            card.innerHTML = `<h2>📝 Care Journal</h2>
                <div class="dash-empty-note">No care journal entries yet — the caregiver hasn't logged an observation.</div>`;
            return;
        }

        const latest = entries[0];
        const trendRow = entries.slice(0, 5).reverse().map(e =>
            `<div style="text-align:center;flex:1;">
                <div style="font-size:0.75em;opacity:0.6;">${e.date.slice(5)}</div>
                <div style="font-size:0.8em;">${trendIcon(e.appetite)}</div>
             </div>`
        ).join('');

        card.innerHTML = `
            <h2>📝 Care Journal</h2>
            <div class="dash-empty-note" style="background:var(--sage-bg);margin-bottom:10px;">
                <strong>Today (logged by ${escapeHtmlDash(latest.loggedBy)}):</strong><br>
                "${escapeHtmlDash(latest.summarySentence)}"<br><br>
                🍚 ${escapeHtmlDash(latest.appetite)} · 😴 ${escapeHtmlDash(latest.sleepQuality)} · 😊 ${escapeHtmlDash(latest.mood)} · 🚶 ${escapeHtmlDash(latest.activityLevel)} · 💧 ${escapeHtmlDash(latest.hydration)}
                ${latest.observationNote ? `<br><br>⚠️ ${escapeHtmlDash(latest.observationNote)}` : ''}
            </div>
            <div class="dash-muted" style="font-weight:700;margin-bottom:6px;">Appetite — Last ${Math.min(5, entries.length)} Entries</div>
            <div style="display:flex;">${trendRow}</div>
        `;
    } catch (err) {
        card.innerHTML = `<h2>📝 Care Journal</h2><div class="dash-muted">Couldn't load entries.</div>`;
    }
}

function trendIcon(appetite) {
    const icons = { Normal: '🟢', Reduced: '🟡', Increased: '🔵', 'Not mentioned': '⚪' };
    return icons[appetite] || '⚪';
}

function escapeHtmlDash(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', function () {
    loadFamilyDashboard();
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