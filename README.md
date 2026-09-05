<div align="center">
  <h1>💜 MORY</h1>
  <h3>Remember You. Remember Me. Our Memory.</h3>
  <p>AI-powered multilingual elderly care platform built on the Gonka Decentralised Inference Network</p>

  [![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-morrywebsite.onrender.com-6D3B97?style=for-the-badge)](https://morrywebsite.onrender.com/elderly.html)
  [![Track](https://img.shields.io/badge/Track-AI_for_Society-27AE60?style=for-the-badge)]()
  [![Gonka](https://img.shields.io/badge/Powered_by-Gonka_Router-2980B9?style=for-the-badge)](https://gonkarouter.io)
</div>

---

## 1. Project Description

MORY is a human-centred digital care platform designed to enhance the daily care and wellbeing of older adults, while strengthening communication and coordination among family members and caregivers.

As families become increasingly geographically dispersed and caregiving responsibilities become more demanding, maintaining consistent and comprehensive elderly care can be challenging. MORY addresses this gap by integrating essential aspects of everyday care — including medication management, cognitive engagement, emotional companionship, family monitoring, and emergency support — into a single, accessible platform.

### Five Core Features

| # | Feature | Description |
|---|---|---|
| 1 | 💊 **Medication Management** | Scan and organise medication labels using OCR + AI. Reads dosage, timing, purpose, and provides plain-language explanations in the user's dialect. |
| 2 | 🧠 **Cognitive Engagement** | Memory match, number sequence, and reaction games with streak tracking and cognitive trend analysis. |
| 3 | 🗣️ **AI Companion** | Voice-based conversational companion in 6 Southeast Asian dialects (Cantonese, Hokkien, Hakka, Mandarin, English, Bahasa Melayu), powered by Gonka multi-model consensus. |
| 4 | 📋 **Family Dashboard** | Real-time daily observations (mood, appetite, sleep, activity) structured by AI into concise summaries for remote family members. Includes mood trend analysis and care journal. |
| 5 | 🚨 **Safety & Emergency** | Hold-to-alert emergency button with GPS location sharing, audio alarm, browser notification, and real-time alert on family/caregiver dashboards. |

> *MORY is guided by the principle: **AI assists. Humans decide. Care remains human.***

---

## 2. Problem Statement

The ageing population, increasing geographical separation of families, and growing demands on caregivers have created significant challenges in maintaining consistent elderly care.

| Challenge | Impact |
|---|---|
| **Medication complexity** | Multiple medications with different dosages, unfamiliar terminology, and missed doses increase risk of errors |
| **Limited cognitive engagement** | Subtle cognitive changes go unnoticed when family members interact only occasionally |
| **Social isolation** | Physical distance contributes to loneliness; generic AI lacks cultural and personal context |
| **Fragmented care information** | Caregiver observations are undocumented, making trends invisible to remote family |
| **Limited family visibility** | Off-site family cannot monitor day-to-day wellbeing without repeated calls |
| **Emergency uncertainty** | Older adults may not know how to reach family quickly during falls or health concerns |
| **Caregiver burnout** | Continuous caregiving without coordination leads to exhaustion and unsustainable care |

---

## 3. Blockchain / Decentralised Technology Used

### Gonka Router — Decentralised AI Inference Network

All AI reasoning in MORY runs exclusively on the **Gonka Router** (`gonkarouter.io`) — a decentralised AI inference network that distributes computation across independent nodes rather than routing through a single centralised provider.

#### Why Gonka Router?

| Property | Centralised AI | Gonka Router |
|---|---|---|
| Single point of failure | ✅ Yes | ❌ No |
| Censorship resistance | ❌ No | ✅ Yes |
| Verifiable inference | ❌ No | ✅ Gonka Request ID per call |
| Multi-model neutrality | ❌ Vendor-locked | ✅ Cross-model consensus |

#### How MORY Uses Gonka Router

MORY implements **multi-model consensus** — every AI call fires two independent models simultaneously and cross-verifies their outputs:

```
User Input
    │
    ▼
┌─────────────────────────────────────┐
│         MORY Server (Node.js)       │
│  Sends request to Gonka Router API  │
└───────┬─────────────────┬───────────┘
        │                 │  (parallel)
        ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│DeepSeek V4   │  │ MiniMax M2.7     │
│Flash (Primary│  │ (Secondary)      │
│              │  │                  │
│Gonka ID: r1  │  │ Gonka ID: r2     │
└──────┬───────┘  └──────┬───────────┘
       │                 │
       └────────┬────────┘
                ▼
        Consensus Score
    (average of both verdicts)
```

#### Gonka Request ID — On-Network Proof

Every AI call returns a `gonkaRequestId`. MORY surfaces this in the UI:
- **AI Companion chat**: Gonka ID shown in the response panel (collapsible)
- **Medicine Scanner**: Both model IDs shown in the Caregiver Details panel
- **Health Fact Checker**: Per-model Gonka IDs displayed in the transparency dashboard

This ID proves that inference ran on the Gonka decentralised network — not a centralised server — satisfying the competition's on-chain verification requirement.

#### Models Used

| Model | Role | Provider |
|---|---|---|
| `deepseek-ai/DeepSeek-V4-Flash-0731` | Primary inference | DeepSeek AI |
| `MiniMaxAI/MiniMax-M2.7` | Secondary / consensus | MiniMax AI |
| `moonshotai/Kimi-K2.6` | Tertiary fallback | Moonshot AI |

#### AI Features on Gonka

| Feature | Gonka Calls | Consensus |
|---|---|---|
| Voice Companion (chat reply) | 2 parallel | ✅ Both models |
| Medicine Label Reading | 2 sequential | ✅ Label + Knowledge |
| Health Fact Checker | 2 sequential + fallback | ✅ Truth Score consensus |
| Care Journal Structuring | 2 parallel | ✅ Both models |
| Mood Analysis | 1 call | — |

---

## 4. Smart Contract Addresses (Testnet)

MORY does not deploy traditional EVM smart contracts. The decentralised layer is the **Gonka Router inference network itself**. Each `gonkaRequestId` returned by the API functions as a verifiable on-network proof that inference ran on a decentralised node — not a centralised server.

**Gonka Network Details:**

| Parameter | Value |
|---|---|
| Gateway URL | `https://api.gonkarouter.io/v1` |
| API Standard | OpenAI-compatible (Chat Completions) |
| Primary Model | `deepseek-ai/DeepSeek-V4-Flash-0731` |
| Secondary Model | `MiniMaxAI/MiniMax-M2.7` |
| Tertiary Model | `moonshotai/Kimi-K2.6` |
| Request Proof | `gonkaRequestId` field in every API response |

The Gonka Request IDs displayed in MORY's UI serve the same transparency purpose as an on-chain transaction hash — they allow anyone to verify that a specific inference step occurred on the Gonka network at a specific time.

---

## 5. Setup and Installation

### Prerequisites

- **Node.js** v18 or higher → https://nodejs.org
- **Gonka Router API key** → https://gonkarouter.io
- **Chrome or Edge** browser (Firefox does not support Web Speech API)

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/mory.git
cd mory
```

### Step 2 — Install dependencies

```bash
npm install
```

Expected output:
```
added 131 packages, audited 131 packages in 8s
```

### Step 3 — Create environment file

Create a `.env` file in the project root:

```env
GONKA_API_KEY=your-gonka-api-key-here
GONKA_ROUTER_URL=https://api.gonkarouter.io/v1
SESSION_SECRET=any-long-random-string-here
PORT=3000
```

> ⚠️ Never commit your `.env` file. It is already listed in `.gitignore`.

### Step 4 — Start the server

```bash
node server.js
```

Expected output:
```
🚀 MORY — Gonka Router Edition v2
🌐 http://localhost:3000/elderly
📡 Gonka: ✅ Connected (multi-model consensus)
   Models: deepseek-ai/DeepSeek-V4-Flash-0731 | MiniMaxAI/MiniMax-M2.7 | moonshotai/Kimi-K2.6
🌍 Dialects: cantonese, hokkien, hakka, mandarin, english, bm
```

### Step 5 — Open in browser

| User | URL | Description |
|---|---|---|
| **Senior** | `http://localhost:3000/elderly` | AI companion, medication, games, emergency |
| **Family** | `http://localhost:3000/login?role=family` | Daily summary, medication tracker, care journal |
| **Caregiver** | `http://localhost:3000/login?role=caregiver` | Log observations, medication management |
| **Fact Checker** | `http://localhost:3000/fact-check` | Health claim verification (public) |

### Demo Accounts

| Role | Username | Password |
|---|---|---|
| Family | `family` | `family123` |
| Caregiver | `caregiver` | `caregiver123` |

### Project File Structure

```
mory/
├── server.js                  ← Backend: all APIs + Gonka Router integration
├── .env                       ← Environment variables (not committed)
├── package.json
│
├── elderly.html               ← Senior companion screen
├── elderly-script.js          ← Senior app logic (voice, games, pills, emergency)
├── elderly-style.css
├── ui-redesign-patch.js       ← UI: pill cards, contact cards, chat display
├── games-ui-patch.js          ← UI: brain games menu
├── medicine-camera.js         ← Live camera scan + OCR + medicine knowledge
│
├── family-dashboard.html      ← Family monitoring dashboard
├── family-script.js
│
├── caregiver-dashboard.html   ← Caregiver dashboard
├── caregiver-script.js
│
├── fact-checker.html          ← Health Fact Checker (standalone page)
├── emergency-patch.js         ← Emergency alert: audio, notification, fast polling
├── dashboard-style.css
│
├── auth-script.js             ← Authentication guard
├── index.html                 ← Landing / role selector
├── login.html
└── login-style.css
```

### Supported Languages / Dialects

| Dialect | Speech Input | AI Response | TTS Output |
|---|---|---|---|
| 廣東話 Cantonese | ✅ `zh-HK` | ✅ | ✅ |
| 福建話 Hokkien | ✅ `zh-TW` | ✅ | ✅ |
| 客家話 Hakka | ✅ `zh-CN` | ✅ | ✅ |
| 华语 Mandarin | ✅ `zh-CN` | ✅ | ✅ |
| English | ✅ `en-US` | ✅ | ✅ |
| Bahasa Melayu | ✅ `ms-MY` | ✅ | ✅ |

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML / CSS / JavaScript |
| Voice Input | Web Speech API (browser built-in) |
| Text-to-Speech | Web Speech Synthesis API (browser built-in) |
| Backend | Node.js + Express.js |
| AI Inference | Gonka Router (decentralised, OpenAI-compatible) |
| OCR | Tesseract.js (local, no external API needed) |
| Authentication | bcryptjs + express-session |
| Storage | JSON file-based (local persistence) |

---

## 6. Team Members

| Name | Role | Key Responsibilities |
|---|---|---|
| **Sanzy Lee** | Product Lead & UI/UX | User experience design, elderly-centred interface, PDF mockups, user flow |
| **Ten Jing Yi** | Full-Stack Developer | Server architecture, Gonka Router integration, API endpoints, patch system |
| **Joey Teo** | AI & Feature Integration | AI companion prompting, medicine scanner, fact-checker, multi-model consensus logic |

---

## Privacy, Security and Responsible AI

### Privacy by Design

- **Data minimisation** — only the minimum information needed for each function is processed
- **No full medical history exposure** — MORY never sends a patient's complete record to any AI model
- **Session-based auth** — bcrypt-hashed passwords, httpOnly cookies
- **Decentralised AI** — Gonka Router distributes inference across nodes, reducing dependence on any single centralised provider
- **Identity separation** — patient identity is separated from sensitive health records where possible

### Responsible AI Principles

MORY **does not**:
- Provide medical diagnoses
- Prescribe or modify medication
- Replace healthcare professionals, caregivers, or family support
- Replace emergency medical services

Every AI-generated response includes a clear disclaimer. The platform is designed to support human decision-making, not replace it.

---

## Live Demo

🌐 **https://morrywebsite.onrender.com/elderly.html**

> Note: Hosted on Render free tier — first load after inactivity may take ~30 seconds to wake up. Open the URL once before your demo to pre-warm it.

---

<div align="center">
  Built with 💜 for the Gonka Hackathon — AI for Society Track<br>
  <strong>MORY — Remember You, Remember Me. Our Memory.</strong>
</div>
