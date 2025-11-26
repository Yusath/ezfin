# EZFin AutoMate 💸

![Version](https://img.shields.io/badge/version-0.1.0_Alpha-blue)
![Tech](https://img.shields.io/badge/built_with-React_19_+_Vite-61DAFB)
![AI](https://img.shields.io/badge/AI-Google_Gemini_2.5-8E75B2)

**EZFin AutoMate** is a premium, student-focused personal finance manager designed to make tracking money effortless. It combines a beautiful iOS-style interface with the power of **Google Gemini AI** for smart receipt scanning and financial advice, backed by **Google Sheets** for real-time cloud synchronization.

## ✨ Key Features

### 🤖 AI-Powered Receipt Scanning
Forget manual entry. Snap a photo of your receipt, and our AI (powered by **Gemini 2.5 Flash**) automatically extracts:
*   Store Name
*   Date
*   Line Items (Name, Qty, Price)
*   Total Amount
*   Automatic Category Detection

### ☁️ Secure Cloud Sync (Google Sheets)
Your data belongs to you. EZFin syncs directly to your personal **Google Drive**.
*   **Two-Way Sync:** Transactions added offline are synced when online.
*   **Spreadsheet Backup:** View and edit your data in Excel/Sheets format.
*   **Settings Sync:** Profiles, categories, and PINs sync across devices.

### 🔒 Banking-Grade Security
*   **PIN Protection:** Secure access with a 6-digit PIN.
*   **Auto-Lock:** App locks automatically after 30 minutes of inactivity.
*   **Privacy First:** No proprietary servers. Data lives in your browser (IndexedDB) and your Google Drive.

### 📊 Smart Analytics & Reporting
*   **Interactive Charts:** Visualize spending by category or timeframe.
*   **AI Advisor:** Get personalized, Gen-Z friendly financial tips based on your actual spending habits.
*   **Export:** Download professional reports in **PDF**, **Excel (.xlsx)**, or **Word (.doc)**.

### 🎨 Modern Experience
*   **iOS Design System:** Smooth animations, tactile feedback, and clean typography.
*   **Dark Mode:** Fully supported system-wide dark theme.
*   **Multi-Language:** Support for **Bahasa Indonesia** and **English**.

---

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS (Custom iOS Theme)
*   **AI Integration:** Google GenAI SDK (`@google/genai`)
*   **Database:** IndexedDB (Local) + Google Sheets API v4 (Cloud)
*   **Charts:** Recharts
*   **Utilities:** `xlsx`, `jspdf`, `jspdf-autotable`, `lucide-react`

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   A Google Cloud Platform Project (for Sheets API)
*   A Google AI Studio API Key (for Gemini)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/ezfin-automate.git
    cd ezfin-automate
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:
    ```env
    # Your Google Gemini API Key
    API_KEY=your_gemini_api_key_here

    # Your Google OAuth 2.0 Client ID (for Sign-in & Sheets)
    GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
    ```

4.  **Run the App**
    ```bash
    npm run dev
    ```

---

## 🔑 Configuration Guide

### 1. Google Gemini API
1.  Go to [Google AI Studio](https://aistudio.google.com/).
2.  Create a new API Key.
3.  Paste it into `API_KEY` in your `.env` file.

### 2. Google OAuth & Sheets API
1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project.
3.  Enable **Google Sheets API** and **Google Drive API**.
4.  Configure the **OAuth Consent Screen** (add your email as a test user).
5.  Create **OAuth Client ID** credentials (Application Type: Web Application).
    *   Add `http://localhost:5173` to **Authorized JavaScript origins**.
6.  Paste the Client ID into `GOOGLE_CLIENT_ID` in your `.env` file.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with ❤️ for Students.*
