
import React, { useState, useEffect } from 'react';
import { UserProfile, Category, Transaction, AIConfig } from '../types';
import { Moon, Shield, Trash2, Plus, Cloud, FileSpreadsheet, LogOut, Loader2, ArrowRight, Download, Globe, FileText, Folder, ChevronDown, Sliders, Tag, Lock, Check, AlertTriangle, Smile, X, Grid, Palette, Image as ImageIcon, Upload, Cpu, Key, Server, Bot } from 'lucide-react';
import { googleSheetService } from '../services/googleSheetService';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/db';
import { exportService } from '../services/exportService';
import { hashPin } from '../utils/security';
import { APP_THEMES } from '../constants';
import { getAIConfig, saveAIConfig } from '../services/aiService';

interface SettingsProps {
  user: UserProfile;
  categories: Category[];
  darkMode: boolean;
  themeColor: string;
  toggleTheme: () => void;
  setThemeColor: (color: string) => void;
  backgroundImage?: string | null;
  setBackgroundImage?: (url: string | null) => void;
  onAddCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  updateUser: (user: Partial<UserProfile>) => void;
  onImportTransactions: (txs: Transaction[]) => void;
  onSyncSettings: (sheetId: string) => Promise<boolean>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onGoogleSessionError: () => void;
}

type ExportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type SettingsSection = 'security' | null;

// Curated List of Emojis for Finance App
const EMOJI_LIST = [
  // Finance & Work
  "💰", "💸", "💳", "🏦", "🧾", "💵", "💎", "⚖️", "💼", "📈", "📉", "📎", "💻", "📱", "🖨️",
  // Food & Drink
  "🍔", "🍕", "🍜", "🍞", "🥩", "🍗", "🍰", "☕", "🍺", "🍽️", "🥗", "🍣", "🍱", "🍦", "🥤",
  // Transport
  "🚗", "🚕", "🚌", "🚑", "🚒", "✈️", "🚀", "⛽", "🚧", "🚦", "🛵", "🚲", "🚂", "🛥️", "🗺️",
  // Shopping & Clothing
  "🛍️", "👗", "👕", "👖", "👠", "👓", "💍", "🎒", "🧢", "💄", "👟", "📦", "🎁", "🛒", "🏷️",
  // Home & Utilities
  "🏠", "🏢", "🏥", "🏨", "🚿", "💡", "🔌", "🧯", "🧹", "🧻", "🛏️", "🛋️", "🛁", "🔑", "🔧",
  // Entertainment & Hobbies
  "🎮", "🎬", "🎧", "🎤", "🎨", "🎳", "🎲", "🧩", "🎫", "🎪", "📚", "⚽", "🏀", "🏋️", "🧘",
  // Health & Misc
  "💊", "🩺", "🦷", "🐶", "🐱", "👶", "🎉", "✈️", "🎓", "💒", "⛪", "🕌", "🙏", "❤️", "⭐"
];

const AccordionItem = ({ title, icon: Icon, subtext, isOpen, onToggle, children }: any) => {
  return (
    <div className={`bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden transition-all duration-300 border border-gray-100 dark:border-white/5 ${isOpen ? 'shadow-lg ring-1 ring-black/5 dark:ring-white/10' : 'shadow-sm'}`}>
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3.5 ios-touch-target"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors duration-300 ${isOpen ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
            <Icon size={16} strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-xs text-gray-900 dark:text-white tracking-tight">{title}</h2>
            {!isOpen && subtext && <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{subtext}</p>}
          </div>
        </div>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-gray-100 dark:bg-white/10 rotate-180 text-primary' : 'text-gray-300 dark:text-gray-600'}`}>
           <ChevronDown size={14} strokeWidth={3} />
        </div>
      </button>
      
      {isOpen && (
        <div className="px-3.5 pb-4 pt-0 animate-accordion-down origin-top">
          <div className="h-px w-full bg-gray-100 dark:bg-white/5 mb-4"></div>
          {children}
        </div>
      )}
    </div>
  );
};

const SettingsModal = ({ title, isOpen, onClose, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-ios-fade-in">
       <div 
         className="absolute inset-0" 
         onClick={onClose}
       ></div>
       <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-[1.5rem] p-5 shadow-2xl flex flex-col max-h-[85vh] page-slide-up relative z-10">
          <div className="flex justify-between items-center mb-3 border-b border-gray-100 dark:border-white/5 pb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
            <button onClick={onClose} className="p-1.5 bg-gray-100 dark:bg-white/10 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 ios-touch-target">
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto no-scrollbar pb-safe space-y-3">
            {children}
          </div>
       </div>
    </div>
  );
};

const Settings: React.FC<SettingsProps> = ({ 
  user, categories, darkMode, themeColor, toggleTheme, setThemeColor, backgroundImage, setBackgroundImage, onAddCategory, onDeleteCategory, updateUser, onImportTransactions, onSyncSettings, addToast, onGoogleSessionError
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [openSection, setOpenSection] = useState<SettingsSection>(null);
  
  // Modals State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  const [catTypeFilter, setCatTypeFilter] = useState<'expense' | 'income'>('expense');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [newPin, setNewPin] = useState('');
  const [oldPinInput, setOldPinInput] = useState(''); 
  const [resetPinInput, setResetPinInput] = useState('');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('monthly');
  
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [foundSheets, setFoundSheets] = useState<Array<{id: string, name: string}>>([]);
  
  const [folderQuery, setFolderQuery] = useState('');
  const [foundFolders, setFoundFolders] = useState<Array<{id: string, name: string}>>([]);
  const [selectedFolder, setSelectedFolder] = useState<{id: string, name: string} | null>(null);
  const [newSheetNameSuffix, setNewSheetNameSuffix] = useState('');

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>(getAIConfig());

  useEffect(() => {
    const loadTx = async () => {
      const tx = await dbService.getAllTransactions();
      setAllTransactions(tx);
    };
    loadTx();
  }, []);

  const filteredCategories = categories.filter(c => c.type === catTypeFilter);

  const toggleSection = (section: SettingsSection) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleAddCategoryClick = () => {
    if (!newCatName) return;
    onAddCategory({
      id: Math.random().toString(36).substr(2, 9),
      name: newCatName,
      icon: newCatIcon,
      type: catTypeFilter
    });
    setNewCatName('');
    setNewCatIcon('📦'); // Reset to default
  };

  const handleSavePinClick = () => {
    if (newPin.length !== 6) {
      addToast('PIN must be 6 digits', 'error');
      return;
    }
    setOldPinInput('');
    setIsConfirmOpen(true);
  };

  const verifyAndSavePin = async () => {
    const hashedOld = await hashPin(oldPinInput);
    if (hashedOld !== user.pin && oldPinInput !== user.pin) { 
      addToast('Wrong Old PIN', 'error');
      return;
    }
    const hashedNew = await hashPin(newPin);
    updateUser({ pin: hashedNew });
    setNewPin('');
    setIsConfirmOpen(false);
    addToast('PIN Updated', 'success');
  };

  const handleResetData = async () => {
     const hashedInput = await hashPin(resetPinInput);
     if (hashedInput !== user.pin && resetPinInput !== user.pin) {
        addToast('PIN Salah!', 'error');
        return;
     }

     try {
        await dbService.clearAllTransactions();
        if (user.googleSheetId) {
             addToast('Clearing Cloud Data...', 'info');
             await googleSheetService.clearAllData(user.googleSheetId);
        }
        addToast('Semua data berhasil direset.', 'success');
        setTimeout(() => {
           window.location.reload();
        }, 1500);
     } catch (e) {
        console.error(e);
        addToast('Gagal mereset data.', 'error');
     }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && setBackgroundImage) {
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            addToast('Ukuran gambar maksimal 2MB', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setBackgroundImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const filterTransactionsByPeriod = (txs: Transaction[], period: ExportPeriod): Transaction[] => {
    const now = new Date();
    return txs.filter(tx => {
      const txDate = new Date(tx.date);
      switch (period) {
        case 'daily':
          return txDate.getDate() === now.getDate() && 
                 txDate.getMonth() === now.getMonth() && 
                 txDate.getFullYear() === now.getFullYear();
        case 'weekly': {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          return txDate >= sevenDaysAgo && txDate <= now;
        }
        case 'monthly':
          return txDate.getMonth() === now.getMonth() && 
                 txDate.getFullYear() === now.getFullYear();
        case 'yearly':
          return txDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  };

  const handleExport = (type: 'excel' | 'pdf' | 'docx') => {
    const filteredData = filterTransactionsByPeriod(allTransactions, exportPeriod);

    if (filteredData.length === 0) {
      addToast('Tidak ada data pada periode ini', 'info');
      return;
    }
    
    let periodLabel = '';
    const now = new Date();
    if (exportPeriod === 'daily') periodLabel = `Harian (${now.toLocaleDateString('id-ID')})`;
    else if (exportPeriod === 'weekly') periodLabel = 'Mingguan (7 Hari Terakhir)';
    else if (exportPeriod === 'monthly') periodLabel = `Bulanan (${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`;
    else if (exportPeriod === 'yearly') periodLabel = `Tahunan (${now.getFullYear()})`;

    try {
      if (type === 'excel') exportService.toExcel(filteredData, user, periodLabel);
      else if (type === 'pdf') exportService.toPDF(filteredData, user, periodLabel);
      else if (type === 'docx') exportService.toDocx(filteredData, user, periodLabel);
      addToast('Laporan berhasil diunduh', 'success');
      setShowExportModal(false);
    } catch (e) {
      console.error(e);
      addToast('Gagal mengunduh laporan', 'error');
    }
  };

  const handleConnectGoogle = async () => {
    if (!googleSheetService.isConfigured) {
      addToast("System Error: Google Client ID is missing.", "error");
      return;
    }

    setIsGoogleLoading(true);
    try {
      const token = await googleSheetService.signIn();
      const userInfo = await googleSheetService.getUserInfo(token);
      
      updateUser({ 
        googleEmail: userInfo.email,
        googlePhotoUrl: userInfo.picture
      });
      addToast("Signed in successfully!", 'success');

      if (!user.googleSheetId) {
        const sheets = await googleSheetService.searchSpreadsheets("EZFin");
        setFoundSheets(sheets || []);
        setShowSheetModal(true);
      }
    } catch (error) {
      console.error(error);
      addToast("Failed to connect to Google.", "error");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleChangeSheet = async () => {
     setIsGoogleLoading(true);
     try {
        const sheets = await googleSheetService.searchSpreadsheets("EZFin");
        setFoundSheets(sheets || []);
        setShowSheetModal(true);
     } catch (e: any) {
       if (e.message === 'UNAUTHENTICATED') {
         onGoogleSessionError();
       } else {
         addToast("Failed to fetch sheets", "error");
       }
     } finally {
       setIsGoogleLoading(false);
     }
  };

  const handleSearchFolder = async (q: string) => {
    setFolderQuery(q);
    if (q.length > 2) {
      try {
         const folders = await googleSheetService.searchFolders(q);
         setFoundFolders(folders || []);
      } catch (e: any) {
         if (e.message === 'UNAUTHENTICATED') {
            onGoogleSessionError();
         }
      }
    } else {
      setFoundFolders([]);
    }
  };

  const handleCreateSheet = async () => {
    if (!newSheetNameSuffix.trim()) return;
    setIsGoogleLoading(true);
    const fullName = `EZFin Tracker - ${newSheetNameSuffix.trim()}`;
    try {
      const sheet = await googleSheetService.createSpreadsheet(
        fullName, 
        selectedFolder?.id
      );
      await onSyncSettings(sheet.id);
      updateUser({ googleSheetId: sheet.id, googleSheetName: sheet.name });
      setShowSheetModal(false);
      setNewSheetNameSuffix('');
      addToast("New Spreadsheet Created!", "success");
    } catch (e: any) {
      if (e.message === 'UNAUTHENTICATED') {
         onGoogleSessionError();
      } else {
         addToast("Failed to create sheet", "error");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSelectSheet = async (sheet: {id: string, name: string}) => {
    setIsGoogleLoading(true);
    try {
        await onSyncSettings(sheet.id);
        updateUser({ googleSheetId: sheet.id, googleSheetName: sheet.name });
        setShowSheetModal(false);
        addToast("Spreadsheet Linked!", "success");
    } catch(e: any) {
        if (e.message === 'UNAUTHENTICATED') {
           onGoogleSessionError();
        } else {
           addToast("Failed to link spreadsheet", "error");
        }
    } finally {
        setIsGoogleLoading(false);
    }
  };

  const handleSyncFromCloud = async () => {
    if (!user.googleSheetId) return;
    setIsGoogleLoading(true);
    try {
      const txs = await googleSheetService.fetchTransactions(user.googleSheetId);
      onImportTransactions(txs);
      await onSyncSettings(user.googleSheetId);
    } catch (e: any) {
      console.error(e);
      if (e.message === 'UNAUTHENTICATED') {
         onGoogleSessionError();
      } else {
         addToast("Failed to import data.", "error");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = () => {
    googleSheetService.signOut();
    updateUser({ 
      googleSheetId: undefined, 
      googleSheetName: undefined,
      googleEmail: undefined,
      googlePhotoUrl: undefined 
    });
    addToast("Google Account Disconnected", "info");
  };
  
  const handleSaveAIConfig = () => {
    saveAIConfig(aiConfig);
    setShowAIModal(false);
    addToast("AI Configuration Saved", "success");
  };

  return (
    <div className="pt-safe min-h-screen page-transition pb-28 md:pb-10">
      
      <div className="px-6 py-6 pb-2">
        <h1 className="text-2xl font-extrabold text-black dark:text-white tracking-tight">{t('set.title')}</h1>
      </div>

      <div className="p-4 space-y-3 max-w-4xl mx-auto">
        
        {/* NEW GRID LAYOUT - COMPACT PRO STYLE */}
        <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Export Button */}
            <button 
                onClick={() => setShowExportModal(true)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 ios-touch-target aspect-[16/10] relative overflow-hidden group border border-transparent"
            >
                <div className="absolute top-0 left-0 w-full h-full bg-white/0 group-hover:bg-white/10 transition-colors"></div>
                <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-1.5 border border-white/10 group-active:scale-95 transition-transform">
                    <Download size={16} />
                </div>
                <span className="font-bold text-xs leading-none">{t('set.export')}</span>
                <span className="text-[9px] opacity-80 font-medium mt-0.5">PDF / Excel</span>
            </button>

            {/* Google Button - Reddish */}
            <button 
                onClick={() => setShowGoogleModal(true)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/20 ios-touch-target aspect-[16/10] relative overflow-hidden group border border-transparent"
            >
                <div className="absolute top-0 left-0 w-full h-full bg-white/0 group-hover:bg-white/10 transition-colors"></div>
                <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-1.5 border border-white/10 group-active:scale-95 transition-transform">
                    {user.googleEmail ? <Cloud size={16} /> : <LogOut size={16} className="rotate-180" />}
                </div>
                <span className="font-bold text-xs leading-none">{t('set.google')}</span>
                <span className="text-[9px] opacity-80 font-medium mt-0.5">{user.googleEmail ? 'Connected' : 'Sync Data'}</span>
            </button>
            
            {/* Preferences */}
            <button 
                onClick={() => setShowPreferencesModal(true)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 shadow-sm ios-touch-target aspect-[16/10] group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="w-8 h-8 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-1.5 text-gray-600 dark:text-gray-300 group-active:scale-95 transition-transform">
                    <Sliders size={16} />
                </div>
                <span className="font-bold text-xs text-gray-900 dark:text-white leading-none">{t('set.pref')}</span>
                <span className="text-[9px] text-gray-400 font-medium mt-0.5">App Theme</span>
            </button>

            {/* Categories */}
            <button 
                onClick={() => setShowCategoriesModal(true)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 shadow-sm ios-touch-target aspect-[16/10] group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
                 <div className="w-8 h-8 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-1.5 text-gray-600 dark:text-gray-300 group-active:scale-95 transition-transform">
                    <Tag size={16} />
                </div>
                <span className="font-bold text-xs text-gray-900 dark:text-white leading-none">{t('set.cats')}</span>
                <span className="text-[9px] text-gray-400 font-medium mt-0.5">Edit Items</span>
            </button>
            
            {/* AI Configuration */}
            <button 
                onClick={() => setShowAIModal(true)}
                className="col-span-2 flex flex-row items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 shadow-sm ios-touch-target group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 group-active:scale-95 transition-transform">
                        <Cpu size={16} />
                    </div>
                    <div className="text-left">
                        <span className="font-bold text-xs text-gray-900 dark:text-white block leading-none">Konfigurasi AI</span>
                        <span className="text-[9px] text-gray-400 font-medium mt-0.5">Atur Provider (OpenAI, Groq, dll)</span>
                    </div>
                 </div>
                 <ArrowRight size={14} className="text-gray-300 dark:text-gray-600" />
            </button>
        </div>

        {/* SECURITY */}
        <AccordionItem 
            title={t('set.sec')} 
            icon={Shield} 
            subtext={t('set.pin')}
            isOpen={openSection === 'security'}
            onToggle={() => toggleSection('security')}
        >
             <div className="flex flex-col items-center py-2 space-y-4">
                <div className="w-full">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-primary mb-2">
                      <Lock size={18} />
                    </div>
                    <h3 className="font-bold text-xs text-gray-900 dark:text-white mb-3 text-center">{t('set.pin')}</h3>
                    <input 
                      value={newPin} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length <= 6) setNewPin(val);
                      }}
                      type="password" 
                      inputMode="numeric"
                      placeholder="New 6-digit PIN"
                      className="w-full text-center text-base tracking-[0.5em] font-bold bg-gray-50 dark:bg-black/30 rounded-xl py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-primary border border-gray-100 dark:border-white/10"
                    />
                    <button 
                      onClick={handleSavePinClick} 
                      disabled={newPin.length !== 6} 
                      className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl disabled:opacity-50 shadow-lg shadow-blue-500/30 ios-touch-target hover:bg-blue-700 transition-colors text-xs"
                    >
                      {t('set.updatePin')}
                    </button>
                  </div>
                </div>

                <div className="w-full pt-4 border-t border-gray-100 dark:border-white/5">
                   <button 
                     onClick={() => { setResetPinInput(''); setIsResetConfirmOpen(true); }}
                     className="w-full bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ios-touch-target text-xs border border-red-100 dark:border-red-900/30"
                   >
                     <AlertTriangle size={14} />
                     Reset Data Transaksi
                   </button>
                </div>
             </div>
        </AccordionItem>

      </div>

      {/* MODALS */}
      
      {/* 1. Google Modal */}
      <SettingsModal title={t('set.google')} isOpen={showGoogleModal} onClose={() => setShowGoogleModal(false)}>
          {!user.googleEmail ? (
            <div className="flex flex-col items-center text-center space-y-4 py-2">
              <div className="w-12 h-12 bg-blue-50 dark:bg-white/5 rounded-full flex items-center justify-center text-primary mb-1">
                  <Cloud size={24} />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
                {t('set.backup.desc')}
              </p>
              <button 
                onClick={handleConnectGoogle}
                disabled={isGoogleLoading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 ios-touch-target flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale hover:bg-blue-700 transition-colors text-xs"
              >
                {isGoogleLoading ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                {t('set.signin')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gray-50 dark:bg-black/20 p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <img src={user.googlePhotoUrl || user.avatarUrl} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                    <div className="overflow-hidden text-left">
                      <p className="font-bold text-gray-900 dark:text-white text-xs truncate max-w-[150px]">{user.googleEmail}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                          <Check size={10} className="text-green-500" />
                          <p className="text-[9px] text-green-500 font-bold">Linked</p>
                      </div>
                    </div>
                  </div>
                  <button onClick={handleDisconnectGoogle} aria-label="Disconnect Google" className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg hover:bg-red-100 transition-colors ios-touch-target">
                    <LogOut size={14} />
                  </button>
              </div>

              <div>
                <h3 className="text-[9px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-2 ml-1 tracking-wider">{t('set.sheet')}</h3>
                {!user.googleSheetId ? (
                    <button 
                      onClick={handleChangeSheet}
                      className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-3 flex flex-col items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-all gap-1.5 bg-gray-50/50 dark:bg-white/5 ios-touch-target"
                    >
                      <FileSpreadsheet size={20} />
                      <span className="font-bold text-xs">Select or Create Sheet</span>
                    </button>
                ) : (
                    <div className="space-y-2">
                      <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-2.5 flex items-center justify-between border border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center shrink-0">
                              <FileSpreadsheet size={14} />
                            </div>
                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{user.googleSheetName}</span>
                        </div>
                        <button onClick={handleChangeSheet} className="text-[9px] text-primary font-bold px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg ios-touch-target">
                          Change
                        </button>
                      </div>
                      
                      <button 
                        onClick={handleSyncFromCloud}
                        disabled={isGoogleLoading}
                        className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 ios-touch-target text-xs"
                      >
                        {isGoogleLoading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        {t('set.sync')}
                      </button>
                    </div>
                )}
              </div>
            </div>
          )}
      </SettingsModal>

      {/* 2. Preferences Modal */}
      <SettingsModal title={t('set.pref')} isOpen={showPreferencesModal} onClose={() => setShowPreferencesModal(false)}>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Globe size={14} />
                  </div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white">{t('set.lang')}</span>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
                  <button onClick={() => setLanguage('id')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ios-touch-target ${language === 'id' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary' : 'text-gray-500'}`}>ID</button>
                  <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ios-touch-target ${language === 'en' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary' : 'text-gray-500'}`}>EN</button>
                </div>
            </div>
            
            <div className="flex items-center justify-between p-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Moon size={14} fill="currentColor" />
                  </div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white">{t('set.dark')}</span>
                </div>
                <button onClick={toggleTheme} aria-label="Toggle Theme" className={`w-10 h-6 rounded-full transition-colors duration-300 relative ios-touch-target ${darkMode ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${darkMode ? 'translate-x-4' : ''}`}></div>
                </button>
            </div>

            <div className="p-1.5 border-t border-gray-100 dark:border-white/5 pt-3">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                    <Palette size={14} />
                  </div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white">Theme Accent</span>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
                  {APP_THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setThemeColor(theme.id)}
                      aria-label={`Select ${theme.name} theme`}
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ios-touch-target ${themeColor === theme.id ? 'border-gray-900 dark:border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: theme.hex }}
                    >
                      {themeColor === theme.id && <Check size={12} className="text-white" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
            </div>

            {setBackgroundImage && (
                <div className="p-1.5 border-t border-gray-100 dark:border-white/5 pt-3">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <ImageIcon size={14} />
                        </div>
                        <span className="font-bold text-xs text-gray-900 dark:text-white">Background Image</span>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        {backgroundImage && (
                            <div className="relative h-24 w-full rounded-xl overflow-hidden shadow-sm group">
                                <img src={backgroundImage} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setBackgroundImage(null)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-red-600 transition-colors">Hapus</button>
                                </div>
                            </div>
                        )}
                        
                        <label className="flex items-center justify-center w-full border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                            <div className="flex flex-col items-center gap-1">
                                <Upload size={16} className="text-gray-400" />
                                <span className="text-[9px] font-bold text-gray-500">Upload Image (Blurry)</span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                </div>
            )}
          </div>
      </SettingsModal>

      {/* 3. Categories Modal */}
      <SettingsModal title={t('set.cats')} isOpen={showCategoriesModal} onClose={() => setShowCategoriesModal(false)}>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-2">
              <button onClick={() => setCatTypeFilter('expense')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ios-touch-target ${catTypeFilter === 'expense' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>{t('add.expense')}</button>
              <button onClick={() => setCatTypeFilter('income')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ios-touch-target ${catTypeFilter === 'income' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>{t('add.income')}</button>
          </div>
          
          <div className="grid grid-cols-1 gap-1 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
            {filteredCategories.map(cat => (
              <div key={cat.id} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg group transition-colors border border-transparent hover:border-gray-100 dark:hover:border-white/5">
                <div className="flex items-center gap-3">
                    <span className="text-base bg-white dark:bg-black/40 w-7 h-7 flex items-center justify-center rounded-lg shadow-sm border border-gray-100 dark:border-white/10">{cat.icon}</span>
                    <span className="font-bold text-xs text-gray-700 dark:text-gray-200">{cat.name}</span>
                </div>
                <button onClick={() => onDeleteCategory(cat.id)} aria-label="Delete category" className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ios-touch-target"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            {/* Visual Emoji Picker Button */}
            <button 
              onClick={() => setShowEmojiPicker(true)}
              className="w-9 h-9 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-white/10 flex items-center justify-center text-base hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ios-touch-target"
            >
              {newCatIcon}
            </button>
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New Category..." className="flex-1 px-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary font-medium dark:text-white border border-gray-100 dark:border-white/10" />
            <button onClick={handleAddCategoryClick} aria-label="Add category" className="w-9 h-9 bg-black dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center ios-touch-target shadow-md active:scale-95 transition-transform"><Plus size={16}/></button>
          </div>
      </SettingsModal>
      
      {/* 4. AI Configuration Modal */}
      <SettingsModal title="Konfigurasi AI" isOpen={showAIModal} onClose={() => setShowAIModal(false)}>
         <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-100 dark:border-purple-500/20">
               <p className="text-[10px] text-purple-700 dark:text-purple-300 leading-relaxed font-medium">
                  Anda dapat menggunakan penyedia AI apa pun yang kompatibel dengan format OpenAI (seperti Groq, DeepSeek, OpenRouter, atau LocalAI).
               </p>
            </div>

            <div>
               <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 block flex items-center gap-1">
                  <Server size={12}/> Base URL
               </label>
               <input 
                  value={aiConfig.baseUrl} 
                  onChange={e => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-gray-50 dark:bg-black/20 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-gray-100 dark:border-white/10"
               />
               <p className="text-[9px] text-gray-400 mt-1 ml-1">
                  Contoh: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">https://api.groq.com/openai/v1</code>
               </p>
            </div>

            <div>
               <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 block flex items-center gap-1">
                  <Key size={12}/> API Key
               </label>
               <input 
                  value={aiConfig.apiKey} 
                  onChange={e => setAiConfig({...aiConfig, apiKey: e.target.value})}
                  type="password"
                  placeholder="sk-..."
                  className="w-full bg-gray-50 dark:bg-black/20 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-gray-100 dark:border-white/10"
               />
            </div>

            <div>
               <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 block flex items-center gap-1">
                  <Bot size={12}/> Model Name
               </label>
               <input 
                  value={aiConfig.modelName} 
                  onChange={e => setAiConfig({...aiConfig, modelName: e.target.value})}
                  placeholder="gpt-4o"
                  className="w-full bg-gray-50 dark:bg-black/20 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-gray-100 dark:border-white/10"
               />
            </div>

            <button 
               onClick={handleSaveAIConfig}
               className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 ios-touch-target hover:bg-blue-700 transition-colors text-xs mt-2"
            >
               Simpan Konfigurasi
            </button>
         </div>
      </SettingsModal>


      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 w-full animate-ios-fade-in">
           <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-xs p-6 rounded-[2rem] shadow-2xl animate-shake text-center page-slide-up">
              <h2 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Verify Old PIN</h2>
              <p className="text-xs text-gray-500 mb-6">Please enter your current PIN to confirm.</p>
              <input 
                autoFocus
                value={oldPinInput}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 6) setOldPinInput(val);
                }}
                type="password" 
                inputMode="numeric"
                className="w-full text-center text-xl tracking-[0.5em] bg-gray-100 dark:bg-gray-800 rounded-xl py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-300 ios-touch-target">{t('common.cancel')}</button>
                <button onClick={verifyAndSavePin} disabled={oldPinInput.length !== 6} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs disabled:opacity-50 ios-touch-target">{t('common.confirm')}</button>
              </div>
           </div>
        </div>
      )}

      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 w-full animate-ios-fade-in">
           <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-xs p-6 rounded-[2rem] shadow-2xl animate-shake text-center page-slide-up border border-red-100 dark:border-red-900/30">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={24} />
              </div>
              <h2 className="font-bold text-lg mb-2 text-red-600 dark:text-red-500">Hapus Semua Data?</h2>
              <p className="text-xs text-gray-500 mb-6">
                Masukkan PIN Anda untuk konfirmasi penghapusan seluruh data transaksi. Tindakan ini tidak dapat dibatalkan.
              </p>
              <input 
                autoFocus
                value={resetPinInput}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 6) setResetPinInput(val);
                }}
                type="password" 
                inputMode="numeric"
                placeholder="Enter PIN"
                className="w-full text-center text-xl tracking-[0.5em] bg-red-50 dark:bg-red-900/10 rounded-xl py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-red-500 border border-red-100 dark:border-red-900/20"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsResetConfirmOpen(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-300 ios-touch-target">{t('common.cancel')}</button>
                <button onClick={handleResetData} disabled={resetPinInput.length !== 6} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-xs disabled:opacity-50 hover:bg-red-600 transition-colors ios-touch-target">RESET</button>
              </div>
           </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-ios-fade-in">
          <div 
             className="absolute inset-0" 
             onClick={() => setShowExportModal(false)}
          ></div>
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-sm rounded-[2rem] p-6 shadow-2xl page-slide-up relative z-10">
            <h2 className="text-base font-bold text-center mb-1 dark:text-white">{t('set.export')}</h2>
            <p className="text-center text-xs text-gray-400 mb-5">Pilih periode laporan</p>

            <div className="grid grid-cols-2 gap-2 mb-5">
               {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(period => (
                 <button
                   key={period}
                   onClick={() => setExportPeriod(period)}
                   className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all border-2 ios-touch-target ${
                     exportPeriod === period 
                       ? 'border-primary bg-blue-50 dark:bg-blue-900/30 text-primary' 
                       : 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-500'
                   }`}
                 >
                   {period === 'daily' ? 'Hari Ini' : 
                    period === 'weekly' ? 'Minggu Ini' : 
                    period === 'monthly' ? 'Bulan Ini' : 'Tahun Ini'}
                 </button>
               ))}
            </div>

            <div className="space-y-2">
              <button onClick={() => handleExport('excel')} className="w-full p-2.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl flex items-center gap-3 font-bold hover:bg-green-100 transition-colors ios-touch-target text-xs">
                <FileSpreadsheet size={16} /> Excel (.xlsx)
              </button>
              <button onClick={() => handleExport('pdf')} className="w-full p-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-3 font-bold hover:bg-red-100 transition-colors ios-touch-target text-xs">
                <FileText size={16} /> PDF (.pdf)
              </button>
              <button onClick={() => handleExport('docx')} className="w-full p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl flex items-center gap-3 font-bold hover:bg-blue-100 transition-colors ios-touch-target text-xs">
                <FileText size={16} /> Word (.doc)
              </button>
            </div>
            <button onClick={() => setShowExportModal(false)} className="mt-5 w-full py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-400 ios-touch-target">
               {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Sheet Selection Modal */}
      {showSheetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-ios-fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-[2rem] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] page-slide-up">
            <h2 className="text-base font-bold text-center mb-1 dark:text-white">Setup Google Sheets</h2>
            <p className="text-center text-xs text-gray-500 mb-5">Choose where to save your data</p>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-5">
              
              <div className="space-y-3">
                 <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Create New</h3>
                 
                 <div className="relative">
                   <div className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 p-2 rounded-xl border border-gray-100 dark:border-gray-800">
                      <Folder size={16} className="text-gray-400 ml-1" />
                      <input 
                        className="w-full bg-transparent text-xs p-1 focus:outline-none dark:text-white"
                        placeholder={t('set.searchFolder')}
                        value={folderQuery}
                        onChange={(e) => handleSearchFolder(e.target.value)}
                      />
                      {selectedFolder && (
                        <div className="absolute right-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                           {selectedFolder.name} 
                           <button onClick={() => {setSelectedFolder(null); setFolderQuery('');}} aria-label="Clear folder"><Trash2 size={10}/></button>
                        </div>
                      )}
                   </div>
                   {foundFolders.length > 0 && !selectedFolder && (
                     <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 shadow-xl rounded-xl mt-1 z-10 max-h-32 overflow-y-auto border border-gray-100 dark:border-gray-700">
                        {foundFolders.map(f => (
                          <button 
                            key={f.id} 
                            onClick={() => {setSelectedFolder(f); setFoundFolders([]); setFolderQuery('');}}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 dark:text-white ios-touch-target"
                          >
                            <Folder size={12} /> {f.name}
                          </button>
                        ))}
                     </div>
                   )}
                 </div>

                 <div>
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 block">Filename</label>
                    <div className="flex items-center bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="bg-gray-100 dark:bg-white/5 px-3 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 select-none whitespace-nowrap">
                          EZFin Tracker -
                        </div>
                        <input 
                          value={newSheetNameSuffix}
                          onChange={(e) => setNewSheetNameSuffix(e.target.value)}
                          placeholder="Nama (e.g. Pribadi)"
                          className="flex-1 bg-transparent px-3 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none placeholder-gray-400 min-w-0"
                        />
                    </div>
                 </div>

                 <button 
                  onClick={handleCreateSheet}
                  disabled={isGoogleLoading || !newSheetNameSuffix.trim()}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 ios-touch-target transition-transform flex items-center justify-center gap-2 text-xs disabled:opacity-50 disabled:grayscale"
                >
                  {isGoogleLoading ? <Loader2 className="animate-spin" /> : <Plus size={16} />}
                  Create File {selectedFolder ? `in "${selectedFolder.name}"` : ''}
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 dark:text-gray-400 text-[10px] font-bold">OR SELECT EXISTING</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
              </div>

              <div className="space-y-2">
                {foundSheets.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-4">No matching sheets found.</p>
                ) : (
                  foundSheets.map(sheet => (
                    <button 
                      key={sheet.id}
                      onClick={() => handleSelectSheet(sheet)}
                      className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-3 ios-touch-target"
                    >
                      <FileSpreadsheet className="text-green-600" size={18} />
                      <span className="font-semibold text-xs truncate dark:text-white">{sheet.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            
            <button onClick={() => setShowSheetModal(false)} className="mt-4 text-gray-500 dark:text-gray-400 text-xs font-medium hover:text-gray-700 ios-touch-target">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Emoji Picker Bottom Sheet Modal */}
      {showEmojiPicker && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
           <div 
             className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
             onClick={() => setShowEmojiPicker(false)}
           ></div>

           <div className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-ios-slide-up flex flex-col max-h-[75vh] m-0 sm:m-4">
              {/* Drag Handle for Mobile */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden" onClick={() => setShowEmojiPicker(false)}>
                 <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
              </div>
              
              <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 dark:border-white/5">
                 <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Smile size={18} className="text-yellow-500" />
                    Pilih Ikon
                 </h2>
                 <button onClick={() => setShowEmojiPicker(false)} aria-label="Tutup" className="bg-gray-100 dark:bg-white/10 p-2 rounded-full ios-touch-target hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
                    <X size={16} className="text-gray-500 dark:text-gray-300" />
                 </button>
              </div>

              <div className="overflow-y-auto p-4 pb-safe">
                 <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
                    {EMOJI_LIST.map((emoji, idx) => (
                       <button
                         key={idx}
                         onClick={() => {
                            setNewCatIcon(emoji);
                            setShowEmojiPicker(false);
                         }}
                         className="w-full aspect-square flex items-center justify-center text-xl bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/20 transition-all active:scale-95 ios-touch-target"
                       >
                          {emoji}
                       </button>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
