# 🚀 PYXIS Firebase — Complete Deployment Guide

## Why Firebase? Zero India ISP issues. Google's infrastructure. 100% free.

---

## STEP 1 — Create Firebase Project (5 min)

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name it: `pyxis`
4. Disable Google Analytics (not needed) → **Create project**
5. Wait ~30 seconds

---

## STEP 2 — Enable Authentication

1. In Firebase Console → Click **"Authentication"** (left sidebar)
2. Click **"Get started"**
3. Click **"Email/Password"** → Enable it → **Save**
4. Click **"Google"** → Enable it → add your email as support → **Save**

---

## STEP 3 — Enable Firestore Database

1. Click **"Firestore Database"** (left sidebar)
2. Click **"Create database"**
3. Select **"Start in production mode"** → **Next**
4. Choose region: **asia-south1 (Mumbai)** → **Enable**
5. Wait 1 minute for it to provision

### Add Firestore Security Rules:
Click **"Rules"** tab → replace everything with this → **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /conversations/{convId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        match /messages/{msgId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
      match /private/{doc} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## STEP 4 — Get Firebase Config Keys

### Client Keys:
1. Click the **gear icon ⚙️** → **Project settings**
2. Scroll down to **"Your apps"** → Click **"</>"** (Web app)
3. Register app name: `pyxis-web` → **Register app**
4. You'll see the config object — copy these values:
```
apiKey → NEXT_PUBLIC_FIREBASE_API_KEY
authDomain → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
projectId → NEXT_PUBLIC_FIREBASE_PROJECT_ID
storageBucket → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
messagingSenderId → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
appId → NEXT_PUBLIC_FIREBASE_APP_ID
```

### Admin/Server Keys:
1. Still in **Project settings** → Click **"Service accounts"** tab
2. Click **"Generate new private key"** → **Generate key**
3. A JSON file downloads — open it and copy:
```
project_id → FIREBASE_PROJECT_ID
client_email → FIREBASE_CLIENT_EMAIL
private_key → FIREBASE_PRIVATE_KEY (the entire -----BEGIN PRIVATE KEY----- string)
```

---

## STEP 5 — Push to GitHub

Extract the zip to Desktop, then run in PowerShell:

```powershell
cd C:\Users\ranji\OneDrive\Desktop\pyxis-firebase

git init
git add .
git commit -m "PYXIS v3 - Firebase Production"
git branch -M main
git remote add origin https://github.com/RKRanjithkumarRK/pyxis-frontend.git
git push -u origin main --force
```

---

## STEP 6 — Deploy on Vercel

1. Go to **vercel.com** → your project → **Settings → Environment Variables**
2. Add ALL of these (delete old Supabase ones first):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from Step 4 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | from Step 4 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | from Step 4 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | from Step 4 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from Step 4 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | from Step 4 |
| `FIREBASE_PROJECT_ID` | from service account JSON |
| `FIREBASE_CLIENT_EMAIL` | from service account JSON |
| `FIREBASE_PRIVATE_KEY` | from service account JSON (paste entire key with -----BEGIN...) |
| `GROQ_API_KEY` | your Groq key |
| `ANTHROPIC_API_KEY` | your Anthropic key (or `not-configured`) |
| `OPENAI_API_KEY` | your OpenAI key (or `not-configured`) |
| `GOOGLE_API_KEY` | your Gemini key |
| `NEXT_PUBLIC_APP_URL` | `https://pyxis-frontend.vercel.app` |

3. Go to **Settings → General → Root Directory** → set to blank (empty)
4. Go to **Deployments** → **Redeploy**

---

## STEP 7 — Add Vercel URL to Firebase Auth

1. Firebase Console → **Authentication → Settings → Authorized domains**
2. Click **"Add domain"**
3. Add: `pyxis-frontend.vercel.app`
4. Click **Add**

---

## ✅ You're Live!

Open `https://pyxis-frontend.vercel.app`
→ Sign up with email OR Google
→ Start chatting with Groq (free, instant) or add your other keys in Settings

---

## Free Tier Limits (More than enough)
- Firestore: 50,000 reads/day, 20,000 writes/day, 1GB storage
- Firebase Auth: Unlimited users
- Vercel: 100GB bandwidth/month
- Groq: 14,400 req/day free

**Zero ISP blocking. Works perfectly in India. Google's servers.**
