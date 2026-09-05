// ========== LOGIN PAGE ==========

function getRoleFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('role'); // 'family' | 'caregiver' | null
}

function switchAuthTab(tab) {
    const signinTab = document.getElementById('tab-signin');
    const signupTab = document.getElementById('tab-signup');
    const signinForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    if (!signinTab || !signupTab) return;

    const isSignin = tab === 'signin';
    signinTab.classList.toggle('active', isSignin);
    signupTab.classList.toggle('active', !isSignin);
    signinForm.style.display = isSignin ? 'block' : 'none';
    signupForm.style.display = isSignin ? 'none' : 'block';
    document.getElementById('login-error').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    const subtitle = document.getElementById('role-subtitle');
    const role = getRoleFromQuery();
    if (subtitle && role) {
        const labels = { family: 'Family sign in', caregiver: 'Caregiver sign in' };
        subtitle.textContent = labels[role] || 'Welcome to MORY!';
    }

    const signinForm = document.getElementById('login-form');
    if (!signinForm) return; // this script also loads on the welcome/dashboard pages — nothing else to do there

    signinForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorBox = document.getElementById('login-error');
        errorBox.style.display = 'none';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                errorBox.textContent = data.error || 'Could not sign in.';
                errorBox.style.display = 'block';
                return;
            }

            // Always trust the server's role, not whatever ?role= was in the URL
            window.location.href = data.user.role === 'caregiver' ? '/caregiver' : '/family';

        } catch (err) {
            errorBox.textContent = 'Connection error: ' + err.message;
            errorBox.style.display = 'block';
        }
    });

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const errorBox = document.getElementById('login-error');
            errorBox.style.display = 'none';

            const signupRole = role || 'family'; // fall back sensibly if opened without ?role=

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, email, password, role: signupRole })
                });
                const data = await res.json();

                if (!res.ok) {
                    errorBox.textContent = data.error || 'Could not create account.';
                    errorBox.style.display = 'block';
                    return;
                }

                window.location.href = data.user.role === 'caregiver' ? '/caregiver' : '/family';

            } catch (err) {
                errorBox.textContent = 'Connection error: ' + err.message;
                errorBox.style.display = 'block';
            }
        });
    }
});

// ========== SHARED DASHBOARD AUTH GUARD ==========
// Call this at the top of both family-dashboard.html and caregiver-dashboard.html.
// Redirects to login if not authenticated or wrong role; otherwise resolves
// with the logged-in user.
async function requireAuth(expectedRole) {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
            window.location.href = '/login?role=' + expectedRole;
            return null;
        }
        const data = await res.json();
        if (data.user.role !== expectedRole) {
            window.location.href = '/login?role=' + expectedRole;
            return null;
        }
        return data.user;
    } catch (err) {
        window.location.href = '/login?role=' + expectedRole;
        return null;
    }
}

async function logoutAndRedirect() {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
        // ignore — redirecting anyway
    }
    window.location.href = '/';
}

// ========== SOS / EMERGENCY ALERT (welcome screen) ==========

function bindHoldToAlert(buttonEl, overlayEl) {
    if (!buttonEl) return;
    let holdTimer = null;
    let holding = false;

    const start = () => {
        if (holding) return;
        holding = true;
        buttonEl.classList.add('holding');
        holdTimer = setTimeout(() => {
            triggerSosAlert(overlayEl);
        }, 3000);
    };
    const cancelHold = () => {
        holding = false;
        buttonEl.classList.remove('holding');
        clearTimeout(holdTimer);
    };

    buttonEl.addEventListener('mousedown', start);
    buttonEl.addEventListener('touchstart', start, { passive: true });
    buttonEl.addEventListener('mouseup', cancelHold);
    buttonEl.addEventListener('mouseleave', cancelHold);
    buttonEl.addEventListener('touchend', cancelHold);
}

async function triggerSosAlert(overlayEl) {
    let latitude = null, longitude = null;

    // Best-effort location — alert still fires even if geolocation is denied/unavailable
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

    if (overlayEl) overlayEl.style.display = 'block';
}

async function cancelSosAlert() {
    try {
        await fetch('/api/emergency/cancel', { method: 'POST' });
    } catch (err) {
        // ignore — hiding the overlay either way
    }
    const overlay = document.getElementById('sos-overlay');
    if (overlay) overlay.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    const sosBtn = document.getElementById('welcome-sos-btn');
    const sosOverlay = document.getElementById('sos-overlay');
    if (sosBtn) bindHoldToAlert(sosBtn, sosOverlay);
});