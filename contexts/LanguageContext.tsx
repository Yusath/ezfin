import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'id' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Nav & Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.history': 'History',
    'nav.stats': 'Statistics',
    'nav.settings': 'Settings',
    'nav.add': 'New Transaction',
    
    // Dashboard
    'dash.welcome': 'Welcome back',
    'dash.balance': 'Total Balance',
    'dash.income': 'Income',
    'dash.expense': 'Expense',
    'dash.quickSum': 'Quick Summary',
    'dash.txMonth': 'Transactions This Month',
    'dash.avgSpend': 'Avg. Daily Spend',
    'dash.analytics': 'Analytics',
    'dash.recent': 'Recent Transactions',
    'dash.viewAll': 'View All',
    'dash.noTx': 'No transactions yet.',
    'dash.profile': 'Profile',
    'dash.connect': 'Connect Cloud',
    
    // Add Transaction
    'add.title': 'New Transaction',
    'add.scan': 'Scan Receipt',
    'add.scan.ai': 'AI Powered Accuracy',
    'add.scan.offline': 'Offline Mode Active',
    'add.store': 'Store Name',
    'add.items': 'Items',
    'add.addItem': 'Add Item',
    'add.date': 'Date',
    'add.category': 'Category',
    'add.total': 'Total',
    'add.save': 'Save Transaction',
    'add.saving': 'Saving...',
    'add.expense': 'Expense',
    'add.income': 'Income',
    
    // History
    'hist.title': 'History',
    'hist.search': 'Search transactions...',
    'hist.filter.all': 'All',
    'hist.noFound': 'No transactions found',

    // Stats
    'stats.title': 'Financial Analysis',
    'stats.dist': 'Expense Distribution',
    'stats.details': 'Category Details',
    'stats.advisor.btn': 'AI Advisor',
    'stats.advisor.desc': 'Ask for smart saving tips',
    'stats.noData': 'No expense data yet.',

    // Settings
    'set.title': 'Settings',
    'set.export': 'Export Data',
    'set.export.desc': 'Download to Excel, PDF or Docx',
    'set.google': 'Google Account',
    'set.backup': 'Backup & Sync',
    'set.backup.desc': 'Sign in to access Drive backup features.',
    'set.signin': 'Sign In to Continue',
    'set.sheet': 'Target Spreadsheet',
    'set.sync': 'Sync & Import from Cloud',
    'set.pref': 'Preferences',
    'set.lang': 'Language',
    'set.dark': 'Dark Mode',
    'set.online': 'Online AI Scan',
    'set.online.desc': 'Use Cloud AI for better accuracy',
    'set.cats': 'Categories',
    'set.sec': 'Security',
    'set.pin': 'Change PIN',
    'set.updatePin': 'Update PIN',
    'set.logout': 'Disconnect',
    'set.folder': 'Destination Folder (Optional)',
    'set.searchFolder': 'Search Drive Folder...',
    
    // Common
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.success': 'Success',
    'common.error': 'Error',
  },
  id: {
    // Nav & Sidebar
    'nav.dashboard': 'Beranda',
    'nav.history': 'Riwayat',
    'nav.stats': 'Statistik',
    'nav.settings': 'Pengaturan',
    'nav.add': 'Transaksi Baru',
    
    // Dashboard
    'dash.welcome': 'Selamat datang',
    'dash.balance': 'Total Saldo',
    'dash.income': 'Pemasukan',
    'dash.expense': 'Pengeluaran',
    'dash.quickSum': 'Ringkasan Cepat',
    'dash.txMonth': 'Transaksi Bulan Ini',
    'dash.avgSpend': 'Rata-rata Harian',
    'dash.analytics': 'Analisis',
    'dash.recent': 'Transaksi Terakhir',
    'dash.viewAll': 'Lihat Semua',
    'dash.noTx': 'Belum ada transaksi.',
    'dash.profile': 'Profil',
    'dash.connect': 'Hubungkan Cloud',

    // Add Transaction
    'add.title': 'Tambah Transaksi',
    'add.scan': 'Scan Struk',
    'add.scan.ai': 'Akurasi Tinggi (AI)',
    'add.scan.offline': 'Mode Offline Aktif',
    'add.store': 'Nama Toko',
    'add.items': 'Item Belanja',
    'add.addItem': 'Tambah Item',
    'add.date': 'Tanggal',
    'add.category': 'Kategori',
    'add.total': 'Total',
    'add.save': 'Simpan Transaksi',
    'add.saving': 'Menyimpan...',
    'add.expense': 'Pengeluaran',
    'add.income': 'Pemasukan',

    // History
    'hist.title': 'Riwayat',
    'hist.search': 'Cari transaksi...',
    'hist.filter.all': 'Semua',
    'hist.noFound': 'Transaksi tidak ditemukan',

    // Stats
    'stats.title': 'Analisis Keuangan',
    'stats.dist': 'Distribusi Pengeluaran',
    'stats.details': 'Rincian Kategori',
    'stats.advisor.btn': 'Asisten AI',
    'stats.advisor.desc': 'Minta saran penghematan cerdas',
    'stats.noData': 'Belum ada data pengeluaran.',

    // Settings
    'set.title': 'Pengaturan',
    'set.export': 'Ekspor Data',
    'set.export.desc': 'Unduh ke Excel, PDF atau Docx',
    'set.google': 'Akun Google',
    'set.backup': 'Backup & Sinkronisasi',
    'set.backup.desc': 'Masuk untuk fitur backup ke Drive.',
    'set.signin': 'Masuk dengan Google',
    'set.sheet': 'Spreadsheet Target',
    'set.sync': 'Sinkron & Impor dari Cloud',
    'set.pref': 'Preferensi',
    'set.lang': 'Bahasa',
    'set.dark': 'Mode Gelap',
    'set.online': 'Scan AI Online',
    'set.online.desc': 'Gunakan Cloud AI untuk hasil akurat',
    'set.cats': 'Kategori',
    'set.sec': 'Keamanan',
    'set.pin': 'Ganti PIN',
    'set.updatePin': 'Perbarui PIN',
    'set.logout': 'Putuskan Akun',
    'set.folder': 'Folder Tujuan (Opsional)',
    'set.searchFolder': 'Cari Folder Drive...',

    // Common
    'common.cancel': 'Batal',
    'common.confirm': 'Konfirmasi',
    'common.success': 'Berhasil',
    'common.error': 'Gagal',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('id');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') as Language;
    if (savedLang) {
      setLanguage(savedLang);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string): string => {
    // @ts-ignore
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};