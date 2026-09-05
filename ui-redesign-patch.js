// ============================================================
// MORY UI Redesign Patch — matches the PDF design mockups
// Add to elderly.html AFTER elderly-script.js:
//   <script src="ui-redesign-patch.js"></script>
// ============================================================

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(t) {
    const [h, m] = (t || '00:00').split(':').map(Number);
    const p = h >= 12 ? 'pm' : 'am', h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}.${String(m).padStart(2,'0')}${p}`;
}

// ──────────────────────────────────────────────
// PILL CHECKLIST — card grid matching PDF design
// Yellow card = taken, Red card = overdue/due, Purple upcoming, Gray = add
// ──────────────────────────────────────────────
window.openPillsChecklist = async function () {
    openElderlyModal('💊 Daily Pill Checklist', '<div style="text-align:center;padding:20px;opacity:0.6;">Loading...</div>');

    let meds;
    try {
        const res = await fetch('/api/pills');
        const data = await res.json();
        meds = data.medications || [];
    } catch (err) {
        openElderlyModal('💊 My Pills', `<p style="color:var(--danger);">Couldn't load medicines.<br><small>${esc(err.message)}</small></p><button class="action-btn" onclick="openPillsChecklist()">Retry</button>`);
        return;
    }

    const CARD = {
        taken:    { bg:'#F5C842', circle:'#6D3B97', icon:'✓', iconColor:'white', textColor:'#221A28' },
        due:      { bg:'#E4574C', circle:'white',   icon:'',  iconColor:'transparent', textColor:'white' },
        overdue:  { bg:'#E4574C', circle:'white',   icon:'',  iconColor:'transparent', textColor:'white' },
        upcoming: { bg:'#EDE8F7', circle:'#9D83C4', icon:'◷', iconColor:'white', textColor:'#3a2060' }
    };

    const cards = meds.map(m => {
        const c = CARD[m.status] || CARD.upcoming;
        const actionBtn = m.status !== 'taken'
            ? `<button onclick="markPillTaken('${m.id}')" style="background:#fff;border:none;border-radius:10px;padding:5px 14px;font-weight:800;font-size:0.8em;cursor:pointer;color:#221A28;margin-top:8px;">Mark Taken</button>`
            : `<span style="font-size:0.75em;opacity:0.7;margin-top:8px;display:block;">Taken today</span>`;

        return `
        <div style="background:${c.bg};border-radius:22px;padding:14px 14px 12px;position:relative;min-height:110px;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);width:34px;height:34px;border-radius:50%;background:${c.circle};border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:1em;color:${c.iconColor};font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.15);">${c.icon}</div>
            <div style="padding-top:12px;">
                <div style="font-size:0.72em;font-weight:700;color:${c.textColor};opacity:0.75;">${formatTime(m.time)}</div>
                <div style="font-weight:900;font-size:1em;color:${c.textColor};margin-top:2px;line-height:1.2;">${esc(m.name)}</div>
                <div style="font-weight:700;font-size:0.9em;color:${c.textColor};opacity:0.85;">${esc(m.dosage)}</div>
            </div>
            <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:6px;">
                ${actionBtn}
                <button onclick="openMedicineForm('${m.id}')" style="background:white;border:none;border-radius:10px;padding:5px 14px;font-weight:800;font-size:0.8em;cursor:pointer;color:#221A28;">Edit</button>
            </div>
        </div>`;
    });

    // Add (+) card
    cards.push(`
    <div onclick="openMedicineForm()" style="background:#E0DDE8;border-radius:22px;min-height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:6px;">
        <div style="width:44px;height:44px;border-radius:50%;border:3px solid #aaa;display:flex;align-items:center;justify-content:center;font-size:1.6em;color:#888;">+</div>
        <span style="font-size:0.8em;color:#888;font-weight:700;">Add Medicine</span>
    </div>`);

    openElderlyModal(
        '💊 Daily Pill Checklist',
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:22px 14px;padding:10px 0 4px;">
            ${cards.join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button class="action-btn" onclick="openPillsHistory()" style="flex:1;background:#F5C842;color:#221A28;display:flex;align-items:center;justify-content:center;gap:6px;">
                ⏮ View History
            </button>
        </div>`
    );
};

// ──────────────────────────────────────────────
// CALL FAMILY — colored contact card grid
// ──────────────────────────────────────────────
const CARD_COLORS = ['#FFB3C1', '#C9A9E9', '#F5C842', '#B3D9FF'];

window.openCallFamily = async function () {
    openElderlyModal('📞 Call Someone', '<div style="text-align:center;padding:20px;opacity:0.6;">Loading...</div>');

    let contacts;
    try {
        const res = await fetch('/api/contacts');
        contacts = (await res.json()).contacts || [];
    } catch (err) {
        openElderlyModal('📞 Call Family', `<p style="color:var(--danger);">Couldn't load contacts.</p><button class="action-btn" onclick="openCallFamily()">Retry</button>`);
        return;
    }

    const cards = contacts.map((c, i) => {
        const bg = CARD_COLORS[i % CARD_COLORS.length];
        const photo = c.photo
            ? `<img src="${esc(c.photo)}" style="width:70px;height:70px;object-fit:cover;border-radius:50%;border:3px solid white;">`
            : `<div style="width:70px;height:70px;border-radius:50%;background:#ddd;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:1.8em;">👤</div>`;

        return `
        <div style="background:${bg};border-radius:22px;padding:14px 12px 12px 16px;position:relative;min-height:100px;">
            <div style="position:absolute;top:50%;left:-30px;transform:translateY(-50%);width:70px;height:70px;border-radius:50%;overflow:hidden;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.15);">${photo}</div>
            <div style="position:absolute;top:12px;right:12px;width:38px;height:38px;border-radius:50%;background:#E4574C;display:flex;align-items:center;justify-content:center;">
                <a href="tel:${esc(c.phone)}" style="color:white;font-size:1.2em;text-decoration:none;display:flex;">📞</a>
            </div>
            <div style="margin-left:46px;padding-right:40px;">
                <div style="font-weight:900;font-size:1em;color:#221A28;line-height:1.2;">${esc(c.name)}</div>
                <div style="font-size:0.8em;font-weight:700;color:#444;margin-top:2px;">${esc(c.phone)}</div>
            </div>
            <div style="margin-left:46px;margin-top:8px;">
                <button onclick="openContactForm('${c.id}')" style="background:white;border:none;border-radius:10px;padding:4px 14px;font-weight:800;font-size:0.78em;cursor:pointer;color:#221A28;">Edit</button>
            </div>
        </div>`;
    });

    // Add (+) card
    cards.push(`
    <div onclick="openContactForm()" style="background:#E0DDE8;border-radius:22px;min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:6px;">
        <div style="width:44px;height:44px;border-radius:50%;border:3px solid #aaa;display:flex;align-items:center;justify-content:center;font-size:1.6em;color:#888;">+</div>
        <span style="font-size:0.8em;color:#888;font-weight:700;">Add Contact</span>
    </div>`);

    openElderlyModal(
        '📞 Call Someone',
        `<style>
            #contact-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px 36px; padding:10px 0 4px; }
        </style>
        <div id="contact-grid">${cards.join('')}</div>`
    );
};

// ──────────────────────────────────────────────
// EMERGENCY SCREENS — matching PDF design
// ──────────────────────────────────────────────

// In-app alert hold button (senior side)
window.openAlertScreen = function () {
    openElderlyModal(
        '🚨 Emergency Alert',
        `<div style="text-align:center;padding:10px 0;">
            <p style="opacity:0.75;margin-bottom:20px;">Press and hold the button below for 3 seconds to alert your family.</p>
            <button id="in-app-alert-btn"
                style="width:160px;height:160px;border-radius:50%;background:#E4574C;color:white;border:6px solid rgba(255,255,255,0.6);font-weight:900;font-size:0.95em;cursor:pointer;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;user-select:none;touch-action:manipulation;transition:transform 0.1s;"
                onmousedown="startInAppAlertHold()" onmouseup="endInAppAlertHold()" onmouseleave="endInAppAlertHold()"
                ontouchstart="startInAppAlertHold()" ontouchend="endInAppAlertHold()">
                <span style="font-size:2em;">🚨</span>
                <span>Press &amp; hold<br>3 seconds</span>
            </button>
        </div>`
    );
};

// After 3-second hold → "HELP IS ON THE WAY" screen (matches PDF)
window.triggerInAppAlert = async function () {
    let latitude = null, longitude = null;
    try {
        const pos = await new Promise((res,rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(res,rej,{timeout:4000}) : rej('no geo'));
        latitude = pos.coords.latitude; longitude = pos.coords.longitude;
    } catch (e) {}

    try { await fetch('/api/emergency/alert', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({latitude, longitude, seniorName:'Ah Ma'}) }); }
    catch (e) { console.error('SOS alert failed:', e); }

    openElderlyModal(
        'Emergency Contact (Senior)',
        `<div style="text-align:center;padding:10px 0;">
            <div style="font-size:3.5em;margin-bottom:10px;">🚨</div>
            <div style="background:#E4574C;color:white;font-weight:900;font-size:1.15em;padding:14px 20px;border-radius:999px;margin-bottom:16px;letter-spacing:0.05em;">
                HELP IS ON THE WAY!!!
            </div>
            <p style="font-weight:700;font-size:1.05em;color:var(--purple-main);margin-bottom:24px;">
                Your family members<br>have been notified.
            </p>
            <button onclick="cancelInAppAlert()"
                style="background:var(--purple-main);color:white;border:none;border-radius:18px;padding:16px 24px;font-weight:700;font-size:0.9em;cursor:pointer;width:100%;max-width:300px;">
                Tap here to cancel<br>if you accidentally pressed the button
            </button>
        </div>`
    );
};

// ──────────────────────────────────────────────
// TALK TO MORY MODAL — show Gonka Request ID + consensus badge
// ──────────────────────────────────────────────

// Override sendToGonkaCompanion to show Gonka IDs
const _origSendToGonka = window.sendToGonkaCompanion;
window.sendToGonkaCompanion = async function (userVoiceText) {
    if (typeof isProcessing !== 'undefined' && isProcessing) {
        openElderlyModal('⏳ Please Wait', 'MORY is still thinking...');
        return;
    }

    const selectedDialect = document.getElementById('dialect-picker')?.value || 'english';

    if (typeof saidGoodbye === 'function' && saidGoodbye(userVoiceText, selectedDialect)) {
        if (typeof endConversation === 'function') endConversation(selectedDialect);
        return;
    }

    if (typeof isProcessing !== 'undefined') window.isProcessing = true;

    const dialectLabel = {cantonese:'Cantonese',hokkien:'Hokkien',hakka:'Hakka',mandarin:'Mandarin',bm:'Bahasa Melayu',english:'English'}[selectedDialect] || selectedDialect;

    openElderlyModal(
        '💜 Talking to MORY',
        `<div style="text-align:center;padding:10px 0;">
            <div style="font-size:3em;margin-bottom:8px;">💜</div>
            <div style="font-weight:700;color:var(--purple-main);margin-bottom:6px;">Connecting to Gonka Network...</div>
            <div style="font-size:0.8em;opacity:0.6;margin-bottom:4px;">Routing via ${dialectLabel} node</div>
            <div style="font-size:0.75em;opacity:0.45;font-style:italic;">"${esc(userVoiceText)}"</div>
            <div style="background:var(--purple-light);border-radius:999px;height:6px;margin:14px auto;width:80%;overflow:hidden;">
                <div style="height:100%;width:60%;background:var(--purple-main);border-radius:999px;animation:pulse-bar 1.2s ease-in-out infinite;"></div>
            </div>
        </div>
        <style>@keyframes pulse-bar{0%,100%{opacity:0.4;width:30%}50%{opacity:1;width:80%}}</style>`
    );

    try {
        const history = typeof conversationHistory !== 'undefined' ? conversationHistory : [];
        const response = await fetch('/api/companion/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userMessage: userVoiceText,
                dialect: selectedDialect,
                conversationHistory: history.slice(-12),
                memoryContext: {}
            })
        });
        if (!response.ok) { const e = await response.json().catch(()=>{}); throw new Error(e?.error||`HTTP ${response.status}`); }

        const data = await response.json();

        if (typeof conversationHistory !== 'undefined') {
            conversationHistory.push({role:'user',content:userVoiceText});
            conversationHistory.push({role:'assistant',content:data.reply});
            if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);
        }

        // Consensus badge
        const consensusBadge = data.consensus
            ? `<span style="background:#1D9E75;color:white;font-size:0.65em;padding:2px 8px;border-radius:999px;font-weight:700;margin-left:6px;">✓ Consensus</span>`
            : '';

        // Gonka Request ID (for competition transparency)
        const gonkaIds = data.gonkaRequestId
            ? `<details style="margin-top:8px;font-size:0.68em;opacity:0.55;">
                <summary style="cursor:pointer;color:var(--purple-main);">🔗 Gonka IDs</summary>
                <div style="word-break:break-all;padding:4px 0;">${esc(data.gonkaRequestId)}</div>
                ${data.secondaryGonkaRequestId ? `<div style="word-break:break-all;padding:2px 0;opacity:0.7;">${esc(data.secondaryGonkaRequestId)}</div>` : ''}
               </details>`
            : '';

        const fallbackNote = data.fallback
            ? `<div style="font-size:0.75em;color:#E4574C;margin-top:6px;">⚠️ Offline mode — using pre-written response</div>`
            : '';

        openElderlyModal(
            `💜 MORY`,
            `<div style="padding:6px 0;">
                <div style="font-size:1.05em;line-height:1.6;margin-bottom:10px;">
                    <strong>MORY:</strong> "${esc(data.reply)}"
                </div>
                <div style="font-size:0.72em;opacity:0.55;display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>🗣️ ${dialectLabel}</span>
                    <span>·</span>
                    <span>🤖 ${esc((data.model||'').split('/').pop())}</span>
                    ${consensusBadge}
                    <span>·</span>
                    <span>${data.fallback ? '📡 Offline' : '🌐 Gonka'}</span>
                </div>
                ${fallbackNote}
                ${gonkaIds}
                ${typeof conversationActive !== 'undefined' && conversationActive ? '<div style="font-size:0.72em;opacity:0.6;margin-top:8px;">🎙️ Listening again after MORY finishes speaking...</div>' : ''}
             </div>
             <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                <button class="action-btn" onclick="sendQuickReply()" style="flex:1;min-width:100px;">💬 Quick Reply</button>
                <button class="action-btn" onclick="endConversation('${selectedDialect}')" style="flex:1;min-width:100px;background-color:#E4574C;">🛑 Stop</button>
             </div>`
        );

        if (typeof silenceStrikes !== 'undefined') window.silenceStrikes = 0;
        if (typeof speakReply === 'function') speakReply(data.reply, selectedDialect);

    } catch (err) {
        console.error('Gonka error:', err);
        const offline = {cantonese:'阿嫲，MORY 聽到你！稍等一下。',hokkien:'阿嫲，MORY 聽到你！等一下。',hakka:'阿嬤，MORY 聽到你！等下。',mandarin:'奶奶，MORY听到您！请稍等。',english:'Ah Ma, MORY is listening! How can I help?',bm:'Nenek, MORY mendengar! Apa boleh saya bantu?'}[selectedDialect] || 'MORY is here!';
        openElderlyModal('💜 MORY (Offline)', `<div style="padding:6px 0;"><strong>MORY:</strong> "${esc(offline)}"</div><div style="font-size:0.72em;color:#E4574C;margin-top:6px;">📡 Offline mode</div><div style="display:flex;gap:8px;margin-top:14px;"><button class="action-btn" onclick="sendQuickReply()" style="flex:1;">💬 Try Again</button><button class="action-btn" onclick="endConversation('${selectedDialect}')" style="flex:1;background-color:#E4574C;">🛑 Stop</button></div>`);
        if (typeof speakReply === 'function') speakReply(offline, selectedDialect);
    } finally {
        if (typeof isProcessing !== 'undefined') window.isProcessing = false;
    }
};

// ──────────────────────────────────────────────
// MEDICINE SCAN — improved with Gonka consensus display
// ──────────────────────────────────────────────
window.openScanMedicationLanding = function () {
    openElderlyModal(
        '📷 Scan Medication',
        `<div style="text-align:center;">
            <div style="border:3px dashed var(--purple-main);background:var(--purple-light);border-radius:18px;padding:20px;margin-bottom:16px;">
                <div style="font-size:2em;margin-bottom:8px;">📷</div>
                <strong style="font-size:1.05em;">Scan your medication here</strong>
                <ul style="text-align:left;font-size:0.85em;margin:10px 0 0 16px;opacity:0.8;line-height:1.9;">
                    <li>Place label flat — don't curve it</li>
                    <li>Good lighting (near a window)</li>
                    <li>Hold phone straight-on, close up</li>
                </ul>
            </div>
            <label for="medicine-photo-input" class="action-btn" style="display:block;cursor:pointer;">
                📷 Take Photo / Choose Image
            </label>
            <div style="font-size:0.72em;opacity:0.55;margin-top:12px;text-align:left;line-height:1.5;">
                ⚠️ Reading aid only — not medical advice. Always confirm with your pharmacist or doctor.
            </div>
        </div>`
    );
};

async function compressImage(file, maxWidth=1200, quality=0.85) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            let {width,height} = img;
            if (width > maxWidth) { height = Math.round(height*maxWidth/width); width = maxWidth; }
            const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,width,height);
            ctx.drawImage(img,0,0,width,height);
            resolve(canvas.toDataURL('image/jpeg',quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>resolve(null); r.readAsDataURL(file); };
        img.src = url;
    });
}

window.handleMedicinePhotoSelected = async function (event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const selectedDialect = document.getElementById('dialect-picker')?.value || 'english';

    openElderlyModal('📷 Reading Label...', `
        <div style="text-align:center;padding:10px 0;">
            <div style="font-size:2.5em;margin-bottom:10px;">🔍</div>
            <div id="scan-step" style="font-weight:700;color:var(--purple-main);margin-bottom:8px;">Step 1 of 3: Preparing photo...</div>
            <div style="background:var(--purple-light);border-radius:999px;height:8px;margin:10px auto;width:85%;overflow:hidden;">
                <div id="scan-bar" style="height:100%;width:10%;background:var(--purple-main);border-radius:999px;transition:width 0.4s;"></div>
            </div>
            <div style="font-size:0.72em;opacity:0.55;margin-top:8px;">⚠️ Reading aid only — not medical advice.</div>
        </div>`);

    const setStep = (label, pct) => {
        const s=document.getElementById('scan-step'), b=document.getElementById('scan-bar');
        if(s) s.textContent=label; if(b) b.style.width=pct+'%';
    };

    try {
        setStep('Step 1 of 3: Compressing photo...', 25);
        const imageBase64 = await compressImage(file);
        if (!imageBase64) throw new Error('Could not read the photo.');

        setStep('Step 2 of 3: Reading label (OCR + Gonka AI)...', 55);
        const res = await fetch('/api/scan-medicine', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({imageBase64, dialect: selectedDialect}) });
        if (!res.ok) { const e=await res.json().catch(()=>{}); throw new Error(e?.error||`Server error ${res.status}`); }

        setStep('Step 3 of 3: Preparing result...', 90);
        const data = await res.json();
        await new Promise(r=>setTimeout(r,300));
        renderMedicineResult(data, selectedDialect);
    } catch (err) {
        openElderlyModal('📷 Scan Failed', `
            <div style="text-align:left;padding:6px 0;">
                <strong>MORY:</strong> Sorry, I couldn't read that photo.<br><br>
                <small style="opacity:0.65;">${esc(err.message)}</small>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;">
                <button class="action-btn" onclick="openScanMedicationLanding()" style="flex:1;">🔁 Try Again</button>
                <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;background-color:#3B5E43;">✅ Done</button>
            </div>`);
    }
};

async function addScannedMedicineToPills(name, purpose, dosage, timing) {
    let time = '08:00';
    const m = (timing||'').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (m) { let h=parseInt(m[1]), mn=parseInt(m[2]||'0'), mer=(m[3]||'').toLowerCase(); if(mer==='pm'&&h<12)h+=12; if(mer==='am'&&h===12)h=0; time=`${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`; }
    try {
        const res = await fetch('/api/pills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name||'Unknown',purpose:purpose||'',dosage:dosage||'',time})});
        if(!res.ok) throw new Error('Server error');
        if(typeof refreshPillsBadge==='function') refreshPillsBadge();
        return true;
    } catch(e) { alert('Could not add: '+e.message); return false; }
}

window.renderMedicineResult = function (data, dialect) {
    const disclaimer = data.disclaimer || 'Reading guide only — not medical advice.';
    const cdId = 'cg-' + Date.now();
    const canAdd = !!(data.medicineName && (data.dosage || data.purposePlain));
    const payload = JSON.stringify({name:data.medicineName||'',purpose:data.purposePlain||'',dosage:data.dosage||'',timing:data.timing||''}).replace(/'/g,'&#39;');

    // Consensus badge
    const consensusBadge = data.consensus
        ? `<span style="background:#1D9E75;color:white;font-size:0.7em;padding:2px 8px;border-radius:999px;font-weight:700;">✓ Dual-model verified</span>`
        : '';

    if (!data.legible) {
        openElderlyModal('📷 Photo Not Clear',
            `<div style="padding:6px 0;"><strong>MORY:</strong> "${esc(data.elderlySummary||"I couldn't read this. Try again?")}"</div>
            <div style="font-size:0.72em;opacity:0.6;margin-top:8px;">⚠️ ${esc(disclaimer)}</div>
            <div style="display:flex;gap:8px;margin-top:14px;">
                <button class="action-btn" onclick="openScanMedicationLanding()" style="flex:1;">🔁 Retake</button>
                <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;background:#3B5E43;">✅ Done</button>
            </div>`);
        if(typeof speakReply==='function') speakReply(data.elderlySummary, dialect);
        return;
    }

    openElderlyModal(
        `💊 ${esc(data.medicineName||'Medicine Info')}`,
        `<div style="padding:6px 0;font-size:1.05em;line-height:1.6;">
            <strong>MORY says:</strong><br>"${esc(data.elderlySummary||'')}"
         </div>
         <div style="font-size:0.72em;opacity:0.6;margin-top:8px;">⚠️ ${esc(disclaimer)}</div>

         ${canAdd ? `<button class="action-btn" style="background:#3B5E43;margin-top:14px;"
             onclick="(async()=>{const p=JSON.parse(this.getAttribute('data-p'));this.textContent='⏳ Saving...';this.disabled=true;const ok=await addScannedMedicineToPills(p.name,p.purpose,p.dosage,p.timing);if(ok){this.textContent='✅ Added to My Pills!';this.style.background='#1a4a28';}else{this.textContent='➕ Add to My Pills';this.disabled=false;}})()" data-p='${payload}'>
             ➕ Add to My Pills
         </button>` : ''}

         <button class="action-btn" style="background:var(--purple-deep);margin-top:10px;"
             onclick="const e=document.getElementById('${cdId}');e.style.display=e.style.display==='none'?'block':'none';this.textContent=e.style.display==='none'?'👨‍👩‍👧 Caregiver Details':'👆 Hide Details';">
             👨‍👩‍👧 Caregiver Details
         </button>

         <div id="${cdId}" style="display:none;margin-top:10px;background:var(--sage-bg);border-radius:14px;padding:14px;font-size:0.85em;line-height:1.7;">
             <strong>Medicine:</strong> ${esc(data.medicineName)||'—'}<br>
             <strong>Purpose:</strong> ${esc(data.purposePlain)||'—'}<br>
             <strong>Dosage:</strong> ${esc(data.dosage)||'—'}<br>
             <strong>Timing:</strong> ${esc(data.timing)||'—'}<br>
             <strong>Warnings:</strong> ${esc(data.warnings)||'None printed'}<br><br>
             <strong>Note:</strong> ${esc(data.caregiverNote)||'—'}<br>
             ${consensusBadge}
             <details style="margin-top:8px;"><summary style="cursor:pointer;color:var(--purple-main);font-weight:700;">📄 Raw OCR text</summary>
                 <div style="white-space:pre-wrap;font-size:0.88em;opacity:0.7;background:white;border-radius:8px;padding:8px;margin-top:4px;">${esc(data.ocrText)||'(none)'}</div>
             </details>
             ${data.gonkaRequestId?`<details style="margin-top:6px;"><summary style="cursor:pointer;color:var(--purple-main);font-weight:700;font-size:0.9em;">🔗 Gonka IDs (transparency)</summary>
                 <div style="font-size:0.78em;word-break:break-all;opacity:0.6;margin-top:4px;">Primary: ${esc(data.gonkaRequestId)}</div>
                 ${data.secondaryGonkaRequestId?`<div style="font-size:0.78em;word-break:break-all;opacity:0.5;">Secondary: ${esc(data.secondaryGonkaRequestId)}</div>`:''}
             </details>`:''}
         </div>

         <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
             <button class="action-btn" onclick="openScanMedicationLanding()" style="flex:1;background:var(--purple-deep);">🔁 Scan Another</button>
             <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;background:#3B5E43;">✅ Done</button>
         </div>`
    );

    if(typeof speakReply==='function') speakReply(data.elderlySummary, dialect);
};

window.addScannedMedicineToPills = addScannedMedicineToPills;
window.compressImage = compressImage;
window.renderMedicineResult = window.renderMedicineResult;

console.log('✅ MORY UI redesign patch loaded');
