# Comprehensive Step-by-Step Environment Setup Guide

This document provides detailed step-by-step instructions to obtain and configure every required environment variable in your `apps/api/.env` and `apps/web/.env.local` files.

---

## 1. Quick Local Secrets Generation (JWT & System Passwords)

Run these commands in your PowerShell or Terminal to generate secure, cryptographically random strings for signing tokens.

### A. `JWT_SECRET` (Required)
Run this command in PowerShell/Terminal:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste it into `apps/api/.env`:
```env
JWT_SECRET=your_generated_64_char_hex_string
```

### B. `REFERRAL_SECRET` (Recommended)
Run the same command again to get a separate secret for referral link tokens:
```powershell
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```
Copy and paste into `apps/api/.env`:
```env
REFERRAL_SECRET=your_generated_32_char_hex_string
```

### C. System Passwords (Recommended)
Set initial fallback passwords for seeding and subadmins:
```env
DEMO_SEED_PASSWORD=SuperSecurePassword123!
SUBADMIN_DEFAULT_PASSWORD=SubAdminSecretPass2026!
ADMIN_EMAILS=admin@mrh-academy.example
```

---

## 2. Google OAuth 2.0 & Service Account Setup

Required for: **Google Login** and **Automated Google Meet Calendar Event creation**.

### Step-by-Step Instructions:

1. **Go to Google Cloud Console**: [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Create a new project named **MRH Academy**.
3. **Configure OAuth Screen**:
   - Go to **APIs & Services > OAuth consent screen**.
   - Select **External** and click **Create**.
   - Fill in app name, user support email, and developer contact information. Save and continue.
4. **Create Credentials for Google Sign-In**:
   - Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Choose **Web Application**.
   - Under **Authorized redirect URIs**, add:
     `http://localhost:4000/api/v1/auth/google/callback`
   - Click **Create**.
   - Copy the Client ID and Client Secret into `apps/api/.env`:
```env
GOOGLE_CLIENT_ID=1234567890-xyz...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
```

5. **Create Service Account for Google Calendar (Google Meet links)**:
   - Go to **APIs & Services > Credentials > Create Credentials > Service Account**.
   - Name it `mrh-calendar-service`.
   - Click **Create and Continue**, then **Done**.
   - Click on the newly created Service Account email, navigate to the **Keys** tab, and click **Add Key > Create new key > JSON**.
   - Open the downloaded JSON file:
     - `client_email` goes to `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
     - `private_key` goes to `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (formatted as a single line with `\n`).
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=mrh-calendar-service@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_IMPERSONATE_EMAIL=admin@your-google-workspace-domain.com
```

---

## 3. Cloudinary Setup (Image & Asset Storage)

Required for: **Uploading user avatars, course thumbnails, and assignment attachments**.

### Step-by-Step Instructions:

1. **Sign Up / Log In**: [https://cloudinary.com/console](https://cloudinary.com/console)
2. Go to your **Dashboard**.
3. Under **Product Environment Details**, copy the following three values:
   - **Cloud Name**
   - **API Key**
   - **API Secret** (Click "View API Secret")
4. Paste into `apps/api/.env`:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123
```

---

## 4. Bunny.net Setup (Video Hosting & HLS Streaming)

Required for: **High-speed secure course video hosting, transcoding, and signed embed playback**.

### Step-by-Step Instructions:

1. **Sign Up / Log In**: [https://bunny.net/](https://bunny.net/)
2. Navigate to **Stream** in the left sidebar.
3. Click **Add Video Library** and name it `MRH Academy Stream`.
4. Click on your newly created Stream Library and note the **Library ID** from the URL or overview page.
5. **API Key & Readonly API Key**:
   - Go to **Account Settings > API** in your Bunny dashboard.
   - Copy your **Account API Key** to `BUNNY_API_KEY`.
   - Copy your **Read-Only API Key** to `BUNNY_READONLY_API_KEY`.
6. **CDN Hostname**:
   - Go to **Stream Library > Delivery Domains**.
   - Copy the pull zone domain (e.g. `video.mrh-academy.b-cdn.net`).
7. **Token Authentication Key**:
   - Go to **Stream Library > Security**.
   - Enable **Token Authentication** and **Embed View Token Authentication**.
   - Copy the **Token Authentication Key**.
8. Paste all values into `apps/api/.env`:
```env
BUNNY_API_KEY=your_bunny_account_api_key
BUNNY_READONLY_API_KEY=your_bunny_readonly_key
BUNNY_LIBRARY_ID=123456
BUNNY_CDN_HOSTNAME=video.mrh-academy.b-cdn.net
BUNNY_TOKEN_AUTH_KEY=your_token_security_key
```

---

## 5. Google Gemini AI Setup

Required for: **AI Tutor assistant, automated quiz generation, and content summaries**.

### Step-by-Step Instructions:

1. Go to **Google AI Studio**: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**.
3. Select your Google Cloud project (or create a new standard one).
4. Copy the API Key (starts with `AIzaSy...`).
5. Paste into `apps/api/.env`:
```env
GEMINI_API_KEY=AIzaSy...
```

---

## 6. Metered.ca WebRTC Setup (Virtual Classrooms)

Required for: **Live streaming rooms and WebRTC video calling credentials**.

### Step-by-Step Instructions:

1. **Sign Up / Log In**: [https://www.metered.ca/](https://www.metered.ca/)
2. Go to **Dashboard > Account Settings / API Keys**.
3. Copy your **Secret API Key**.
4. Paste into `apps/api/.env`:
```env
METERED_API_KEY=your_metered_secret_api_key
METERED_APP_NAME=mrh_academy
```
5. *(Optional)* For frontend WebRTC TURN credentials in `apps/web/.env.local`:
```env
NEXT_PUBLIC_TURN_URL=turn:global.relay.metered.ca:80
NEXT_PUBLIC_TURN_URL_TLS=turns:global.relay.metered.ca:443?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=your_metered_turn_username
NEXT_PUBLIC_TURN_CREDENTIAL=your_metered_turn_password
```

---

## 7. Stripe Setup (Payments & Subscriptions)

Required for: **Processing course enrollments and tutor payouts**.

### Step-by-Step Instructions:

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com/).
2. Toggle on **Test mode** in the top right header.
3. Go to **Developers > API Keys**:
   - Copy **Publishable key** (`pk_test_...`)
   - Copy **Secret key** (`sk_test_...`)
4. Go to **Developers > Webhooks**:
   - Click **Add endpoint**.
   - URL: `http://localhost:4000/api/v1/payments/stripe/webhook` (or your ngrok URL during local testing).
   - Select events: `checkout.session.completed`, `payment_intent.succeeded`.
   - Reveal and copy the **Signing secret** (`whsec_...`).
5. Paste into `apps/api/.env`:
```env
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 8. Email Service Setup (SMTP / Ethereal Mail)

Required for: **Sending invitation emails, password resets, and notifications**.

### Quick Option: Ethereal Mail (Instant Free Test Inbox)

1. Go to [Ethereal.email](https://ethereal.email).
2. Click **Create Ethereal Account**.
3. Copy the account details into `apps/api/.env`:
```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_generated_ethereal_username@ethereal.email
SMTP_PASS=your_generated_ethereal_password
SMTP_FROM="MRH Academy" <no-reply@mrh-academy.example>
```

---

## 9. Verification & Startup Test

Once you have filled in your variables:

1. Validate backend configuration by running:
   ```powershell
   pnpm dev
   ```
2. NestJS Joi validation will check every single field upon startup.
3. If everything is filled correctly, your API will start cleanly on `http://localhost:4000` and web app on `http://localhost:3000`!
