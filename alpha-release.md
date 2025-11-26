# EZFin AutoMate - Alpha Release v0.1.0 🚀

**Student-Focused Personal Finance Manager with AI & Cloud Sync**

Selamat datang di rilis alpha pertama dari **EZFin AutoMate**! Aplikasi ini dirancang khusus untuk mahasiswa dan pelajar Indonesia yang ingin mengelola keuangan dengan cerdas, praktis, dan modern.

## 🌟 Fitur Unggulan (Key Features)

### 1. 🤖 AI Receipt Scanner (Powered by Gemini 2.5)
Malas ketik manual? Cukup foto struk belanja Anda!
*   **Auto-Extraction:** AI otomatis mendeteksi Nama Toko, Tanggal, dan Daftar Item (Nama, Qty, Harga).
*   **Smart Formatting:** Mendukung format struk Indonesia (e.g., "10.000" sebagai "10000").
*   **Auto-Categorization:** Menebak kategori pengeluaran berdasarkan nama toko.

### 2. ☁️ Google Sheets Sync (Real-time Backup)
Data Anda aman dan selalu terhubung.
*   **2-Way Sync:** Transaksi disimpan di Database Lokal dan *langsung* dikirim ke Google Sheets pribadi Anda.
*   **Offline First:** Input data tanpa internet? Tidak masalah. Data akan disinkronisasi otomatis begitu koneksi kembali.
*   **Full Control:** Data tersimpan di Google Drive Anda, bukan di server kami.

### 3. 🔒 Banking-Grade Security
Keamanan data adalah prioritas.
*   **PIN Protection:** Akses aplikasi dilindungi 6-digit PIN.
*   **Idle Lock:** Aplikasi otomatis terkunci jika tidak ada aktivitas selama 30 menit (seperti M-Banking).
*   **Secure Storage:** Token akses Google disimpan aman di session storage.

### 4. 💡 AI Financial Advisor
Bingung cara hemat? Tanya AI!
*   **Personalized Advice:** Dapatkan saran penghematan berdasarkan data pengeluaran *real* Anda bulan ini.
*   **Gen-Z Friendly:** Bahasa santai, tidak kaku, dan memotivasi.

### 5. 📊 Comprehensive Analytics & Export
*   **Interactive Charts:** Visualisasi pengeluaran mingguan/bulanan/tahunan.
*   **Multi-Format Export:** Unduh laporan keuangan ke **PDF**, **Excel**, atau **Word** untuk keperluan arsip atau laporan organisasi.

## 🛠️ Teknologi (Tech Stack)

*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS (iOS Design System)
*   **AI:** Google Gemini API (`gemini-2.5-flash`)
*   **Database:** IndexedDB (Local) + Google Sheets API (Cloud)

---

**Catatan Alpha:**
Karena ini adalah versi Alpha, mungkin masih terdapat *bug* atau ketidakstabilan pada fitur tertentu, terutama pada pencahayaan saat scan struk. Masukan Anda sangat berharga untuk pengembangan selanjutnya!

*Build with ❤️ by Yusathid*
