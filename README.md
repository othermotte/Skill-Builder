<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Td1WETI_o2tYMnXat9X2yvhbaHdhzrSh

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Add the Firebase client configuration values from [.env.example](.env.example) to `.env.local`.
3. Run the app:
   `npm run dev`

The permanent Gemini API key must not be added to frontend environment files.
Production AI calls use Firebase Cloud Functions, with `GEMINI_API_KEY` stored in
Google Secret Manager.

To test local Functions changes before deployment, start the Firebase Functions
emulator on port 5001 and set `VITE_USE_FUNCTIONS_EMULATOR=true` in `.env.local`.
Keep `GEMINI_API_KEY` in the emulator process environment; do not add it to a
frontend environment file.
