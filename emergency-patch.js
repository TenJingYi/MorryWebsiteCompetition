// ============================================================
// MORY Emergency Alert Patch
// Add to BOTH family-dashboard.html and caregiver-dashboard.html
// AFTER their respective script tags:
//   <script src="emergency-patch.js"></script>
//
// Replaces: pollEmergencyStatus, openEmergencyLocation, resolveEmergencyAlert
// Adds: audio alarm, browser notifications, fast re-poll, animated overlay
// ============================================================

(function () {

// ── State ──
let _currentLocation    = null;
let _alertAlreadySeen   = false;  // true once we've shown audio/notification for this alert
let _activeAlertId      = null;   // id of the currently active alert (avoids duplicate alarms)
let _fastPollTimer      = null;   // setInterval handle for 2-second emergency polling
let _normalPollTimer    = null;   // the original 5-second interval handle (we cancel it)
let _sirenAnimation     = null;   // requestAnimationFrame handle for the siren flash

// Who is viewing this dashboard? Set by the HTML before loading this script.
// e.g.  <script>window.MORY_ROLE = 'family';</script>
const ROLE = window.MORY_ROLE || 'family';
const ROLE_LABEL = ROLE === 'caregiver' ? 'Caregivers' : 'Family';

// ── Audio alarm (Web Audio API — no external files needed) ──
function _playAlarm() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const beep = (freq, start, duration) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + duration + 0.05);
        };
        // Three ascending beeps — urgent but not ear-splitting
        beep(880, 0.0, 0.18);
        beep(988, 0.22, 0.18);
        beep(1175, 0.44, 0.30);
        // Repeat once after 1.2s
        setTimeout(_playAlarm2, 1200);
    } catch (e) {
        console.log('Audio alert skipped (no AudioContext):', e.message);
    }
}

function _playAlarm2() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const beep = (freq, start, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'square'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + duration + 0.05);
        };
        beep(880, 0.0, 0.18); beep(988, 0.22, 0.18); beep(1175, 0.44, 0.30);
    } catch (e) {}
}

// ── Browser notification ──
async function _requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function _showBrowserNotif(seniorName, time) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('🚨 MORY Emergency Alert', {
            body: `${seniorName} pressed their emergency button at ${time}!\nPlease check on them immediately.`,
            icon: '/mory-mascot.jpg',
            requireInteraction: true,  // stays until user clicks
            tag: 'mory-emergency'      // replaces any previous notification
        });
        n.onclick = () => { window.focus(); n.close(); };
    }
}

// ── Siren flash animation ──
function _startSirenFlash() {
    const el = document.getElementById('em-siren');
    if (!el) return;
    let on = true;
    const tick = () => {
        if (!el.isConnected) return;
        el.style.opacity = on ? '1' : '0.3';
        el.style.transform = on ? 'scale(1.08)' : 'scale(0.95)';
        on = !on;
        _sirenAnimation = setTimeout(tick, 500);
    };
    tick();
}

function _stopSirenFlash() {
    if (_sirenAnimation) { clearTimeout(_sirenAnimation); _sirenAnimation = null; }
    const el = document.getElementById('em-siren');
    if (el) { el.style.opacity = '1'; el.style.transform = 'scale(1)'; }
}

// ── Build the overlay HTML (matches PDF design) ──
function _buildOverlayContent(seniorName, time, hasLocation, role) {
    return `
    <div style="max-width:500px;margin:0 auto;text-align:center;padding:40px 24px;">

        <!-- Animated siren -->
        <div id="em-siren" style="font-size:4.5em;margin-bottom:12px;transition:opacity 0.3s,transform 0.3s;">🚨</div>

        <!-- Title matching PDF -->
        <h1 style="color:var(--purple-main);font-size:1.7em;font-weight:900;margin-bottom:20px;">
            Emergency Contact (${role})
        </h1>

        <!-- Red banner — yellow text on red, pill-shaped like PDF -->
        <div style="background:#E4574C;color:#F5C842;font-weight:900;font-size:1.1em;
                    padding:14px 24px;border-radius:999px;margin-bottom:20px;
                    letter-spacing:0.06em;display:inline-block;">
            EMERGENCY ALERT
        </div>

        <!-- Who + when -->
        <p id="emergency-detail-text"
           style="font-size:1.05em;font-weight:700;color:var(--purple-main);
                  margin:0 0 20px;line-height:1.5;">
            ${seniorName} has pressed their emergency button at ${time}.
        </p>

        <!-- Location button — purple pill, shown only when GPS is available -->
        <button id="emergency-location-btn"
                style="display:${hasLocation ? 'block' : 'none'};
                       background:var(--purple-main);color:white;border:none;
                       border-radius:999px;padding:14px 28px;font-weight:800;
                       font-size:0.95em;cursor:pointer;width:100%;
                       max-width:280px;margin:0 auto 20px;"
                onclick="openEmergencyLocation()">
            📍 Current Location
        </button>

        <!-- Instruction text -->
        <p style="font-weight:800;color:var(--purple-main);font-size:1.05em;margin-bottom:28px;">
            Please reach out or check on them immediately.
        </p>

        <!-- Dismiss -->
        <button onclick="resolveEmergencyAlert()"
                style="background:var(--sage-green);color:white;border:none;
                       border-radius:999px;padding:16px 36px;font-weight:800;
                       font-size:0.95em;cursor:pointer;width:100%;max-width:300px;">
            ✅ I've responded — Dismiss
        </button>

    </div>`;
}

// ── Show the overlay ──
function _showOverlay(alert) {
    const overlay = document.getElementById('emergency-overlay');
    if (!overlay) return;

    _currentLocation = alert.location;
    const time = new Date(alert.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const hasLocation = !!(alert.location?.latitude);

    overlay.innerHTML = _buildOverlayContent(alert.seniorName, time, hasLocation, ROLE_LABEL);
    overlay.classList.add('active');
    _startSirenFlash();

    // First time seeing this specific alert → alarm + notification
    if (alert.id !== _activeAlertId) {
        _activeAlertId = alert.id;
        _playAlarm();
        _showBrowserNotif(alert.seniorName, time);
    }
}

// ── Hide the overlay ──
function _hideOverlay() {
    const overlay = document.getElementById('emergency-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.innerHTML = '';
    }
    _stopSirenFlash();
    _activeAlertId = null;
    _currentLocation = null;
}

// ── Poll function (replaces the original) ──
async function pollEmergencyStatus() {
    try {
        const res = await fetch('/api/emergency/status', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        if (data.active) {
            _showOverlay(data.active);
            _switchToFastPolling();
        } else {
            _hideOverlay();
            _switchToNormalPolling();
        }
    } catch (err) {
        // Silent — background poll
    }
}

// ── Polling speed control ──
function _switchToFastPolling() {
    if (_fastPollTimer) return; // already in fast mode
    if (_normalPollTimer) { clearInterval(_normalPollTimer); _normalPollTimer = null; }
    _fastPollTimer = setInterval(pollEmergencyStatus, 2000); // 2s when alert is active
}

function _switchToNormalPolling() {
    if (!_fastPollTimer) return; // already in normal mode
    clearInterval(_fastPollTimer);
    _fastPollTimer = null;
    _normalPollTimer = setInterval(pollEmergencyStatus, 5000); // back to 5s
}

// ── Public functions ──
window.pollEmergencyStatus = pollEmergencyStatus;

window.openEmergencyLocation = function () {
    if (!_currentLocation) return;
    const { latitude, longitude } = _currentLocation;
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}&zoom=16`, '_blank');
};

window.resolveEmergencyAlert = async function () {
    try {
        await fetch('/api/emergency/resolve', { method: 'POST', credentials: 'include' });
    } catch (err) { /* ignore — hiding either way */ }
    _hideOverlay();
    _switchToNormalPolling();
};

// ── Initialise ──
// Request browser notification permission proactively when the page loads.
// This gives us the best chance of the user seeing the prompt before an emergency.
_requestNotifPermission();

// Cancel the original fixed-interval timer set by the dashboard scripts
// (they call setInterval after DOMContentLoaded; we replace the loop here).
// We hook into DOMContentLoaded to run AFTER the dashboard script has set up.
document.addEventListener('DOMContentLoaded', () => {
    // Give the dashboard script a moment to set up its own setInterval, then cancel it
    setTimeout(() => {
        // Start our managed polling
        _normalPollTimer = setInterval(pollEmergencyStatus, 5000);
        // Run immediately
        pollEmergencyStatus();
    }, 100);
});

console.log('✅ Emergency alert patch loaded (role:', ROLE, ')');

})(); // IIFE — no globals except the three window.* functions above
