// ============================================================
// MORY — Medicine Scan Patch
// Drop this file into your project and add ONE line to elderly.html:
//   <script src="medicine-scan-patch.js"></script>
// Place it AFTER <script src="elderly-script.js"></script>
//
// This file overrides 4 functions from elderly-script.js:
//   openScanMedicationLanding, handleMedicinePhotoSelected,
//   renderMedicineResult, triggerMedicineScan
// and adds 2 new helpers:
//   compressImage, addScannedMedicineToPills
// ============================================================

// ---- FIX 1 + 2: openScanMedicationLanding ----
// Fixes: typo "close" → "place", iOS file-input click issue
// The <label for="medicine-photo-input"> creates a DIRECT link to the
// hidden file input without any JavaScript in between — this is the only
// approach that reliably opens the camera on iOS Safari.

window.openScanMedicationLanding = function () {
    openElderlyModal(
        '📷 Scan Medication',
        `<div style="text-align:center;">

            <div class="scanner-box" style="padding:18px 16px;">
                <strong style="font-size:1.05em;">📋 Tips for a clear scan</strong>
                <ul style="text-align:left;font-size:0.9em;margin:10px 0 0 18px;opacity:0.85;line-height:2;">
                    <li>Place the label flat — don't curve it</li>
                    <li>Good lighting (near a window or lamp)</li>
                    <li>Hold the phone steady and straight-on</li>
                    <li>Fill the frame with the printed text</li>
                </ul>
            </div>

            <!-- Using <label> instead of JS .click() — the only reliable
                 way to trigger a file picker on iOS Safari from inside a modal -->
            <label for="medicine-photo-input"
                   class="action-btn"
                   style="display:block;margin-top:16px;cursor:pointer;user-select:none;">
                📷 Take Photo / Choose Image
            </label>

            <div style="font-size:0.72em;opacity:0.6;margin-top:14px;text-align:left;line-height:1.5;">
                ⚠️ This is a reading aid only — not medical advice.
                MORY only processes the minimum information needed.
                Your medication data is never shared with third parties.
            </div>
        </div>`
    );
};

// ---- Keep triggerMedicineScan for any code that still calls it ----
// (the modal no longer uses it, but emergency overlay and quick-tap paths might)
window.triggerMedicineScan = function () {
    document.getElementById('medicine-photo-input').click();
};

// ---- FIX 3: Image compression before upload ----
// Resizes large photos to max 1200px wide and re-encodes as JPEG 85%.
// A typical camera photo goes from ~4MB → ~200-400KB, dramatically
// reducing upload time and server processing load.

async function compressImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round(height * maxWidth / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            // White background (avoids transparent PNGs becoming black on JPEG)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            // Compression failed — fall back to original file
            URL.revokeObjectURL(url);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        };
        img.src = url;
    });
}

// ---- FIX 4 (new helper): Add scanned medicine directly to pills list ----
// Called from the "➕ Add to My Pills" button after a successful scan.
// Parses timing strings like "8:00 AM after food" to extract a 24-hr time.

async function addScannedMedicineToPills(medicineName, purposePlain, dosage, timing) {
    // Best-effort time extraction from strings like "8:00 AM", "Twice daily", "BD", etc.
    let time = '08:00';
    if (timing) {
        const match = timing.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (match) {
            let h = parseInt(match[1]);
            const m = parseInt(match[2] || '0');
            const meridiem = (match[3] || '').toLowerCase();
            if (meridiem === 'pm' && h < 12) h += 12;
            if (meridiem === 'am' && h === 12) h = 0;
            time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
    }

    try {
        const res = await fetch('/api/pills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: medicineName || 'Unknown Medicine',
                purpose: purposePlain || '',
                dosage: dosage || '',
                time
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Server error');
        }
        if (typeof refreshPillsBadge === 'function') refreshPillsBadge();
        return true;
    } catch (err) {
        console.error('Could not add medicine to pills list:', err);
        alert('Could not add to pills list: ' + err.message);
        return false;
    }
}

// ---- FIX 3 + 5: handleMedicinePhotoSelected ----
// Now compresses image before upload, shows a real progress bar,
// and handles network errors more clearly.

window.handleMedicinePhotoSelected = async function (event) {
    const file = event.target.files && event.target.files[0];
    // Reset so selecting the same file again still fires onchange
    event.target.value = '';
    if (!file) return;

    const selectedDialect = document.getElementById('dialect-picker')?.value || 'english';
    const fileSizeMB = (file.size / 1048576).toFixed(1);

    // Show loading state with progress steps
    openElderlyModal(
        '📷 Reading Label...',
        `<div style="text-align:center;padding:10px 0;">
            <div style="font-size:2.5em;margin-bottom:12px;">🔍</div>
            <div id="scan-step" style="font-weight:700;color:var(--purple-main);margin-bottom:8px;">
                Step 1 of 3: Preparing photo…
            </div>
            <div style="background:var(--purple-light);border-radius:999px;height:10px;margin:10px 0;overflow:hidden;">
                <div id="scan-bar" style="height:100%;width:10%;background:var(--purple-main);border-radius:999px;transition:width 0.4s ease;"></div>
            </div>
            <div style="font-size:0.8em;opacity:0.6;margin-top:6px;">
                Photo size: ${fileSizeMB}MB${file.size > 1048576 ? ' — compressing…' : ''}
            </div>
            <div style="font-size:0.72em;opacity:0.55;margin-top:12px;text-align:left;">
                ⚠️ This is a reading guide only — not medical advice.
            </div>
        </div>`
    );

    const setStep = (label, pct) => {
        const stepEl = document.getElementById('scan-step');
        const barEl = document.getElementById('scan-bar');
        if (stepEl) stepEl.textContent = label;
        if (barEl) barEl.style.width = pct + '%';
    };

    try {
        // Step 1: Compress
        setStep('Step 1 of 3: Preparing photo…', 20);
        const imageBase64 = await compressImage(file);
        if (!imageBase64) throw new Error('Could not read the photo file.');

        const compressedKB = Math.round(imageBase64.length * 0.75 / 1024);
        console.log(`📷 Compressed to ~${compressedKB}KB (from ${fileSizeMB}MB original)`);

        // Step 2: OCR + AI (server-side)
        setStep('Step 2 of 3: Reading the label…', 50);

        const response = await fetch('/api/scan-medicine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, dialect: selectedDialect })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server error ${response.status}`);
        }

        // Step 3: Rendering
        setStep('Step 3 of 3: Preparing your result…', 90);
        const data = await response.json();

        // Small delay so the progress bar visibly completes before modal switches
        await new Promise(r => setTimeout(r, 300));

        renderMedicineResult(data, selectedDialect);

    } catch (err) {
        console.error('Medicine scan failed:', err);
        const msg = err.message.includes('Failed to fetch')
            ? 'Could not reach the server. Please check your connection.'
            : err.message || 'Something went wrong.';

        openElderlyModal(
            '📷 Scan Failed',
            `<div style="text-align:left;padding:6px 0;">
                <strong>MORY:</strong> Sorry, I couldn't read that photo.<br><br>
                <small style="opacity:0.7;">${escapeHtml(msg)}</small>
             </div>
             <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                <button class="action-btn" onclick="openScanMedicationLanding()" style="flex:1;">🔁 Try Again</button>
                <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;background-color:#3B5E43;">✅ Done</button>
             </div>`
        );
    }
};

// ---- FIX 4 + 5: renderMedicineResult ----
// Now shows:
//   • "➕ Add to My Pills" button when name + dosage are available
//   • Gonka Request ID for competition transparency (collapsed by default)
//   • Improved layout

window.renderMedicineResult = function (data, dialect) {
    const disclaimer = data.disclaimer || 'This is a reading guide only — not medical advice.';

    // ---- Photo was too unclear to read ----
    if (!data.legible) {
        openElderlyModal(
            '📷 Photo Not Clear Enough',
            `<div style="text-align:left;padding:6px 0;">
                <strong>MORY:</strong> "${escapeHtml(data.elderlySummary || "I couldn't read this clearly. Could you try again?")}"
             </div>
             <div style="font-size:0.75em;opacity:0.65;margin-top:10px;">⚠️ ${escapeHtml(disclaimer)}</div>
             <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                <button class="action-btn" onclick="openScanMedicationLanding()" style="flex:1;min-width:100px;">🔁 Retake Photo</button>
                <button class="action-btn" onclick="closeElderlyModal()" style="flex:1;min-width:100px;background-color:#3B5E43;">✅ Done</button>
             </div>`
        );
        speakReply(data.elderlySummary, dialect);
        return;
    }

    // ---- Successful scan ----
    const caregiverDetailsId = 'cg-detail-' + Date.now();
    const canAddToPills = !!(data.medicineName && (data.dosage || data.purposePlain));

    // Encode scanned fields as JSON for the button onclick (avoids quote-escaping hell)
    const pillPayload = JSON.stringify({
        name: data.medicineName || '',
        purpose: data.purposePlain || '',
        dosage: data.dosage || '',
        timing: data.timing || ''
    });
    const escapedPayload = pillPayload.replace(/'/g, '&#39;');

    openElderlyModal(
        `💊 ${escapeHtml(data.medicineName || 'Medicine Info')}`,

        // ---- What Ah Ma sees ----
        `<div style="text-align:left;padding:6px 0;font-size:1.05em;line-height:1.6;">
            <strong>MORY says:</strong><br>
            "${escapeHtml(data.elderlySummary || '')}"
         </div>

         <div style="font-size:0.72em;opacity:0.6;margin-top:10px;text-align:left;">
             ⚠️ ${escapeHtml(disclaimer)}
         </div>

         <!-- ADD TO MY PILLS — the most useful button after a scan -->
         ${canAddToPills ? `
         <button class="action-btn"
                 style="background-color:#3B5E43;margin-top:16px;"
                 onclick="(async () => {
                     const p = JSON.parse(this.getAttribute('data-payload'));
                     this.textContent = '⏳ Saving…';
                     this.disabled = true;
                     const ok = await addScannedMedicineToPills(p.name, p.purpose, p.dosage, p.timing);
                     if (ok) {
                         this.textContent = '✅ Added to My Pills!';
                         this.style.background = 'var(--sage-green)';
                     } else {
                         this.textContent = '➕ Add to My Pills';
                         this.disabled = false;
                     }
                 })()"
                 data-payload='${escapedPayload}'>
             ➕ Add to My Pills
         </button>` : ''}

         <!-- CAREGIVER DETAIL PANEL (collapsed by default) -->
         <button class="action-btn"
                 style="background-color:var(--purple-deep);margin-top:10px;"
                 onclick="const el=document.getElementById('${caregiverDetailsId}');
                          el.style.display=el.style.display==='none'?'block':'none';
                          this.textContent=el.style.display==='none'?'👨‍👩‍👧 Details for Caregiver':'👆 Hide Details';">
             👨‍👩‍👧 Details for Caregiver
         </button>

         <div id="${caregiverDetailsId}"
              style="display:none;text-align:left;margin-top:10px;
                     background:var(--sage-bg);border-radius:14px;padding:14px;font-size:0.85em;line-height:1.7;">
             <strong>Medicine:</strong> ${escapeHtml(data.medicineName) || '—'}<br>
             <strong>Purpose:</strong> ${escapeHtml(data.purposePlain) || '—'}<br>
             <strong>Dosage (as printed):</strong> ${escapeHtml(data.dosage) || '—'}<br>
             <strong>Timing (as printed):</strong> ${escapeHtml(data.timing) || '—'}<br>
             <strong>Warnings:</strong> ${escapeHtml(data.warnings) || 'None printed'}<br><br>
             <strong>Note:</strong> ${escapeHtml(data.caregiverNote) || '—'}<br><br>
             <details>
                 <summary style="cursor:pointer;color:var(--purple-main);font-weight:700;">
                     📄 Raw scanned text
                 </summary>
                 <div style="white-space:pre-wrap;font-size:0.88em;opacity:0.75;margin-top:6px;
                             background:white;border-radius:8px;padding:8px;">
                     ${escapeHtml(data.ocrText) || '(none)'}
                 </div>
             </details>
             ${data.gonkaRequestId ? `
             <details style="margin-top:8px;">
                 <summary style="cursor:pointer;color:var(--purple-main);font-weight:700;font-size:0.9em;">
                     🔗 Gonka Request ID (transparency)
                 </summary>
                 <div style="font-size:0.8em;word-break:break-all;opacity:0.65;margin-top:4px;">
                     ${escapeHtml(data.gonkaRequestId)}
                 </div>
                 <div style="font-size:0.75em;opacity:0.5;margin-top:2px;">
                     Model: ${escapeHtml(data.model || '—')}
                 </div>
             </details>` : ''}
         </div>

         <!-- BOTTOM ACTION ROW -->
         <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
             <button class="action-btn"
                     onclick="openScanMedicationLanding()"
                     style="flex:1;min-width:100px;background-color:var(--purple-deep);">
                 🔁 Scan Another
             </button>
             <button class="action-btn"
                     onclick="closeElderlyModal()"
                     style="flex:1;min-width:100px;background-color:#3B5E43;">
                 ✅ Done
             </button>
         </div>`
    );

    speakReply(data.elderlySummary, dialect);
};

// Expose new helpers globally so they can be called from inline onclick handlers
window.addScannedMedicineToPills = addScannedMedicineToPills;
window.compressImage = compressImage;

console.log('✅ Medicine scan patch loaded');
