// ============================================================
// MORY Games UI Patch — matches the PDF design mockup
// Add to elderly.html AFTER elderly-script.js and ui-redesign-patch.js:
//   <script src="games-ui-patch.js"></script>
// Overrides: openBrainGamesMenu, finishGameSession, openBrainGameProgress
// ============================================================

// ── Games Menu — matching PDF design ──
window.openBrainGamesMenu = async function () {
    openElderlyModal('🎮 Games', '<div style="text-align:center;padding:20px;opacity:0.6;">Loading...</div>');

    let summary;
    try {
        const res = await fetch('/api/brain-games/summary');
        summary = await res.json();
    } catch (err) {
        summary = { streak: { current: 0, longest: 0 }, points: 0 };
    }

    const streak = summary.streak?.current || 0;
    const points = summary.points || 0;

    // Colorful "Game time!!!" letters matching PDF
    const titleHtml =
        `<span style="color:#E4574C;">G</span>` +
        `<span style="color:#F5C842;">a</span>` +
        `<span style="color:#4CAF50;">m</span>` +
        `<span style="color:#2196F3;">e</span>` +
        `<span style="color:var(--purple-main);"> time </span>` +
        `<span style="color:#E4574C;">!</span>` +
        `<span style="color:#F5C842;">!</span>` +
        `<span style="color:#4CAF50;">!</span>`;

    // Three game cards (dark purple, matching PDF)
    const games = [
        {
            fn: 'startNumberSequenceGame()',
            label: 'Number sequence',
            icon: `<div style="display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;">
                       <span style="background:#F5C842;color:#221A28;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:.95em;">1</span>
                       <span style="color:white;font-size:.8em;">→</span>
                       <span style="background:#E4574C;color:white;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:.95em;">2</span>
                       <br>
                       <span style="background:#4CAF50;color:white;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:.95em;">3</span>
                       <span style="color:white;font-size:.8em;">→</span>
                       <span style="background:#2196F3;color:white;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:.95em;">4</span>
                   </div>`
        },
        {
            fn: 'startMemoryMatchGame()',
            label: 'Memory match',
            icon: `<span style="font-size:2.4em;">🧠</span>`
        },
        {
            fn: 'startReactionGame()',
            label: 'Reaction game',
            icon: `<div style="position:relative;display:inline-block;">
                       <span style="font-size:2.2em;">⏱️</span>
                       <span style="position:absolute;top:-4px;right:-10px;font-size:1em;">⚡</span>
                   </div>`
        }
    ];

    const gameCards = games.map(g => `
        <div onclick="${g.fn}"
             style="background:#3B1F6E;border-radius:20px;padding:16px 10px 14px;cursor:pointer;
                    display:flex;flex-direction:column;align-items:center;gap:10px;
                    flex:1;min-width:90px;transition:transform 0.1s;user-select:none;"
             onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform=''"
             ontouchstart="this.style.transform='scale(0.95)'" ontouchend="this.style.transform=''">
            <div style="height:56px;display:flex;align-items:center;justify-content:center;">
                ${g.icon}
            </div>
            <span style="color:white;font-weight:800;font-size:0.82em;text-align:center;line-height:1.3;">
                ${g.label}
            </span>
        </div>`).join('');

    openElderlyModal(
        '🎮 Games',
        `<div style="text-align:center;">

            <!-- Game controller icon -->
            <div style="font-size:2.8em;margin-bottom:4px;">🎮</div>

            <!-- Colorful title -->
            <div style="font-size:1.4em;font-weight:900;margin-bottom:4px;">${titleHtml}</div>

            <!-- Streak message -->
            <div style="font-size:0.88em;font-weight:700;opacity:0.75;margin-bottom:14px;">
                You had a ${streak}-day streak 🔥 Keep going 💪
            </div>

            <!-- Streak + Points badges -->
            <div style="display:flex;gap:10px;justify-content:center;margin-bottom:18px;flex-wrap:wrap;">
                <span style="background:var(--purple-light);color:var(--purple-main);font-weight:800;
                             padding:8px 18px;border-radius:999px;font-size:0.9em;">
                    🔥 Day ${streak}
                </span>
                <span style="background:var(--purple-light);color:var(--purple-main);font-weight:800;
                             padding:8px 18px;border-radius:999px;font-size:0.9em;">
                    ⭐ ${points.toLocaleString()} points
                </span>
            </div>

            <!-- Three game cards -->
            <div style="display:flex;gap:10px;margin-bottom:18px;">
                ${gameCards}
            </div>

            <!-- Buttons -->
            <div style="display:flex;gap:10px;">
                <button onclick="openBrainGameProgress()"
                        style="flex:1;background:#2D6A27;color:white;border:none;border-radius:999px;
                               padding:14px 10px;font-weight:800;font-size:0.9em;cursor:pointer;">
                    View Progress
                </button>
                <button onclick="closeElderlyModal()"
                        style="flex:1;background:#3B1F6E;color:white;border:none;border-radius:999px;
                               padding:14px 10px;font-weight:800;font-size:0.9em;cursor:pointer;">
                    Close / Done
                </button>
            </div>
        </div>`
    );
};

// ── After finishing a game — warm result screen matching PDF ──
window.finishGameSession = async function (gameType, accuracy, reactionTimeMs, durationSec, resultLine) {
    let earnedPoints = 0, streak = { current: 0 }, points = 0;
    try {
        const res = await fetch('/api/brain-games/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameType, accuracy, reactionTimeMs, durationSec })
        });
        const data = await res.json();
        earnedPoints = data.earnedPoints || 0;
        streak = data.streak || { current: 0 };
        points = data.points || 0;
    } catch (err) {
        console.log('Could not log game session:', err.message);
    }

    openElderlyModal(
        '🎉 Well Done!',
        `<div style="text-align:center;padding:6px 0;">

            <!-- Trophy / celebration -->
            <div style="font-size:3em;margin-bottom:8px;">🏆</div>

            <!-- Result line -->
            <div style="font-size:1.05em;font-weight:700;margin-bottom:14px;color:var(--purple-main);">
                ${resultLine}
            </div>

            <!-- Updated streak + points badges -->
            <div style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;flex-wrap:wrap;">
                <span style="background:var(--purple-light);color:var(--purple-main);font-weight:800;
                             padding:8px 18px;border-radius:999px;font-size:0.9em;">
                    🔥 Day ${streak.current}
                </span>
                <span style="background:#FFF3CD;color:#856404;font-weight:800;
                             padding:8px 18px;border-radius:999px;font-size:0.9em;">
                    ⭐ +${earnedPoints} points
                </span>
            </div>

            <!-- Buttons -->
            <div style="display:flex;gap:10px;">
                <button onclick="openBrainGamesMenu()"
                        style="flex:1;background:#2D6A27;color:white;border:none;border-radius:999px;
                               padding:14px 10px;font-weight:800;font-size:0.9em;cursor:pointer;">
                    🎮 Play Another
                </button>
                <button onclick="closeElderlyModal()"
                        style="flex:1;background:#3B1F6E;color:white;border:none;border-radius:999px;
                               padding:14px 10px;font-weight:800;font-size:0.9em;cursor:pointer;">
                    ✅ Done
                </button>
            </div>
        </div>`
    );
};

// ── Progress view (family/caregiver, data-rich) ──
window.openBrainGameProgress = async function () {
    openElderlyModal('📊 Progress', '<div style="text-align:center;padding:20px;opacity:0.6;">Loading...</div>');

    try {
        const res = await fetch('/api/brain-games/summary');
        const data = await res.json();

        const sessionRows = (data.recentSessions || []).slice(0, 6).map(s => `
            <div style="display:flex;justify-content:space-between;font-size:0.82em;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                <span style="font-weight:700;">${s.gameType}</span>
                <span style="opacity:0.7;">${s.date}</span>
                <span style="color:var(--purple-main);font-weight:700;">${s.accuracy}%</span>
            </div>`).join('') || '<div style="opacity:0.6;font-size:0.85em;padding:8px 0;">No sessions yet.</div>';

        const trend = data.trend;
        const trendBlock = trend === 'improving'
            ? `<div style="background:#EAF3DE;border-radius:12px;padding:10px 14px;font-size:0.85em;font-weight:700;color:#27500A;">📈 Improving — great progress!</div>`
            : trend === 'declining'
            ? `<div style="background:#FAECE7;border-radius:12px;padding:10px 14px;font-size:0.85em;font-weight:700;color:#712B13;">📉 Slight decline — consider speaking to a professional.</div>`
            : trend === 'stable'
            ? `<div style="background:var(--sage-bg);border-radius:12px;padding:10px 14px;font-size:0.85em;font-weight:700;color:var(--sage-green);">➡️ Stable — keeping up well!</div>`
            : `<div style="opacity:0.6;font-size:0.82em;padding:8px 0;">Play more games to see a trend.</div>`;

        openElderlyModal(
            '📊 Progress',
            `<div>
                <!-- Header badges -->
                <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px;flex-wrap:wrap;">
                    <span style="background:var(--purple-light);color:var(--purple-main);font-weight:800;padding:7px 16px;border-radius:999px;font-size:0.88em;">
                        🔥 ${data.streak?.current || 0}-day streak (best: ${data.streak?.longest || 0})
                    </span>
                    <span style="background:var(--purple-light);color:var(--purple-main);font-weight:800;padding:7px 16px;border-radius:999px;font-size:0.88em;">
                        ⭐ ${(data.points || 0).toLocaleString()} points
                    </span>
                </div>

                <!-- Trend -->
                ${trendBlock}

                <!-- Recent sessions table -->
                <div style="margin-top:14px;">
                    <div style="font-weight:800;font-size:0.9em;margin-bottom:6px;color:var(--purple-main);">Recent Sessions</div>
                    ${sessionRows}
                </div>

                <div style="font-size:0.7em;opacity:0.5;margin-top:10px;line-height:1.5;">
                    Observational trend only — not a medical assessment.
                </div>
            </div>
            <button onclick="openBrainGamesMenu()"
                    style="width:100%;margin-top:14px;background:#3B1F6E;color:white;border:none;
                           border-radius:999px;padding:14px;font-weight:800;font-size:0.9em;cursor:pointer;">
                ← Back to Games
            </button>`
        );
    } catch (err) {
        openElderlyModal('📊 Progress', `<div style="color:var(--danger);">Couldn't load progress.</div><button class="action-btn" onclick="openBrainGamesMenu()">← Back</button>`);
    }
};

console.log('✅ Games UI patch loaded');
