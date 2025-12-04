<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1FRbn4WaXKKSMP40Pi4wkymUqHF7p5OgX

## Environment

The app now runs without the previous Gemini dependency. Configure Google access at build or runtime by providing:

- `GOOGLE_CLIENT_ID` – OAuth Client ID used by Google Identity Services.
- `GOOGLE_API_KEY` – API key for Google Sheets/Drive discovery.

These values are read from environment variables (e.g., `.env` or your host’s runtime env) and never persisted in browser storage.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Provide `GOOGLE_CLIENT_ID` (and optionally `GOOGLE_API_KEY`) in `.env` or your host environment.
3. Run the app:
   `npm run dev`

## Package as an APK (PWA)

1. Build the production bundle: `npm run build` (output in `dist/`).
2. Use a PWA-to-APK tool such as [PWABuilder](https://www.pwabuilder.com/) or `bubblewrap` to wrap the `dist` output into an installable Android APK.
3. When configuring the wrapper, ensure the start URL matches your deployed PWA origin and that the required permissions (e.g., camera for OCR) are requested.
