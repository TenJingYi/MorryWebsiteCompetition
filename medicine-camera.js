// ============================================================
// MORY Medicine Camera Patch
// Adds live camera preview to the Scan Medication modal.
// Add to elderly.html AFTER ui-redesign-patch.js:
//   <script src="medicine-camera.js"></script>
//
// Overrides: openScanMedicationLanding, handleMedicinePhotoSelected
// Adds: live camera stream, canvas image enhancement, scan method badge
// ============================================================

let _cameraStream = null;

// Stop any active camera stream (called on modal close + before file fallback)
function _stopCamera() {
    if (_cameraStream) {
        _cameraStream.getTracks().forEach(t => t.stop());
        _cameraStream = null;
    }
}

// Patch closeElderlyModal to always stop the camera
const _origClose = window.closeElderlyModal;
window.closeElderlyModal = function () {
    _stopCamera();
    if (typeof _origClose === 'function') _origClose();
};

// ── Canvas image pre-processing ──
// Converts to grayscale and boosts contrast — improves OCR accuracy
// significantly on low-contrast or slightly underexposed medicine labels.
function enhanceForOCR(canvas) {
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const contrast = 1.4;       // contrast multiplier
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < d.length; i += 4) {
        // Luminance-weighted grayscale (human perception model)
        const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        const enhanced = Math.min(255, Math.max(0, contrast * gray + intercept));
        d[i] = d[i+1] = d[i+2] = enhanced; // grayscale
    }
    ctx.putImageData(img, 0, 0);
}

// ── Capture from live camera feed ──
function _captureFromCamera() {
    const video = document.getElementById('mory-scan-video');
    if (!video || !video.srcObject) return;

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Pre-process for better OCR fallback
    enhanceForOCR(canvas);

    _stopCamera();
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

    const selectedDialect = document.getElementById('dialect-picker')?.value || 'english';
    _processScan(imageBase64, selectedDialect);
}

// ── Shared processing function (used by both camera capture + file upload) ──
async function _processScan(imageBase64, selectedDialect) {
    const setStep = (label, pct) => {
        const s = document.getElementById('scan-step');
        const b = document.getElementById('scan-bar');
        if (s) s.textContent = label;
        if (b) b.style.width = pct + '%';
    };

    openElderlyModal('📷 Reading Label...', `
        <div style="text-align:center;padding:10px 0;">
            <div style="font-size:2.5em;margin-bottom:10px;">🔍</div>
            <div id="scan-step" style="font-weight:700;color:var(--purple-main);margin-bottom:8px;">
                Preparing image...
            </div>
            <div style="background:var(--purple-light);border-radius:999px;height:8px;margin:10px auto;width:85%;overflow:hidden;">
                <div id="scan-bar" style="height:100%;width:5%;background:var(--purple-main);border-radius:999px;transition:width 0.5s ease;"></div>
            </div>
            <div style="font-size:0.72em;opacity:0.55;margin-top:10px;">
                Reading label with OCR + Gonka AI...
            </div>
        </div>`);

    try {
        setStep('Running OCR on label...', 30);
        await new Promise(r => setTimeout(r, 200)); // let progress bar render

        const res = await fetch('/api/scan-medicine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, dialect: selectedDialect })
        });

        setStep('Processing result...', 85);
        if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.error || `Server error ${res.status}`); }

        const data = await res.json();
        await new Promise(r => setTimeout(r, 300));

        _renderScanResult(data, selectedDialect);
    } catch (err) {
        openElderlyModal('📷 Scan Failed', `
            <div style="text-align:left;padding:6px 0;">
                <strong>MORY:</strong> Sorry, I couldn't read that photo.<br><br>
                <small style="opacity:0.65;">${String(err.message).slice(0,120)}</small>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;">
                <button class="action-btn" onclick="openScanMedicationLanding()" style="flex:1;">🔁 Try Again</button>
                <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;background:#3B5E43;">✅ Done</button>
            </div>`);
    }
}

// ── Scan result renderer (improved with scan method badge) ──
function _renderScanResult(data, dialect) {
    const disclaimer = data.disclaimer || 'Reading guide only — not medical advice.';
    const cdId = 'cg-' + Date.now();
    const canAdd = !!(data.medicineName && (data.dosage || data.purposePlain));
    const payload = JSON.stringify({ name: data.medicineName||'', purpose: data.purposePlain||'', dosage: data.dosage||'', timing: data.timing||'' }).replace(/'/g,'&#39;');

    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // Scan method badge
    const methodBadge = data.scanMethod === 'vision'
        ? `<span style="background:#1D9E75;color:white;font-size:0.68em;padding:2px 9px;border-radius:999px;font-weight:700;">👁 Vision AI</span>`
        : data.scanMethod === 'ocr'
        ? `<span style="background:#6D3B97;color:white;font-size:0.68em;padding:2px 9px;border-radius:999px;font-weight:700;">📄 OCR + AI</span>`
        : '';

    const consensusBadge = data.consensus
        ? `<span style="background:#378ADD;color:white;font-size:0.68em;padding:2px 9px;border-radius:999px;font-weight:700;">✓ Consensus</span>`
        : '';

    if (!data.legible) {
        openElderlyModal('📷 Photo Not Clear', `
            <div style="padding:6px 0;"><strong>MORY:</strong> "${esc(data.elderlySummary||"I couldn't read this. Try again in better light?")}"</div>
            <div style="font-size:0.72em;opacity:0.6;margin-top:8px;">⚠️ ${esc(disclaimer)}</div>
            <div style="display:flex;gap:8px;margin-top:14px;">
                <button class="action-btn" onclick="openScanMedicationLanding()" style="flex:1;">📷 Try Again</button>
                <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;background:#3B5E43;">✅ Done</button>
            </div>`);
        if (typeof speakReply === 'function') speakReply(data.elderlySummary, dialect);
        return;
    }

    openElderlyModal(
        `💊 ${esc(data.medicineName || 'Medicine Info')}`,
        `<div style="padding:6px 0;font-size:1.05em;line-height:1.6;">
            <strong>MORY says:</strong><br>"${esc(data.elderlySummary || '')}"
         </div>
         <div style="font-size:0.72em;opacity:0.6;margin-top:8px;">⚠️ ${esc(disclaimer)}</div>

         ${canAdd ? `<button class="action-btn" style="background:#3B5E43;margin-top:14px;"
             onclick="(async()=>{const p=JSON.parse(this.getAttribute('data-p'));this.textContent='⏳ Saving...';this.disabled=true;const ok=await addScannedMedicineToPills(p.name,p.purpose,p.dosage,p.timing);if(ok){this.textContent='✅ Added to My Pills!';this.style.background='#1a4a28';}else{this.textContent='➕ Add to My Pills';this.disabled=false;}})()" data-p='${payload}'>
             ➕ Add to My Pills
         </button>` : ''}

         <!-- Medicine Knowledge Panel (OCR path only — Gonka medical analysis) -->
         ${data.medicineKnowledge ? `
         <div style="background:#EDE8F7;border-radius:14px;padding:14px;margin-top:12px;border-left:4px solid var(--purple-main);">
             <div style="font-size:0.78em;font-weight:800;color:var(--purple-main);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                 💜 About this medicine
                 <span style="background:var(--purple-main);color:white;font-size:0.75em;padding:1px 8px;border-radius:999px;font-weight:700;">Gonka AI</span>
             </div>
             ${data.medicineKnowledge.whatItIs ? `<div style="margin-bottom:8px;font-size:0.88em;line-height:1.6;"><strong>What it does:</strong> ${esc(data.medicineKnowledge.whatItIs)}</div>` : ''}
             ${data.medicineKnowledge.whyDoctorGivesIt ? `<div style="margin-bottom:8px;font-size:0.88em;line-height:1.6;"><strong>Why doctors prescribe it:</strong> ${esc(data.medicineKnowledge.whyDoctorGivesIt)}</div>` : ''}
             ${data.medicineKnowledge.importantReminder ? `<div style="margin-bottom:8px;font-size:0.88em;line-height:1.6;background:white;border-radius:8px;padding:8px;">💡 ${esc(data.medicineKnowledge.importantReminder)}</div>` : ''}
             ${data.medicineKnowledge.commonSideEffects ? `<div style="font-size:0.82em;opacity:0.75;line-height:1.5;"><strong>Side effects to watch for:</strong> ${esc(data.medicineKnowledge.commonSideEffects)}</div>` : ''}
             <div style="font-size:0.68em;opacity:0.5;margin-top:8px;border-top:1px solid rgba(109,59,151,0.15);padding-top:6px;">
                 This is general AI knowledge — not a prescription or medical advice. Always follow your doctor's instructions.
             </div>
         </div>` : ''}

         <button class="action-btn" style="background:var(--purple-deep);margin-top:10px;"
             onclick="const e=document.getElementById('${cdId}');e.style.display=e.style.display==='none'?'block':'none';this.textContent=e.style.display==='none'?'👨‍👩‍👧 Caregiver Details':'👆 Hide Details';">
             👨‍👩‍👧 Caregiver Details
         </button>

         <div id="${cdId}" style="display:none;margin-top:10px;background:var(--sage-bg);border-radius:14px;padding:14px;font-size:0.85em;line-height:1.8;">
             <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">${methodBadge} ${consensusBadge}</div>
             <strong>Medicine:</strong> ${esc(data.medicineName)||'—'}<br>
             <strong>Purpose:</strong> ${esc(data.purposePlain)||'—'}<br>
             <strong>Dosage:</strong> ${esc(data.dosage)||'—'}<br>
             <strong>Timing:</strong> ${esc(data.timing)||'—'}<br>
             <strong>Warnings:</strong> ${esc(data.warnings)||'None printed'}<br><br>
             <strong>Caregiver note:</strong> ${esc(data.caregiverNote)||'—'}<br>
             ${data.ocrConfidence ? `<div style="font-size:0.8em;opacity:0.6;margin-top:4px;">OCR confidence: ${data.ocrConfidence}%</div>` : ''}
             <details style="margin-top:8px;"><summary style="cursor:pointer;color:var(--purple-main);font-weight:700;">📄 Raw OCR text</summary>
                 <div style="white-space:pre-wrap;font-size:0.85em;opacity:0.7;background:white;border-radius:8px;padding:8px;margin-top:4px;">${esc(data.ocrText)||'(vision scan — no OCR text)'}</div>
             </details>
             ${data.gonkaRequestId ? `<details style="margin-top:6px;"><summary style="cursor:pointer;color:var(--purple-main);font-weight:700;font-size:0.88em;">🔗 Gonka Request IDs</summary>
                 <div style="font-size:0.75em;word-break:break-all;opacity:0.55;margin-top:4px;">Label scan: ${esc(data.gonkaRequestId)}</div>
                 ${data.secondaryGonkaRequestId?`<div style="font-size:0.75em;word-break:break-all;opacity:0.45;">Consensus: ${esc(data.secondaryGonkaRequestId)}</div>`:''}
                 ${data.knowledgeGonkaRequestId?`<div style="font-size:0.75em;word-break:break-all;opacity:0.45;">Knowledge: ${esc(data.knowledgeGonkaRequestId)}</div>`:''}
             </details>` : ''}
         </div>

         <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
             <button class="action-btn" onclick="openScanMedicationLanding()" style="flex:1;background:var(--purple-deep);">🔁 Scan Another</button>
             <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;background:#3B5E43;">✅ Done</button>
         </div>`
    );

    if (typeof speakReply === 'function') speakReply(data.elderlySummary, dialect);
}

// ── Main landing screen: live camera + file fallback ──
window.openScanMedicationLanding = function () {
    _stopCamera(); // clean up any previous stream

    openElderlyModal('📷 Scan Medication', `
        <div style="text-align:center;">

            <!-- Live camera viewfinder -->
            <div id="scan-viewfinder" style="position:relative;border-radius:16px;overflow:hidden;background:#111;margin-bottom:14px;min-height:200px;display:flex;align-items:center;justify-content:center;">

                <video id="mory-scan-video" autoplay playsinline muted
                       style="width:100%;border-radius:16px;display:block;max-height:260px;object-fit:cover;"></video>

                <!-- Alignment guide overlay -->
                <div style="position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;">
                    <div style="width:80%;height:50%;border:2px solid rgba(255,255,255,0.6);border-radius:10px;position:relative;">
                        <!-- Corner marks -->
                        <div style="position:absolute;top:-2px;left:-2px;width:16px;height:16px;border-top:4px solid #F5C842;border-left:4px solid #F5C842;border-radius:2px 0 0 0;"></div>
                        <div style="position:absolute;top:-2px;right:-2px;width:16px;height:16px;border-top:4px solid #F5C842;border-right:4px solid #F5C842;border-radius:0 2px 0 0;"></div>
                        <div style="position:absolute;bottom:-2px;left:-2px;width:16px;height:16px;border-bottom:4px solid #F5C842;border-left:4px solid #F5C842;border-radius:0 0 0 2px;"></div>
                        <div style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-bottom:4px solid #F5C842;border-right:4px solid #F5C842;border-radius:0 0 2px 0;"></div>
                    </div>
                </div>

                <!-- No camera message (shown by JS if camera denied) -->
                <div id="scan-no-camera" style="display:none;color:white;padding:20px;font-size:0.9em;opacity:0.8;">
                    <div style="font-size:2em;margin-bottom:8px;">📷</div>
                    Camera not available.<br>Use "Choose Image" below.
                </div>
            </div>

            <!-- Tips -->
            <div style="font-size:0.78em;opacity:0.7;margin-bottom:12px;text-align:left;padding:0 4px;">
                <strong>Tips:</strong> Keep label flat · Good lighting · Fill the frame · Hold steady
            </div>

            <!-- Primary action: capture from camera -->
            <button id="scan-capture-btn" onclick="_captureFromCamera()"
                    style="width:100%;background:var(--purple-main);color:white;border:none;border-radius:16px;
                           padding:16px;font-weight:800;font-size:1em;cursor:pointer;margin-bottom:8px;">
                📸 Capture Photo
            </button>

            <!-- Fallback: file picker -->
            <label for="medicine-photo-input"
                   style="display:block;background:var(--sage-bg);color:var(--purple-main);
                          border-radius:16px;padding:12px;font-weight:700;font-size:0.88em;cursor:pointer;text-align:center;">
                📁 Choose from Gallery
            </label>

            <div style="font-size:0.68em;opacity:0.5;margin-top:10px;text-align:left;">
                ⚠️ Reading aid only — not medical advice. Always confirm with your pharmacist or doctor.
            </div>
        </div>`);

    // Start camera after modal renders
    setTimeout(_startCamera, 150);
};

async function _startCamera() {
    const video = document.getElementById('mory-scan-video');
    const noCamera = document.getElementById('scan-no-camera');
    const captureBtn = document.getElementById('scan-capture-btn');
    if (!video) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' }, // rear camera on mobile
                width:  { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        _cameraStream = stream;
        video.srcObject = stream;
        video.style.display = 'block';
    } catch (err) {
        console.log('Camera not available:', err.message);
        if (video) video.style.display = 'none';
        if (noCamera) noCamera.style.display = 'block';
        if (captureBtn) {
            captureBtn.style.opacity = '0.4';
            captureBtn.disabled = true;
            captureBtn.textContent = '📷 Camera not available';
        }
    }
}

// File picker fallback — also runs image enhancement before sending
window.handleMedicinePhotoSelected = async function (event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    _stopCamera();

    const selectedDialect = document.getElementById('dialect-picker')?.value || 'english';

    // Compress + enhance
    openElderlyModal('📷 Preparing...', `<div style="text-align:center;padding:20px;font-size:1.5em;">🔄</div>`);

    try {
        const imageBase64 = await _compressAndEnhance(file);
        if (!imageBase64) throw new Error('Could not read the photo file.');
        _processScan(imageBase64, selectedDialect);
    } catch (err) {
        openElderlyModal('📷 Error', `<div style="color:var(--danger);">${err.message}</div><button class="action-btn" onclick="openScanMedicationLanding()" style="margin-top:12px;">Try Again</button>`);
    }
};

async function _compressAndEnhance(file, maxWidth = 1200) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            // Enhance for OCR fallback
            enhanceForOCR(canvas);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
    });
}

// Expose globals needed by inline onclick handlers
window._captureFromCamera = _captureFromCamera;
window._processScan = _processScan;
window._startCamera = _startCamera;
window._stopCamera = _stopCamera;
window.addScannedMedicineToPills = window.addScannedMedicineToPills || async function (name, purpose, dosage, timing) {
    let time = '08:00';
    const m = (timing||'').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (m) { let h=parseInt(m[1]),mn=parseInt(m[2]||'0'),mer=(m[3]||'').toLowerCase(); if(mer==='pm'&&h<12)h+=12; if(mer==='am'&&h===12)h=0; time=`${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`; }
    try {
        const r=await fetch('/api/pills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name||'Unknown',purpose:purpose||'',dosage:dosage||'',time})});
        if(!r.ok) throw new Error('Server error');
        if(typeof refreshPillsBadge==='function') refreshPillsBadge();
        return true;
    } catch(e) { alert('Could not add: '+e.message); return false; }
};

console.log('✅ Medicine camera patch loaded');