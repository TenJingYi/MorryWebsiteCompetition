const express = require('express');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const cors = require('cors');
const Tesseract = require('tesseract.js');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'], credentials: true }));
app.use(express.json({ limit: '12mb' }));
if (!process.env.SESSION_SECRET) console.log('⚠️  SESSION_SECRET not set — using insecure default.');
app.use(session({
    secret: process.env.SESSION_SECRET || 'mory-dev-secret-change-me',
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 12 * 60 * 60 * 1000 }
}));
app.use(express.static(__dirname));

// ========== GONKA ROUTER ==========
// Competition requirement: all AI MUST run on Gonka Network via gonkarouter.io

let gonkaClient = null;
try {
    if (process.env.GONKA_API_KEY) {
        gonkaClient = new OpenAI({
            baseURL: process.env.GONKA_ROUTER_URL || 'https://api.gonkarouter.io/v1',
            apiKey: process.env.GONKA_API_KEY,
            timeout: 30000,
        });
        console.log('✅ Gonka Router connected');
    } else {
        console.log('⚠️  GONKA_API_KEY not set — fallback mode only');
    }
} catch (err) {
    console.log('⚠️  Gonka init failed:', err.message);
}

// Competition: multi-model consensus with at least 2 models
const GONKA_MODELS = [
    process.env.GONKA_MODEL_PRIMARY   || 'deepseek-ai/DeepSeek-V4-Flash-0731',
    process.env.GONKA_MODEL_SECONDARY || 'MiniMaxAI/MiniMax-M2.7',
    process.env.GONKA_MODEL_TERTIARY  || 'moonshotai/Kimi-K2.6'
];

// ========== LANGUAGE CONFIG ==========
const LANGUAGE_MAP = {
    cantonese: {
        name: 'Cantonese', code: 'yue',
        systemPrompt: 'You are MORY, a warm caring elderly companion. ALWAYS respond ONLY in Cantonese (廣東話) using traditional Chinese characters. Be warm and patient. Under 60 words. End with one gentle follow-up question.',
        fallback: ['阿嫲，多謝你問我！我好好，你今日覺得點呀？','我幾好呀，阿嫲！你食咗飯未？','好好，多謝關心！阿嫲你有冇咩想同我講？','我喺度聽你講，阿嫲。你今日有冇出去行下？','阿嫲，你嘅問題好好！等我幫你諗下。']
    },
    hokkien: {
        name: 'Hokkien', code: 'nan',
        systemPrompt: 'You are MORY, a warm caring elderly companion. ALWAYS respond ONLY in Taiwanese Hokkien (福建話/台語). Be warm and patient. Under 60 words. End with one gentle follow-up question.',
        fallback: ['阿嫲，多謝你問我！我真好，你今仔日感覺按怎？','我真好，阿嫲！你食飽未？','真好，多謝關心！阿嫲你敢有啥物想佮我講？','我佇遮聽你講，阿嫲。你今仔日敢有出去行行？','阿嫲，你的問題真好！等我幫你想看覓。']
    },
    hakka: {
        name: 'Hakka', code: 'hak',
        systemPrompt: 'You are MORY, a warm caring elderly companion. ALWAYS respond ONLY in Hakka (客家話). Be warm and patient. Under 60 words. End with one gentle follow-up question.',
        fallback: ['阿嬤，多謝你問𠊎！𠊎當好，你今晡日感覺仰般？','𠊎當好，阿嬤！你食飽吂？','當好，多謝關心！阿嬤你有麼个想同𠊎講？','𠊎在這聽你講，阿嬤。你今晡日有出去行無？','阿嬤，你个問題當好！等𠊎幫你想下。']
    },
    mandarin: {
        name: 'Mandarin', code: 'zh',
        systemPrompt: 'You are MORY, a warm caring elderly companion. ALWAYS respond ONLY in Mandarin Chinese (普通话) using simplified characters. Be warm and patient. Under 60 words. End with one gentle follow-up question.',
        fallback: ['奶奶，谢谢您问我！我很好，您今天感觉怎么样？','我很好，奶奶！您吃饭了吗？','很好，谢谢关心！奶奶您有什么想跟我说的吗？','我在这里听您说，奶奶。您今天有出去走走吗？','奶奶，您的问题很好！让我帮您想想。']
    },
    english: {
        name: 'English', code: 'en',
        systemPrompt: 'You are MORY, a warm caring elderly companion. Respond in clear simple English. Be warm and patient. Under 60 words. End with one gentle follow-up question.',
        fallback: ["Thank you for asking, Ah Ma! I'm doing well. How are you feeling today?","I'm great, Ah Ma! Have you had your meal today?","I'm wonderful, thank you! Is there anything you'd like to talk about?","I'm here listening, Ah Ma. Did you go for a walk today?","That's a great question, Ah Ma! Let me think about that for you."]
    },
    bm: {
        name: 'Bahasa Melayu', code: 'ms',
        systemPrompt: 'You are MORY, a warm caring elderly companion. ALWAYS respond ONLY in Bahasa Melayu. Be warm and patient. Under 60 words. End with one gentle follow-up question.',
        fallback: ['Terima kasih bertanya, Nenek! Saya sihat. Bagaimana perasaan nenek hari ini?','Saya sihat, Nenek! Nenek sudah makan?','Saya sihat, terima kasih! Ada apa-apa yang nenek ingin ceritakan?','Saya di sini mendengar, Nenek. Nenek berjalan-jalan hari ini?','Soalan yang bagus, Nenek! Biar saya fikirkan untuk nenek.']
    }
};

// ========== GONKA CALL HELPERS ==========

// Single model call — captures the Gonka Request ID for transparency
async function callGonkaSingle(model, messages, { temperature = 0.7, max_tokens = 500, extraHeaders = {} } = {}) {
    const response = await gonkaClient.chat.completions.create({
        model, messages, temperature, max_tokens,
        extra_headers: { 'X-Gonka-Task-Type': 'mory-elderly-companion', ...extraHeaders }
    });
    // ── Think-tag handling ──
    // DeepSeek and similar reasoning models wrap their chain-of-thought in
    // <think>...</think> before the final answer. Two problems:
    //
    // (a) For companion chat / TTS: we MUST strip think blocks — the elderly
    //     user would hear the model "thinking out loud" otherwise.
    //
    // (b) For JSON extraction (fact-checker, medicine scan): the model sometimes
    //     puts the JSON INSIDE the think block, so stripping it deletes the JSON.
    //
    // Solution: return BOTH the raw content (for JSON extraction) and the
    // think-stripped content (for display/TTS). Callers choose which to use.

    const rawContent = response.choices[0].message.content.trim();

    // Stripped version — safe for display and TTS
    let content = rawContent;
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (content.startsWith('<think>')) {
        const tagEnd = content.indexOf('>');
        if (tagEnd !== -1) content = content.slice(tagEnd + 1).trim();
    }

    return {
        content,       // think-stripped — use for companion chat replies and TTS
        rawContent,    // original — use for JSON extraction (think block may contain JSON)
        model,
        gonkaRequestId: response.id || `gonka-${Date.now().toString(36)}`
    };
}

// *** COMPETITION REQUIREMENT: Multi-Model Consensus ***
// Calls PRIMARY + SECONDARY models in PARALLEL, returns both results.
// If both succeed → true consensus (both Request IDs returned for transparency).
// If one fails → single model result (no consensus).
// If both fail → falls back to TERTIARY, then error.
async function callGonka(messages, options = {}) {
    if (!gonkaClient) throw new Error('Gonka client not initialized — set GONKA_API_KEY in .env');

    const [primary, secondary, ...fallbacks] = GONKA_MODELS;

    // Run 2 models simultaneously
    const [r1, r2] = await Promise.allSettled([
        callGonkaSingle(primary, messages, options),
        callGonkaSingle(secondary, messages, options)
    ]);

    if (r1.status === 'fulfilled' && r2.status === 'fulfilled') {
        // True consensus: both models responded
        console.log(`  ✅ Consensus: [${r1.value.model}] + [${r2.value.model}]`);
        return {
            content: r1.value.content,           // primary response used
            model: r1.value.model,
            gonkaRequestId: r1.value.gonkaRequestId,
            secondaryModel: r2.value.model,
            secondaryGonkaRequestId: r2.value.gonkaRequestId,
            secondaryContent: r2.value.content,  // available for comparison UI
            consensus: true
        };
    }

    if (r1.status === 'fulfilled') { console.log(`  ⚠️  Secondary failed, using primary only`); return { ...r1.value, consensus: false }; }
    if (r2.status === 'fulfilled') { console.log(`  ⚠️  Primary failed, using secondary`);      return { ...r2.value, consensus: false }; }

    // Both failed — try remaining models
    console.log(`  ⚠️  Both primary models failed, trying fallbacks...`);
    for (const model of fallbacks) {
        try {
            const result = await callGonkaSingle(model, messages, options);
            return { ...result, consensus: false };
        } catch (err) { console.log(`  ↳ ${model} failed: ${err.message}`); }
    }
    throw new Error('All Gonka models failed');
}

// ========== TRANSLATION ==========
async function translateText(text, targetDialect) {
    if (!text || targetDialect === 'english' || !gonkaClient) return text;
    try {
        const result = await callGonka([
            { role: 'system', content: `Translate the following to ${LANGUAGE_MAP[targetDialect]?.name || targetDialect}. ONLY return the translation, nothing else. Keep it warm and natural.` },
            { role: 'user', content: text }
        ], { temperature: 0.2, max_tokens: 400 });
        return result.content;
    } catch (err) { console.log('⚠️  Translation failed:', err.message); return text; }
}

// ========== SENTIMENT ANALYSIS (for Mood % in dashboard) ==========
async function analyzeMoodFromConversation(conversationSummary) {
    if (!gonkaClient || !conversationSummary) return null;
    try {
        const result = await callGonka([
            { role: 'system', content: `Analyze the emotional tone of this elderly person's conversation summary. Return ONLY a JSON object: {"moodScore": 0-100, "moodLabel": "Positive"|"Neutral"|"Needs attention", "note": "one short sentence"}. No markdown.` },
            { role: 'user', content: `Conversation summary: ${conversationSummary}` }
        ], { temperature: 0.2, max_tokens: 150 });
        const cleaned = extractJSON(result.rawContent || result.content) || result.content.replace(/^```json\s*|^```\s*|```$/gm, '').trim();
        return JSON.parse(cleaned);
    } catch (err) { return null; }
}

// ========== AI COMPANION RESPONSE ==========
async function getAIResponse(userMessage, dialect, memoryContext, conversationHistory) {
    const langConfig = LANGUAGE_MAP[dialect] || LANGUAGE_MAP.english;

    if (gonkaClient) {
        try {
            const memCtx = memoryContext && Object.keys(memoryContext).length > 0
                ? `\nPersonal context about this person: ${JSON.stringify(memoryContext)}`
                : '';
            const systemPrompt = langConfig.systemPrompt + memCtx +
                '\nThis is a live spoken conversation — refer to what was just said naturally. Never say you are an AI unless asked.';

            const priorTurns = Array.isArray(conversationHistory)
                ? conversationHistory.filter(m => m && typeof m.content === 'string' && ['user','assistant'].includes(m.role)).slice(-10)
                : [];

            const result = await callGonka(
                [{ role: 'system', content: systemPrompt }, ...priorTurns, { role: 'user', content: userMessage }],
                { temperature: 0.8, max_tokens: 200, extraHeaders: { 'X-Gonka-Dialect': dialect, 'X-Gonka-Priority': 'low-latency' } }
            );

            // Auto-translate if model ignored language instruction (CJK check)
            let finalReply = result.content;
            if (['cantonese','hokkien','hakka','mandarin'].includes(dialect)) {
                const nonAscii = (finalReply.match(/[^\x00-\x7F]/g) || []).length / finalReply.length;
                if (nonAscii < 0.15) { console.log(`  ↳ Translating to ${dialect}...`); finalReply = await translateText(finalReply, dialect); }
            }

            console.log(`✅ [${result.model}${result.consensus ? ' + ' + result.secondaryModel : ''}] "${finalReply.slice(0,60)}..."`);
            return { reply: finalReply, ...result, routedNode: `gonka-${result.model.split('/').pop()}`, fallback: false };
        } catch (err) { console.log('⚠️  Gonka failed, using fallback:', err.message); }
    }

    const replies = langConfig.fallback;
    return { reply: replies[Math.floor(Math.random() * replies.length)], model: 'fallback', gonkaRequestId: null, consensus: false, routedNode: 'offline', fallback: true };
}

// ========== MEDICINE SCANNER ==========
const MEDICINE_DISCLAIMER_EN = 'Reading guide only — not medical advice. Always confirm with your pharmacist or doctor.';
const MIN_OCR_CHARS = 8; // lowered — even partial text is worth sending to Gonka

// NOTE: Gonka Router does NOT support image/vision inputs (image_url content type
// returns HTTP 400). The scan pipeline uses Tesseract OCR + Gonka text models only.

// Malaysian pharmacy abbreviations
const DOSAGE_ABBREV = {
    'OD':'once daily','BD':'twice daily','TDS':'three times daily','QID':'four times daily',
    'QDS':'four times daily','PRN':'as needed','SOS':'as needed','STAT':'immediately',
    'AC':'before meals','PC':'after meals','HS':'at bedtime','NOCTE':'at night',
    'MANE':'in the morning','OM':'in the morning','ON':'at night','MDU':'as directed',
    'NOCTE':'at night','EOD':'every other day','WEEKLY':'once a week'
};

function expandDosageAbbrev(text) {
    if (!text) return text;
    return text.replace(/\b(OD|BD|TDS|QID|QDS|PRN|SOS|STAT|AC|PC|HS|NOCTE|MANE|OM|ON|MDU|EOD|WEEKLY)\b/gi,
        m => { const exp = DOSAGE_ABBREV[m.toUpperCase()]; return exp ? `${m} (${exp})` : m; });
}

// ── Robust JSON extractor ──
// Searches for a valid JSON object in text that may contain:
//   • <think>...</think> blocks (with JSON after OR inside)
//   • markdown code fences ```json ... ```
//   • plain prose wrapping the JSON
//
// Search order:
//   1. After the last </think> — most common: model reasons then outputs JSON
//   2. In the stripped text (think blocks removed)
//   3. Anywhere in the raw text — catches JSON inside think blocks
function extractJSON(rawText) {
    if (!rawText) return null;

    // Helper: find first complete JSON object starting from position 0
    function findJSON(text) {
        // Strip markdown fences
        text = text.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
        const start = text.indexOf('{');
        if (start === -1) return null;
        const sub = text.slice(start);
        let depth = 0, end = -1;
        for (let i = 0; i < sub.length; i++) {
            if (sub[i] === '{') depth++;
            else if (sub[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end === -1) return null;
        const candidate = sub.slice(0, end + 1);
        // Must have at least one key:value pair to be valid
        return candidate.includes(':') ? candidate : null;
    }

    // Strategy 1: JSON after the last </think> tag (most common pattern)
    const lastThinkEnd = rawText.lastIndexOf('</think>');
    if (lastThinkEnd !== -1) {
        const afterThink = rawText.slice(lastThinkEnd + 8).trim();
        const j = findJSON(afterThink);
        if (j) return j;
    }

    // Strategy 2: Strip all think blocks, then find JSON
    const stripped = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const j2 = findJSON(stripped);
    if (j2) return j2;

    // Strategy 3: Search the full raw text (JSON may be inside a think block)
    return findJSON(rawText);
}

// ── OCR ──
async function runOCR(imageBase64) {
    const eng = await Tesseract.recognize(imageBase64, 'eng', { logger: () => {} });
    const engText = (eng.data.text || '').trim();
    const engConf = eng.data.confidence || 0;
    if (engText.length >= MIN_OCR_CHARS) return { text: engText, confidence: engConf };
    // Fallback: add CJK for Chinese-labelled packages
    const multi = await Tesseract.recognize(imageBase64, 'eng+chi_sim+chi_tra', { logger: () => {} });
    return { text: (multi.data.text || '').trim(), confidence: multi.data.confidence || 0 };
}

// ── Step 1 prompt: parse what's on the label ──
function buildLabelPrompt(dialect) {
    const name = LANGUAGE_MAP[dialect]?.name || 'English';
    return `You are MORY reading a medicine label from NOISY OCR text. OCR text may be garbled — use context and medical knowledge to interpret it.

RULES:
1. If you can identify the medicine name with reasonable confidence from the OCR, set "legible":true.
2. Only report dosage/timing/warnings that are clearly present in the OCR. Never invent them.
3. Expand abbreviations: BD=twice daily, TDS=three times daily, OD=once daily, QID=four times daily, PRN=as needed, AC=before meals, PC=after meals, HS=at bedtime.
4. purposePlain: use your medical knowledge to explain what this medicine is for in simple ${name} words.

Return ONLY a valid JSON object. No markdown fences. No explanation before or after:
{"legible":true,"medicineName":"name as best identified","purposePlain":"simple sentence in ${name}","dosage":"as printed or empty","timing":"as printed or empty","warnings":"printed warnings or empty"}`;
}

// ── Step 2 prompt: explain what the medicine is ──
function buildKnowledgePrompt(medicineName, dialect) {
    const name = LANGUAGE_MAP[dialect]?.name || 'English';
    return `You are MORY, a warm caring companion explaining medicine to an elderly person.

Medicine: "${medicineName}"

Explain this medicine in warm, very simple ${name} words — as if talking to a grandparent hearing about it for the first time.

Rules:
1. No medical jargon at all. Simple everyday words only.
2. Keep EACH field to 1-2 short sentences.
3. Be warm and reassuring, not clinical or scary.
4. If "${medicineName}" is not a real medicine, set "known":false.
5. Never suggest changing, stopping or adjusting any dose.

Return ONLY a valid JSON object. No markdown fences. No explanation before or after:
{"known":true,"whatItIs":"what it does in simple words in ${name}","whyDoctorGivesIt":"why doctors prescribe it in ${name}","importantReminder":"one warm safety reminder in ${name}","commonSideEffects":"1-2 common mild side effects in ${name}, or empty"}`;
}

// ── Full scan pipeline: OCR → label parse → medicine knowledge ──
async function scanMedicinePhoto(imageBase64, dialect) {
    const unclearMsg = {
        cantonese:'影唔清楚喎，可以幫我影多次？影清楚啲，光猛啲。',
        hokkien:'影無清楚呢，閣影一遍？較光較清楚一點。',
        hakka:'影毋清楚，再影一擺？較光較清楚兜。',
        mandarin:'照片不太清楚，可以再拍一次吗？光线亮一点、拍清楚一点。',
        english:"I couldn't read the label clearly. Please retake in good lighting, holding the label flat and close.",
        bm:'Foto tidak jelas. Sila ambil gambar semula dengan cahaya yang baik.'
    };

    const fail = (reason, extra = {}) => {
        console.log(`📷 Scan result: unclear (${reason})`);
        return {
            legible: false, medicineName:'', purposePlain:'', dosage:'', timing:'', warnings:'',
            medicineKnowledge: null,
            elderlySummary: unclearMsg[dialect] || unclearMsg.english,
            caregiverNote: `Scan unclear (${reason}). Please retake — flat, well-lit, label fills the frame.`,
            disclaimer: MEDICINE_DISCLAIMER_EN, ocrText:'', ocrConfidence:0,
            model:'none', gonkaRequestId:null, consensus:false, scanMethod:'failed', ...extra
        };
    };

    console.log('\n📷 Medicine scan starting...');

    // ── Step 0: OCR ──
    let ocr;
    try {
        ocr = await runOCR(imageBase64);
        console.log(`📝 OCR (conf:${Math.round(ocr.confidence)}%): "${ocr.text.slice(0, 200)}"`);
    } catch (err) {
        return fail('OCR engine error: ' + err.message);
    }

    if (!ocr.text || ocr.text.trim().length < MIN_OCR_CHARS) {
        return fail('photo too blurry or no text found', { ocrText: ocr.text, ocrConfidence: 0 });
    }

    if (!gonkaClient) return fail('no Gonka API key configured');

    // ── Step 1: Parse the label with Gonka ──
    console.log('  📋 Step 1: Parsing label with Gonka...');
    let labelParsed;
    let labelResult;
    try {
        labelResult = await callGonka([
            { role: 'system', content: buildLabelPrompt(dialect) },
            { role: 'user', content: `OCR text (confidence ${Math.round(ocr.confidence)}%):\n"""\n${ocr.text}\n"""` }
        ], { temperature: 0.2, max_tokens: 350 });

        const jsonStr = extractJSON(labelResult.rawContent || labelResult.content);
        if (!jsonStr) throw new Error('no JSON found in response');
        labelParsed = JSON.parse(jsonStr);
        if (labelParsed.dosage) labelParsed.dosage = expandDosageAbbrev(labelParsed.dosage);
        if (labelParsed.timing) labelParsed.timing = expandDosageAbbrev(labelParsed.timing);
        console.log(`  ✅ Label parsed: legible=${labelParsed.legible}, medicine="${labelParsed.medicineName}"`);
    } catch (err) {
        console.log(`  ⚠️  Label parse failed: ${err.message}`);
        return fail('AI could not parse the label text', { ocrText: ocr.text, ocrConfidence: Math.round(ocr.confidence), scanMethod: 'ocr' });
    }

    if (!labelParsed.legible) {
        return {
            ...fail('label text not identifiable', { ocrText: ocr.text, ocrConfidence: Math.round(ocr.confidence), scanMethod: 'ocr' }),
            model: labelResult.model,
            gonkaRequestId: labelResult.gonkaRequestId
        };
    }

    // ── Step 2: Medicine knowledge from Gonka ──
    console.log(`  💊 Step 2: Fetching Gonka knowledge for "${labelParsed.medicineName}"...`);
    let medicineKnowledge = null;
    let knowledgeRequestId = null;
    let knowledgeModel = null;

    try {
        const knowledgeResult = await callGonka([
            { role: 'system', content: buildKnowledgePrompt(labelParsed.medicineName, dialect) },
            { role: 'user', content: `Explain this medicine to an elderly patient: ${labelParsed.medicineName}${labelParsed.dosage ? ' (' + labelParsed.dosage + ')' : ''}.` }
        ], { temperature: 0.5, max_tokens: 400 });

        const knowledgeJSON = extractJSON(knowledgeResult.rawContent || knowledgeResult.content);
        if (!knowledgeJSON) throw new Error('no JSON found in knowledge response');
        const kp = JSON.parse(knowledgeJSON);

        if (kp.known !== false) {
            medicineKnowledge = kp;
            knowledgeRequestId = knowledgeResult.gonkaRequestId;
            knowledgeModel = knowledgeResult.model;
            console.log(`  ✅ Knowledge retrieved for "${labelParsed.medicineName}"`);
        }
    } catch (err) {
        console.log(`  ⚠️  Knowledge step failed (non-fatal): ${err.message}`);
    }

    // ── Step 3: Build final summaries ──
    const elderlySummary = medicineKnowledge
        ? [medicineKnowledge.whatItIs, medicineKnowledge.whyDoctorGivesIt, medicineKnowledge.importantReminder].filter(Boolean).join(' ')
        : `This is ${[labelParsed.medicineName, labelParsed.dosage, labelParsed.timing].filter(Boolean).join(', ')}.`;

    const caregiverNote = [
        `Label shows: ${[labelParsed.medicineName, labelParsed.dosage, labelParsed.timing].filter(Boolean).join(', ')}.`,
        labelParsed.warnings ? `Warnings: ${labelParsed.warnings}.` : '',
        medicineKnowledge?.commonSideEffects ? `Common side effects: ${medicineKnowledge.commonSideEffects}` : '',
        `OCR confidence: ${Math.round(ocr.confidence)}% — verify against the physical label.`
    ].filter(Boolean).join(' ');

    return {
        legible: true,
        medicineName:  labelParsed.medicineName || '',
        purposePlain:  labelParsed.purposePlain || '',
        dosage:        labelParsed.dosage       || '',
        timing:        labelParsed.timing       || '',
        warnings:      labelParsed.warnings     || '',
        medicineKnowledge,
        elderlySummary,
        caregiverNote,
        model:         labelResult.model,
        gonkaRequestId: labelResult.gonkaRequestId,
        secondaryModel: labelResult.secondaryModel,
        secondaryGonkaRequestId: labelResult.secondaryGonkaRequestId,
        knowledgeModel,
        knowledgeGonkaRequestId: knowledgeRequestId,
        consensus:     labelResult.consensus,
        ocrText:       ocr.text,
        ocrConfidence: Math.round(ocr.confidence),
        scanMethod:    'ocr',
        disclaimer:    MEDICINE_DISCLAIMER_EN
    };
}

// ========== CARE JOURNAL ==========
const CARE_JOURNAL_PROMPT = `Structure a caregiver's observation into a clean family summary.
RULES: Only report what was actually said. Missing categories = "Not mentioned". Calm, factual tone.
Return ONLY valid JSON: {"appetite":"Normal"|"Reduced"|"Increased"|"Not mentioned","sleepQuality":"Normal"|"Poor"|"Not mentioned","mood":"Good"|"Stable"|"Low"|"Agitated"|"Not mentioned","activityLevel":"High"|"Moderate"|"Low"|"Not mentioned","hydration":"Normal"|"Low"|"Not mentioned","observationNote":"short sentence or empty","summarySentence":"one warm plain-English sentence"}`;

async function structureCareJournalEntry(rawInput) {
    if (!gonkaClient) throw new Error('Gonka client not initialized');
    const result = await callGonka([
        { role:'system', content: CARE_JOURNAL_PROMPT },
        { role:'user', content: `Caregiver's observation:\n"""\n${rawInput}\n"""` }
    ], { temperature: 0.3, max_tokens: 400 });
    const jsonStr = extractJSON(result.rawContent || result.content);
    try { return jsonStr ? JSON.parse(jsonStr) : (() => { throw new Error('no JSON'); })(); }
    catch (e) { return { appetite:'Not mentioned', sleepQuality:'Not mentioned', mood:'Not mentioned', activityLevel:'Not mentioned', hydration:'Not mentioned', observationNote:'', summarySentence: rawInput.slice(0,200) }; }
}

// ========== AUTH MIDDLEWARE ==========
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session.user) return res.status(401).json({ error: 'Not logged in.' });
        if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Not authorized.' });
        next();
    };
}

// ========== DATA HELPERS ==========
function todayStr() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

const PILLS_FILE = path.join(__dirname,'pills-data.json');
function loadPillsData() { try { if(fs.existsSync(PILLS_FILE)) return JSON.parse(fs.readFileSync(PILLS_FILE,'utf8')); } catch(e){} return { medications:[{id:'seed-1',name:'Amlodipine',purpose:'Blood Pressure',dosage:'1 Tablet',time:'08:00'},{id:'seed-2',name:'Metformin',purpose:'Diabetes',dosage:'1 Tablet',time:'16:00'}], history:[] }; }
function savePillsData(d) { fs.writeFileSync(PILLS_FILE,JSON.stringify(d,null,2),'utf8'); }
function timeToMin(t) { const[h,m]=(t||'00:00').split(':').map(Number); return (h||0)*60+(m||0); }
function doseStatus(med,history) {
    const today=todayStr(), taken=history.find(h=>h.medicationId===med.id&&h.date===today);
    if(taken) return {status:'taken',takenAt:taken.takenAt};
    const now=new Date(), diff=now.getHours()*60+now.getMinutes()-timeToMin(med.time);
    return {status: diff<-15?'upcoming':diff<=30?'due':'overdue', takenAt:null};
}
function medsWithStatus() {
    const d=loadPillsData(), order={overdue:0,due:1,upcoming:2,taken:3};
    return d.medications.map(m=>({...m,...doseStatus(m,d.history)})).sort((a,b)=>(order[a.status]??9)-(order[b.status]??9)||timeToMin(a.time)-timeToMin(b.time));
}

const CONTACTS_FILE = path.join(__dirname,'contacts-data.json');
function loadContacts() { try { if(fs.existsSync(CONTACTS_FILE)) return JSON.parse(fs.readFileSync(CONTACTS_FILE,'utf8')); } catch(e){} return {contacts:[{id:'contact-seed-1',name:'Ah Mei',relation:'Daughter',phone:'+60123456789'}]}; }
function saveContacts(d) { fs.writeFileSync(CONTACTS_FILE,JSON.stringify(d,null,2),'utf8'); }

const BRAIN_FILE = path.join(__dirname,'brain-game-data.json');
function loadBrain() { try { if(fs.existsSync(BRAIN_FILE)) return JSON.parse(fs.readFileSync(BRAIN_FILE,'utf8')); } catch(e){} return {sessions:[],streak:{current:0,longest:0,lastPlayedDate:null},points:0}; }
function saveBrain(d) { fs.writeFileSync(BRAIN_FILE,JSON.stringify(d,null,2),'utf8'); }
function daysBetween(a,b) { return Math.round((new Date(b)-new Date(a))/(864e5)); }
function cogTrend(sessions) {
    if(sessions.length<5) return 'not-enough-data';
    const sorted=[...sessions].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const rAvg=sorted.slice(0,5).reduce((s,x)=>s+x.accuracy,0)/5;
    const oSl=sorted.slice(5,10); if(oSl.length<3) return 'not-enough-data';
    const oAvg=oSl.reduce((s,x)=>s+x.accuracy,0)/oSl.length;
    return rAvg>=oAvg+5?'improving':rAvg<=oAvg-5?'declining':'stable';
}

const EMERGENCY_FILE = path.join(__dirname,'emergency-data.json');
function loadEmergency() { try { if(fs.existsSync(EMERGENCY_FILE)) return JSON.parse(fs.readFileSync(EMERGENCY_FILE,'utf8')); } catch(e){} return {active:null,history:[]}; }
function saveEmergency(d) { fs.writeFileSync(EMERGENCY_FILE,JSON.stringify(d,null,2),'utf8'); }

const JOURNAL_FILE = path.join(__dirname,'care-journal-data.json');
function loadJournal() { try { if(fs.existsSync(JOURNAL_FILE)) return JSON.parse(fs.readFileSync(JOURNAL_FILE,'utf8')); } catch(e){} return {entries:[]}; }
function saveJournal(d) { fs.writeFileSync(JOURNAL_FILE,JSON.stringify(d,null,2),'utf8'); }

// Chat session tracker (mood score from conversations)
const CHAT_SESSIONS_FILE = path.join(__dirname,'chat-sessions-data.json');
function loadChatSessions() { try { if(fs.existsSync(CHAT_SESSIONS_FILE)) return JSON.parse(fs.readFileSync(CHAT_SESSIONS_FILE,'utf8')); } catch(e){} return {sessions:[]}; }
function saveChatSessions(d) { fs.writeFileSync(CHAT_SESSIONS_FILE,JSON.stringify(d,null,2),'utf8'); }

const USERS_FILE = path.join(__dirname,'users-data.json');
function loadUsers() {
    try { if(fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); } catch(e){}
    const seeded={users:[
        {id:'user-family-1',name:'Ah Mei',username:'family',role:'family',passwordHash:bcrypt.hashSync('family123',10)},
        {id:'user-caregiver-1',name:'Caregiver Nurul',username:'caregiver',role:'caregiver',passwordHash:bcrypt.hashSync('caregiver123',10)}
    ]};
    fs.writeFileSync(USERS_FILE,JSON.stringify(seeded,null,2),'utf8');
    console.log('👤 Demo accounts: family/family123 | caregiver/caregiver123');
    return seeded;
}
function saveUsers(d) { fs.writeFileSync(USERS_FILE,JSON.stringify(d,null,2),'utf8'); }

// ========== API ROUTES ==========

app.get('/api/health', (req,res) => res.json({
    status:'ok', version:'2.0.0',
    gonkaRouter: gonkaClient?'Connected':'Fallback Only',
    gonkaGateway: process.env.GONKA_ROUTER_URL||'https://api.gonkarouter.io/v1',
    models: GONKA_MODELS,
    multiModelConsensus: true,
    supportedDialects: Object.keys(LANGUAGE_MAP),
    timestamp: new Date().toISOString()
}));

app.get('/api/dialects', (req,res) => res.json({ dialects: Object.entries(LANGUAGE_MAP).map(([k,v])=>({dialect:k,label:v.name,code:v.code})) }));

// ---- Companion Chat ----
app.post('/api/companion/chat', async (req,res) => {
    try {
        const { userMessage, dialect='english', memoryContext, conversationHistory } = req.body;
        console.log(`\n📥 Chat [${dialect}]: "${(userMessage||'').slice(0,80)}"`);
        if (!userMessage?.trim()) return res.json({ reply:'Please say something!', routedNode:'MORY', dialect, fallback:true });

        const result = await getAIResponse(userMessage.trim(), dialect, memoryContext, conversationHistory);

        // Log chat session for mood tracking
        const sessions = loadChatSessions();
        const today = todayStr();
        let todaySession = sessions.sessions.find(s=>s.date===today);
        if (!todaySession) { todaySession={date:today,messageCount:0,startTime:new Date().toISOString(),lastTime:new Date().toISOString(),snippets:[]}; sessions.sessions.push(todaySession); }
        todaySession.messageCount++;
        todaySession.lastTime = new Date().toISOString();
        if (todaySession.snippets.length < 10) todaySession.snippets.push(userMessage.trim().slice(0,100));
        saveChatSessions(sessions);

        res.json({
            reply: result.reply,
            routedNode: result.routedNode,
            gonkaRequestId: result.gonkaRequestId,
            secondaryModel: result.secondaryModel || null,
            secondaryGonkaRequestId: result.secondaryGonkaRequestId || null,
            consensus: result.consensus,
            dialect, model: result.model, fallback: result.fallback,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Chat error:', err.message);
        const lang = LANGUAGE_MAP[req.body?.dialect] || LANGUAGE_MAP.english;
        res.json({ reply: lang.fallback[0], routedNode:'fallback', gonkaRequestId:null, consensus:false, dialect:req.body?.dialect||'english', fallback:true });
    }
});

// ---- Mood Analysis (called by dashboard) ----
app.get('/api/mood/today', requireRole('family','caregiver'), async (req,res) => {
    const sessions = loadChatSessions();
    const today = todayStr();
    const todaySession = sessions.sessions.find(s=>s.date===today);

    if (!todaySession || todaySession.snippets.length === 0) {
        return res.json({ moodScore:null, moodLabel:'No data yet', note:'No conversations today', chatMinutes:0, messageCount:0 });
    }

    // Calculate chat duration
    let chatMinutes = 0;
    if (todaySession.startTime && todaySession.lastTime) {
        chatMinutes = Math.round((new Date(todaySession.lastTime)-new Date(todaySession.startTime))/60000);
    }

    let mood = null;
    if (gonkaClient && todaySession.snippets.length >= 2) {
        mood = await analyzeMoodFromConversation(todaySession.snippets.join('. '));
    }

    res.json({
        moodScore: mood?.moodScore || null,
        moodLabel: mood?.moodLabel || 'Not analyzed',
        note: mood?.note || '',
        chatMinutes,
        messageCount: todaySession.messageCount,
        gonkaRequestId: null
    });
});

// ---- Medicine Scanner ----
app.post('/api/scan-medicine', async (req,res) => {
    const {imageBase64,dialect='english'} = req.body;
    if(!imageBase64) return res.status(400).json({error:'No image provided.'});
    console.log(`\n📷 Medicine scan (${dialect})`);
    try { res.json(await scanMedicinePhoto(imageBase64,dialect)); }
    catch(err) { console.error('❌ Scan error:',err.message); res.status(500).json({legible:false,elderlySummary:'Sorry, something went wrong. Please try again.',caregiverNote:`Server error: ${err.message}`,disclaimer:MEDICINE_DISCLAIMER_EN}); }
});

// ---- Pills (history must come BEFORE :id routes) ----
app.get('/api/pills/history', (req,res) => {
    const d=loadPillsData();
    res.json({history:[...d.history].sort((a,b)=>new Date(b.takenAt)-new Date(a.takenAt)).slice(0,50)});
});
app.get('/api/pills', (req,res) => res.json({medications:medsWithStatus()}));
app.post('/api/pills', (req,res) => {
    const {name,purpose,dosage,time}=req.body;
    if(!name||!time) return res.status(400).json({error:'Name and time required.'});
    const d=loadPillsData();
    d.medications.push({id:'med-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:String(name).trim(),purpose:(purpose||'').trim(),dosage:(dosage||'').trim(),time:String(time).trim()});
    savePillsData(d); res.json({medications:medsWithStatus()});
});
app.put('/api/pills/:id', (req,res) => {
    const d=loadPillsData(), m=d.medications.find(m=>m.id===req.params.id);
    if(!m) return res.status(404).json({error:'Not found.'});
    const{name,purpose,dosage,time}=req.body;
    if(name!==undefined) m.name=String(name).trim();
    if(purpose!==undefined) m.purpose=String(purpose).trim();
    if(dosage!==undefined) m.dosage=String(dosage).trim();
    if(time!==undefined) m.time=String(time).trim();
    savePillsData(d); res.json({medications:medsWithStatus()});
});
app.delete('/api/pills/:id', (req,res) => {
    const d=loadPillsData();
    d.medications=d.medications.filter(m=>m.id!==req.params.id);
    d.history=d.history.filter(h=>h.medicationId!==req.params.id);
    savePillsData(d); res.json({medications:medsWithStatus()});
});
app.post('/api/pills/:id/take', (req,res) => {
    const d=loadPillsData(), m=d.medications.find(m=>m.id===req.params.id);
    if(!m) return res.status(404).json({error:'Not found.'});
    const today=todayStr();
    if(!d.history.find(h=>h.medicationId===m.id&&h.date===today)) {
        d.history.push({medicationId:m.id,medicationName:m.name,date:today,takenAt:new Date().toISOString()});
        savePillsData(d);
    }
    res.json({medications:medsWithStatus()});
});

// ---- Contacts ----
app.get('/api/contacts', (req,res) => res.json({contacts:loadContacts().contacts}));
app.post('/api/contacts', (req,res) => {
    const{name,relation,phone,photo}=req.body;
    if(!name||!phone) return res.status(400).json({error:'Name and phone required.'});
    const d=loadContacts();
    d.contacts.push({id:'contact-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:String(name).trim(),relation:(relation||'').trim(),phone:String(phone).trim(),photo:photo||null});
    saveContacts(d); res.json({contacts:d.contacts});
});
app.put('/api/contacts/:id', (req,res) => {
    const d=loadContacts(), c=d.contacts.find(c=>c.id===req.params.id);
    if(!c) return res.status(404).json({error:'Not found.'});
    const{name,relation,phone,photo}=req.body;
    if(name!==undefined) c.name=String(name).trim();
    if(relation!==undefined) c.relation=String(relation).trim();
    if(phone!==undefined) c.phone=String(phone).trim();
    if(photo!==undefined) c.photo=photo;
    saveContacts(d); res.json({contacts:d.contacts});
});
app.delete('/api/contacts/:id', (req,res) => {
    const d=loadContacts(); d.contacts=d.contacts.filter(c=>c.id!==req.params.id); saveContacts(d); res.json({contacts:d.contacts});
});

// ---- Brain Games ----
app.get('/api/brain-games/summary', (req,res) => {
    const d=loadBrain();
    res.json({streak:d.streak,points:d.points,recentSessions:[...d.sessions].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10),trend:cogTrend(d.sessions)});
});
app.post('/api/brain-games/session', (req,res) => {
    const{gameType,accuracy,reactionTimeMs,durationSec}=req.body;
    if(!gameType||accuracy===undefined) return res.status(400).json({error:'gameType and accuracy required.'});
    const d=loadBrain(), today=todayStr();
    d.sessions.push({gameType,date:today,accuracy:Math.max(0,Math.min(100,Number(accuracy))),reactionTimeMs:Number(reactionTimeMs)||0,durationSec:Number(durationSec)||0});
    if(!d.streak.lastPlayedDate) { d.streak.current=1; }
    else { const gap=daysBetween(d.streak.lastPlayedDate,today); if(gap===1) d.streak.current++; else if(gap>1) d.streak.current=1; }
    d.streak.lastPlayedDate=today; d.streak.longest=Math.max(d.streak.longest,d.streak.current);
    const pts=10+Math.round(Number(accuracy)/10); d.points+=pts;
    saveBrain(d); res.json({streak:d.streak,points:d.points,earnedPoints:pts,trend:cogTrend(d.sessions)});
});

// ---- Auth ----
app.post('/api/auth/login', (req,res) => {
    const{username,password}=req.body;
    if(!username||!password) return res.status(400).json({error:'Username and password required.'});
    const d=loadUsers(), user=d.users.find(u=>u.username===String(username).trim().toLowerCase());
    if(!user||!bcrypt.compareSync(password,user.passwordHash)) return res.status(401).json({error:'Incorrect username or password.'});
    req.session.user={id:user.id,name:user.name,username:user.username,role:user.role};
    res.json({user:req.session.user});
});
app.post('/api/auth/register', (req,res) => {
    const{name,email,password,role}=req.body;
    if(!name||!email||!password||!role) return res.status(400).json({error:'All fields required.'});
    if(!['family','caregiver'].includes(role)) return res.status(400).json({error:'Invalid role.'});
    if(String(password).length<6) return res.status(400).json({error:'Password must be at least 6 characters.'});
    const d=loadUsers(), username=String(email).trim().toLowerCase();
    if(d.users.some(u=>u.username===username)) return res.status(409).json({error:'Email already registered.'});
    const nu={id:'user-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:String(name).trim(),username,role,passwordHash:bcrypt.hashSync(password,10)};
    d.users.push(nu); saveUsers(d);
    req.session.user={id:nu.id,name:nu.name,username:nu.username,role:nu.role};
    res.json({user:req.session.user});
});
app.post('/api/auth/logout', (req,res) => req.session.destroy(()=>res.json({ok:true})));
app.get('/api/auth/me', (req,res) => { if(!req.session.user) return res.status(401).json({error:'Not logged in.'}); res.json({user:req.session.user}); });

// ---- Dashboard Summary ----
app.get('/api/dashboard/summary', requireRole('family','caregiver'), (req,res) => {
    const meds=medsWithStatus(), bg=loadBrain(), today=todayStr();
    // BUG FIX: was always null
    const jd=loadJournal();
    const latestEntry=jd.entries.length>0?[...jd.entries].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0]:null;
    // Today's brain game count
    const todayGames=bg.sessions.filter(s=>s.date===today).length;
    res.json({
        elderlyName:'Ah Ma',
        medication:{completed:meds.filter(m=>m.status==='taken').length,total:meds.length,items:meds},
        brainGame:{completedToday:bg.sessions.some(s=>s.date===today),gamesPlayedToday:todayGames,streak:bg.streak,points:bg.points},
        careJournal:latestEntry
    });
});

// ---- Emergency ----
app.post('/api/emergency/alert', (req,res) => {
    const{latitude,longitude,seniorName}=req.body||{};
    const d=loadEmergency();
    const alert={id:'alert-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),seniorName:seniorName||'Ah Ma',triggeredAt:new Date().toISOString(),location:(typeof latitude==='number'&&typeof longitude==='number')?{latitude,longitude}:null,resolved:false};
    d.active=alert; d.history.push(alert); saveEmergency(d);
    console.log(`🚨 EMERGENCY: ${alert.seniorName} at ${alert.triggeredAt}`);
    res.json({ok:true,alert});
});
app.post('/api/emergency/cancel', (req,res) => {
    const d=loadEmergency();
    if(d.active){d.active.resolved=true;d.active.cancelledBySenior=true;d.active=null;}
    saveEmergency(d); res.json({ok:true});
});
app.get('/api/emergency/status', requireRole('family','caregiver'), (req,res) => res.json({active:loadEmergency().active}));
app.post('/api/emergency/resolve', requireRole('family','caregiver'), (req,res) => {
    const d=loadEmergency();
    if(d.active){d.active.resolved=true;d.active.resolvedBy=req.session.user.name;d.active=null;}
    saveEmergency(d); res.json({ok:true});
});

// ---- Care Journal ----
app.post('/api/care-journal', requireRole('caregiver'), async (req,res) => {
    const{rawInput}=req.body;
    if(!rawInput?.trim()) return res.status(400).json({error:'Please write or speak an observation first.'});
    try {
        const structured=await structureCareJournalEntry(rawInput.trim());
        const d=loadJournal();
        const entry={id:'journal-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),date:todayStr(),createdAt:new Date().toISOString(),loggedBy:req.session.user.name,rawInput:rawInput.trim(),...structured};
        d.entries.push(entry); saveJournal(d); res.json({entry});
    } catch(err) { console.error('❌ Journal failed:',err.message); res.status(500).json({error:'Could not process entry. Please try again.'}); }
});
app.get('/api/care-journal', requireRole('family','caregiver'), (req,res) => {
    const d=loadJournal();
    res.json({entries:[...d.entries].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,14)});
});

// ========== HEALTH FACT CHECKER ==========
// Competition requirements: Claim Extraction → Decentralised Verification →
// Truth Score (0-100%) + Reasoning Trace → Transparency UI with Gonka Request IDs

// Shorter, more direct prompt — long prompts trigger long <think> blocks in DeepSeek
// which can time out on free hosting. We keep it tight so the model responds fast.
const FACT_CHECK_SYSTEM = `You are a neutral health fact-checker. Assess the claim and return JSON immediately.

IMPORTANT: Do NOT use <think> tags. Output JSON directly with no preamble.

Verdict rules:
- TRUE (score 75-100): well-supported by medical consensus
- PARTIALLY TRUE (score 55-74): some truth but with caveats
- UNCERTAIN (score 35-54): mixed or insufficient evidence
- FALSE (score 0-34): contradicted by medical consensus

Return ONLY this JSON object, nothing else before or after:
{"verdict":"TRUE","truthScore":80,"summary":"one sentence","reasoning":"2-3 sentences of evidence","caveats":"key nuances","recommendation":"what to do"}`;

// No login required — fact checker is a public health utility
app.post('/api/fact-check', async (req, res) => {
    const { claim } = req.body;
    if (!claim || claim.trim().length < 10)
        return res.status(400).json({ error: 'Please provide a claim to verify (at least 10 characters).' });
    if (!gonkaClient)
        return res.status(503).json({ error: 'Gonka Router not connected. Check GONKA_API_KEY in .env.' });

    console.log(`\n🔍 Fact-check: "${claim.trim().slice(0,100)}"`);

    const messages = [
        { role: 'system', content: FACT_CHECK_SYSTEM },
        { role: 'user', content: `Fact-check this claim and return JSON: "${claim.trim()}"` }
    ];

    // max_tokens must be high enough for DeepSeek to finish its <think> block
    // AND still produce JSON. DeepSeek's reasoning alone can take 400+ tokens.
    // Too low = response truncated mid-think, no JSON ever appears.
    const callOpts = { temperature: 0.1, max_tokens: 1200 };

    try {
        // ── Round 1: try primary model ──
        let primary = null;
        try {
            console.log(`  ↳ Calling primary: ${GONKA_MODELS[0]}`);
            const r1 = await callGonkaSingle(GONKA_MODELS[0], messages, callOpts);
            const jsonStr = extractJSON(r1.rawContent || r1.content);
            if (jsonStr) {
                primary = { ...JSON.parse(jsonStr), model: r1.model, gonkaRequestId: r1.gonkaRequestId };
                console.log(`  ✅ Primary OK: score=${primary.truthScore} model=${primary.model}`);
            } else {
                console.log(`  ↳ Primary returned no JSON. Snippet: "${(r1.rawContent||'').slice(0,200)}"`);
            }
        } catch (e) {
            console.log(`  ↳ Primary failed: ${e.message}`);
        }

        // ── Round 2: try secondary model (always, independent of primary) ──
        let secondary = null;
        try {
            console.log(`  ↳ Calling secondary: ${GONKA_MODELS[1]}`);
            const r2 = await callGonkaSingle(GONKA_MODELS[1], messages, callOpts);
            const jsonStr = extractJSON(r2.rawContent || r2.content);
            if (jsonStr) {
                secondary = { ...JSON.parse(jsonStr), model: r2.model, gonkaRequestId: r2.gonkaRequestId };
                console.log(`  ✅ Secondary OK: score=${secondary.truthScore} model=${secondary.model}`);
            } else {
                console.log(`  ↳ Secondary returned no JSON. Snippet: "${(r2.rawContent||'').slice(0,200)}"`);
            }
        } catch (e) {
            console.log(`  ↳ Secondary failed: ${e.message}`);
        }

        // ── Round 3: tertiary fills in whichever slot is still empty ──
        if ((!primary || !secondary) && GONKA_MODELS[2]) {
            const missing = !primary ? 'primary' : 'secondary';
            console.log(`  ↳ ${missing} missing — trying tertiary: ${GONKA_MODELS[2]}`);
            try {
                const r3 = await callGonkaSingle(GONKA_MODELS[2], messages, callOpts);
                const jsonStr = extractJSON(r3.rawContent || r3.content);
                if (jsonStr) {
                    const parsed = { ...JSON.parse(jsonStr), model: r3.model, gonkaRequestId: r3.gonkaRequestId };
                    if (!primary) primary = parsed;
                    else secondary = parsed;
                    console.log(`  ✅ Tertiary filled ${missing}: score=${parsed.truthScore}`);
                } else {
                    console.log(`  ↳ Tertiary also returned no JSON`);
                }
            } catch (e) {
                console.log(`  ↳ Tertiary failed: ${e.message}`);
            }
        }

        if (!primary && !secondary)
            return res.status(500).json({ error: 'All AI models failed to respond. Please try again.' });

        // ── Compute consensus ──
        const results = [primary, secondary].filter(Boolean);
        const scores = results.map(r => Math.max(0, Math.min(100, Number(r.truthScore) || 50)));
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const twoModels = results.length === 2;
        const scoreDiff = twoModels ? Math.abs(scores[0] - scores[1]) : null;
        const consensus = twoModels && scoreDiff <= 20;
        const verdict = avgScore >= 75 ? 'TRUE' : avgScore >= 55 ? 'PARTIALLY TRUE' : avgScore >= 35 ? 'UNCERTAIN' : 'FALSE';

        console.log(`  ✅ Final: score=${avgScore}% verdict=${verdict} models=${results.length} consensus=${consensus}`);

        res.json({
            claim: claim.trim(),
            truthScore: avgScore,
            verdict,
            consensus,
            twoModels,
            scoreDiff,
            primary:   primary   ? { model:primary.model,   gonkaRequestId:primary.gonkaRequestId,   truthScore:primary.truthScore,   verdict:primary.verdict,   summary:primary.summary,   reasoning:primary.reasoning,   caveats:primary.caveats,   recommendation:primary.recommendation   } : null,
            secondary: secondary ? { model:secondary.model, gonkaRequestId:secondary.gonkaRequestId, truthScore:secondary.truthScore, verdict:secondary.verdict, summary:secondary.summary, reasoning:secondary.reasoning, caveats:secondary.caveats, recommendation:secondary.recommendation } : null,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Fact-check error:', err.message);
        res.status(500).json({ error: 'Fact-check failed: ' + err.message });
    }
});

// ---- Pages ----
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'index.html')));
app.get('/elderly', (req,res) => res.sendFile(path.join(__dirname,'elderly.html')));
app.get('/login', (req,res) => res.sendFile(path.join(__dirname,'login.html')));
app.get('/family', (req,res) => res.sendFile(path.join(__dirname,'family-dashboard.html')));
app.get('/caregiver', (req,res) => res.sendFile(path.join(__dirname,'caregiver-dashboard.html')));
app.get('/fact-check', (req,res) => res.sendFile(path.join(__dirname,'fact-checker.html')));

const PORT = process.env.PORT||3000;
app.listen(PORT, () => {
    console.log('\n🚀 MORY — Gonka Router Edition v2');
    console.log(`🌐 http://localhost:${PORT}/elderly`);
    console.log(`📡 Gonka: ${gonkaClient?'✅ Connected (multi-model consensus)':'⚠️  Fallback only'}`);
    if(gonkaClient) console.log(`   Models: ${GONKA_MODELS.join(' | ')}`);
    console.log(`🌍 Dialects: ${Object.keys(LANGUAGE_MAP).join(', ')}\n`);
});