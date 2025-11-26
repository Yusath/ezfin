import React, { useState, useEffect } from 'react';
import { UserProfile, Category, Transaction } from '../types';
import { Moon, Shield, Trash2, Plus, Cloud, FileSpreadsheet, LogOut, Loader2, ArrowRight, Download, Globe, FileText, Folder, ChevronDown, Sliders, Tag, Lock, Check, AlertTriangle } from 'lucide-react';
import { googleSheetService } from '../services/googleSheetService';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/db';
import { exportService } from '../services/exportService';
import { hashPin } from '../utils/security';

interface SettingsProps {
  user: UserProfile;
  categories: Category[];
  darkMode: boolean;
  toggleTheme: () => void;
  onAddCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  updateUser: (user: Partial<UserProfile>) => void;
  onImportTransactions: (txs: Transaction[]) => void;
  onSyncSettings: (sheetId: string) => Promise<boolean>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type ExportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type SettingsSection = 'google' | 'preferences' | 'categories' | 'security' | null;

// --- EXTRACTED COMPONENT TO PREVENT RE-RENDERS ---
const AccordionItem = ({ title, icon: Icon, subtext, isOpen, onToggle, children }: any) => {
  return (
    <div className={`bg-white dark:bg-[#1C1C1E] rounded-[1.25rem] overflow-hidden transition-all duration-300 border border-gray-100 dark:border-white/5 ${isOpen ? 'shadow-lg ring-1 ring-black/5 dark:ring-white/10' : 'shadow-sm'}`}>
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 ios-touch-target"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl transition-colors duration-300 ${isOpen ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
            <Icon size={18} strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white tracking-tight">{title}</h3>
            {!isOpen && subtext && <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{subtext}</p>}
          </div>
        </div>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-gray-100 dark:bg-white/10 rotate-180 text-primary' : 'text-gray-300 dark:text-gray-600'}`}>
           <ChevronDown size={16} strokeWidth={3} />
        </div>
      </button>
      
      {/* Animated Height Container */}
      {isOpen && (
        <div className="px-4 pb-5 pt-0 animate-accordion-down origin-top">
          <div className="h-px w-full bg-gray-100 dark:bg-white/5 mb-5"></div>
          {children}
        </div>
      )}
    </div>
  );
};

const Settings: React.FC<SettingsProps> = ({ 
  user, categories, darkMode, toggleTheme, onAddCategory, onDeleteCategory, updateUser, onImportTransactions, onSyncSettings, addToast
}) => {
  const { t, language, setLanguage } = useLanguage();
  
  // Accordion State
  const [openSection, setOpenSection] = useState<SettingsSection>(null);

  const [catTypeFilter, setCatTypeFilter] = useState<'expense' | 'income'>('expense');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [newPin, setNewPin] = useState('');
  const [oldPinInput, setOldPinInput] = useState(''); 
  const [resetPinInput, setResetPinInput] = useState(''); // New state for reset confirmation

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false); // New modal state
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  
  // Modal States
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('monthly');
  
  // Google State
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [foundSheets, setFoundSheets] = useState<Array<{id: string, name: string}>>([]);
  
  // Folder Selection State
  const [folderQuery, setFolderQuery] = useState('');
  const [foundFolders, setFoundFolders] = useState<Array<{id: string, name: string}>>([]);
  const [selectedFolder, setSelectedFolder] = useState<{id: string, name: string} | null>(null);
  const [newSheetNameSuffix, setNewSheetNameSuffix] = useState(''); // Custom filename suffix

  useEffect(() => {
    // Load all transactions for Export
    const loadTx = async () => {
      const tx = await dbService.getAllTransactions();
      setAllTransactions(tx);
    };
    loadTx();
  }, []);

  // Filter Categories
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
    // Security Fix: Hash input to compare with stored hash
    const hashedOld = await hashPin(oldPinInput);
    if (hashedOld !== user.pin && oldPinInput !== user.pin) { // Check hash OR fallback to plain text if migration failed
      addToast('Wrong Old PIN', 'error');
      return;
    }
    
    // Security Fix: Hash new PIN before saving
    const hashedNew = await hashPin(newPin);
    updateUser({ pin: hashedNew });
    setNewPin('');
    setIsConfirmOpen(false);
    addToast('PIN Updated', 'success');
  };

  const handleResetData = async () => {
     // Security Fix: Hash input to compare
     const hashedInput = await hashPin(resetPinInput);
     
     if (hashedInput !== user.pin && resetPinInput !== user.pin) {
        addToast('PIN Salah!', 'error');
        return;
     }

     try {
        // 1. Clear Local DB
        await dbService.clearAllTransactions();
        
        // 2. Clear Google Sheet if connected
        if (user.googleSheetId) {
             addToast('Clearing Cloud Data...', 'info');
             await googleSheetService.clearAllData(user.googleSheetId);
        }

        // 3. Refresh State (Reload page is easiest to reset all memory states)
        addToast('Semua data berhasil direset.', 'success');
        setTimeout(() => {
           window.location.reload();
        }, 1500);

     } catch (e) {
        console.error(e);
        addToast('Gagal mereset data.', 'error');
     }
  };

  // --- EXPORT ---
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
    
    // Create a label for the period
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

  // --- GOOGLE ---
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
     } catch (e) {
       addToast("Failed to fetch sheets", "error");
     } finally {
       setIsGoogleLoading(false);
     }
  };

  const handleSearchFolder = async (q: string) => {
    setFolderQuery(q);
    if (q.length > 2) {
      const folders = await googleSheetService.searchFolders(q);
      setFoundFolders(folders || []);
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
      // Immediately save current settings to the new sheet
      await onSyncSettings(sheet.id);
      
      updateUser({ googleSheetId: sheet.id, googleSheetName: sheet.name });
      setShowSheetModal(false);
      setNewSheetNameSuffix(''); // Reset
      addToast("New Spreadsheet Created!", "success");
    } catch (e) {
      addToast("Failed to create sheet", "error");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSelectSheet = async (sheet: {id: string, name: string}) => {
    setIsGoogleLoading(true);
    try {
        // First try to fetch/sync settings from the sheet
        await onSyncSettings(sheet.id);
        
        // Then update the user profile with the sheet ID
        updateUser({ googleSheetId: sheet.id, googleSheetName: sheet.name });
        
        setShowSheetModal(false);
        addToast("Spreadsheet Linked!", "success");
    } catch(e) {
        addToast("Failed to link spreadsheet", "error");
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
      
      // Also sync settings
      await onSyncSettings(user.googleSheetId);
    } catch (e) {
      console.error(e);
      addToast("Failed to import data. Ensure you are signed in.", "error");
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

  return (
    <div className="pt-safe min-h-screen bg-[#F2F2F7] dark:bg-black page-transition pb-28 md:pb-10">
      
      {/* iOS Large Title */}
      <div className="px-6 py-6 pb-2">
        <h1 className="text-2xl font-extrabold text-black dark:text-white tracking-tight">{t('set.title')}</h1>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        
        {/* EXPORT (Hero Action) */}
        <button 
           onClick={() => setShowExportModal(true)}
           className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[1.5rem] p-5 shadow-xl shadow-emerald-500/20 flex items-center justify-between ios-touch-target group"
        >
           <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/10 group-active:scale-95 transition-transform">
                 <Download size={22} />
              </div>
              <div className="text-left">
                 <p className="font-bold text-lg tracking-tight">{t('set.export')}</p>
                 <p className="text-xs text-emerald-100 font-medium opacity-90">{t('set.export.desc')}</p>
              </div>
           </div>
           <div className="bg-white/10 p-2 rounded-full">
             <ArrowRight size={18} />
           </div>
        </button>

        {/* SETTINGS GROUP - Dropdowns */}
        <div className="space-y-3">
          
          {/* 1. GOOGLE ACCOUNT */}
          <AccordionItem 
            title={t('set.google')} 
            icon={Cloud} 
            subtext={user.googleEmail ? 'Connected' : t('set.backup.desc')}
            isOpen={openSection === 'google'}
            onToggle={() => toggleSection('google')}
          >
              {!user.googleEmail ? (
                <div className="flex flex-col items-center text-center space-y-4 py-2">
                  <div className="w-14 h-14 bg-blue-50 dark:bg-white/5 rounded-full flex items-center justify-center text-primary mb-1">
                     <Cloud size={28} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
                    {t('set.backup.desc')}
                  </p>
                  <button 
                    onClick={handleConnectGoogle}
                    disabled={isGoogleLoading}
                    className="w-full bg-primary text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-500/30 ios-touch-target flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale hover:bg-blue-600 transition-colors text-sm"
                  >
                    {isGoogleLoading ? <Loader2 className="animate-spin" /> : <ArrowRight size={18} />}
                    {t('set.signin')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-50 dark:bg-black/20 p-3 rounded-2xl border border-gray-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <img src={user.googlePhotoUrl || user.avatarUrl} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                        <div className="overflow-hidden text-left">
                          <p className="font-bold text-gray-900 dark:text-white text-xs truncate max-w-[150px]">{user.googleEmail}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                             <Check size={10} className="text-green-500" />
                             <p className="text-[10px] text-green-500 font-bold">Linked</p>
                          </div>
                        </div>
                      </div>
                      <button onClick={handleDisconnectGoogle} aria-label="Disconnect Google" className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl hover:bg-red-100 transition-colors ios-touch-target">
                        <LogOut size={16} />
                      </button>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1 tracking-wider">{t('set.sheet')}</h4>
                    {!user.googleSheetId ? (
                        <button 
                          onClick={handleChangeSheet}
                          className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all gap-1.5 bg-gray-50/50 dark:bg-white/5 ios-touch-target"
                        >
                          <FileSpreadsheet size={24} />
                          <span className="font-bold text-xs">Select or Create Sheet</span>
                        </button>
                    ) : (
                        <div className="space-y-2">
                          <div className="bg-gray-50 dark:bg-black/20 rounded-2xl p-3 flex items-center justify-between border border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center shrink-0">
                                  <FileSpreadsheet size={16} />
                                </div>
                                <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{user.googleSheetName}</span>
                            </div>
                            <button onClick={handleChangeSheet} className="text-[10px] text-primary font-bold px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg ios-touch-target">
                              Change
                            </button>
                          </div>
                          
                          <button 
                            onClick={handleSyncFromCloud}
                            disabled={isGoogleLoading}
                            className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 ios-touch-target text-sm"
                          >
                            {isGoogleLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                            {t('set.sync')}
                          </button>
                        </div>
                    )}
                  </div>
                </div>
              )}
          </AccordionItem>

          {/* 2. PREFERENCES */}
          <AccordionItem 
            title={t('set.pref')} 
            icon={Sliders} 
            subtext={`${language.toUpperCase()}, ${darkMode ? 'Dark' : 'Light'}`}
            isOpen={openSection === 'preferences'}
            onToggle={() => toggleSection('preferences')}
          >
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        <Globe size={16} />
                      </div>
                      <span className="font-bold text-xs text-gray-900 dark:text-white">{t('set.lang')}</span>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                      <button onClick={() => setLanguage('id')} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ios-touch-target ${language === 'id' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary' : 'text-gray-400'}`}>ID</button>
                      <button onClick={() => setLanguage('en')} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ios-touch-target ${language === 'en' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary' : 'text-gray-400'}`}>EN</button>
                    </div>
                </div>
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Moon size={16} fill="currentColor" />
                      </div>
                      <span className="font-bold text-xs text-gray-900 dark:text-white">{t('set.dark')}</span>
                    </div>
                    <button onClick={toggleTheme} aria-label="Toggle Theme" className={`w-12 h-7 rounded-full transition-colors duration-300 relative ios-touch-target ${darkMode ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${darkMode ? 'translate-x-5' : ''}`}></div>
                    </button>
                </div>
              </div>
          </AccordionItem>

          {/* 3. CATEGORIES */}
          <AccordionItem 
            title={t('set.cats')} 
            icon={Tag} 
            subtext={`${filteredCategories.length} Categories`}
            isOpen={openSection === 'categories'}
            onToggle={() => toggleSection('categories')}
          >
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
                  <button onClick={() => setCatTypeFilter('expense')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ios-touch-target ${catTypeFilter === 'expense' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400'}`}>{t('add.expense')}</button>
                  <button onClick={() => setCatTypeFilter('income')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ios-touch-target ${catTypeFilter === 'income' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400'}`}>{t('add.income')}</button>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto no-scrollbar pr-1">
                {filteredCategories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-2.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl group transition-colors border border-transparent hover:border-gray-100 dark:hover:border-white/5">
                    <div className="flex items-center gap-3">
                        <span className="text-lg bg-white dark:bg-black/40 w-8 h-8 flex items-center justify-center rounded-xl shadow-sm border border-gray-100 dark:border-white/10">{cat.icon}</span>
                        <span className="font-bold text-xs text-gray-700 dark:text-gray-200">{cat.name}</span>
                    </div>
                    <button onClick={() => onDeleteCategory(cat.id)} aria-label="Delete category" className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ios-touch-target"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} className="w-10 h-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg border border-gray-100 dark:border-white/10" />
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New Category..." className="flex-1 px-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary font-medium dark:text-white border border-gray-100 dark:border-white/10" />
                <button onClick={handleAddCategoryClick} aria-label="Add category" className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center ios-touch-target shadow-lg"><Plus size={20}/></button>
              </div>
          </AccordionItem>

          {/* 4. SECURITY */}
          <AccordionItem 
            title={t('set.sec')} 
            icon={Shield} 
            subtext={t('set.pin')}
            isOpen={openSection === 'security'}
            onToggle={() => toggleSection('security')}
          >
             <div className="flex flex-col items-center py-2 space-y-6">
                <div className="w-full">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-primary mb-3">
                      <Lock size={20} />
                    </div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3 text-center">{t('set.pin')}</h3>
                    <input 
                      value={newPin} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length <= 6) setNewPin(val);
                      }}
                      type="password" 
                      inputMode="numeric"
                      placeholder="New 6-digit PIN"
                      className="w-full text-center text-lg tracking-[0.5em] font-bold bg-gray-50 dark:bg-black/30 rounded-xl py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-primary border border-gray-100 dark:border-white/10"
                    />
                    <button 
                      onClick={handleSavePinClick} 
                      disabled={newPin.length !== 6} 
                      className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50 shadow-lg shadow-blue-500/30 ios-touch-target hover:bg-blue-600 transition-colors text-xs"
                    >
                      {t('set.updatePin')}
                    </button>
                  </div>
                </div>

                {/* Reset Data Button */}
                <div className="w-full pt-6 border-t border-gray-100 dark:border-white/5">
                   <button 
                     onClick={() => { setResetPinInput(''); setIsResetConfirmOpen(true); }}
                     className="w-full bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ios-touch-target text-xs border border-red-100 dark:border-red-900/30"
                   >
                     <AlertTriangle size={14} />
                     Reset Data Transaksi
                   </button>
                   <p className="text-[10px] text-gray-400 text-center mt-2">
                     Menghapus semua riwayat transaksi dari perangkat dan cloud.
                   </p>
                </div>
             </div>
          </AccordionItem>

        </div>
      </div>

      {/* Confirmation Modal (PIN Change) */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 w-full">
           <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-xs p-6 rounded-[2rem] shadow-2xl animate-shake text-center page-slide-up">
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Verify Old PIN</h3>
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
                className="w-full text-center text-xl tracking-[0.5em] bg-gray-100 dark:bg-gray-800 rounded-xl py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-300 ios-touch-target">{t('common.cancel')}</button>
                <button onClick={verifyAndSavePin} disabled={oldPinInput.length !== 6} className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-xs disabled:opacity-50 ios-touch-target">{t('common.confirm')}</button>
              </div>
           </div>
        </div>
      )}

      {/* Reset Data Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 w-full">
           <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-xs p-6 rounded-[2rem] shadow-2xl animate-shake text-center page-slide-up border border-red-100 dark:border-red-900/30">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-red-600 dark:text-red-500">Hapus Semua Data?</h3>
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
                className="w-full text-center text-xl tracking-[0.5em] bg-red-50 dark:bg-red-900/10 rounded-xl py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-red-500 border border-red-100 dark:border-red-900/20"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsResetConfirmOpen(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-300 ios-touch-target">{t('common.cancel')}</button>
                <button onClick={handleResetData} disabled={resetPinInput.length !== 6} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-xs disabled:opacity-50 hover:bg-red-600 transition-colors ios-touch-target">RESET</button>
              </div>
           </div>
        </div>
      )}

      {/* Export Modal with Period Selector */}
      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-ios-fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-sm rounded-[2rem] p-6 shadow-2xl page-slide-up">
            <h3 className="text-lg font-bold text-center mb-1 dark:text-white">{t('set.export')}</h3>
            <p className="text-center text-xs text-gray-400 mb-5">Pilih periode laporan</p>

            {/* Time Range Selector */}
            <div className="grid grid-cols-2 gap-2 mb-5">
               {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(period => (
                 <button
                   key={period}
                   onClick={() => setExportPeriod(period)}
                   className={`py-2 px-1 rounded-xl text-[10px] font-bold transition-all border-2 ios-touch-target ${
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

            <div className="space-y-2.5">
              <button onClick={() => handleExport('excel')} className="w-full p-3.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl flex items-center gap-3 font-bold hover:bg-green-100 transition-colors ios-touch-target text-sm">
                <FileSpreadsheet size={20} /> Excel (.xlsx)
              </button>
              <button onClick={() => handleExport('pdf')} className="w-full p-3.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-3 font-bold hover:bg-red-100 transition-colors ios-touch-target text-sm">
                <FileText size={20} /> PDF (.pdf)
              </button>
              <button onClick={() => handleExport('docx')} className="w-full p-3.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl flex items-center gap-3 font-bold hover:bg-blue-100 transition-colors ios-touch-target text-sm">
                <FileText size={20} /> Word (.doc)
              </button>
            </div>
            <button onClick={() => setShowExportModal(false)} className="mt-5 w-full py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-400 ios-touch-target">
               {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Google Sheet Selection Modal */}
      {showSheetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-ios-fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-[2rem] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] page-slide-up">
            <h3 className="text-lg font-bold text-center mb-1 dark:text-white">Setup Google Sheets</h3>
            <p className="text-center text-xs text-gray-500 mb-5">Choose where to save your data</p>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-5">
              
              <div className="space-y-4">
                 <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Create New</h4>
                 
                 {/* Folder Selector */}
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

                 {/* Custom Filename Input */}
                 <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1.5 block">Filename</label>
                    <div className="flex items-center bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="bg-gray-100 dark:bg-white/5 px-3 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 select-none whitespace-nowrap">
                          EZFin Tracker -
                        </div>
                        <input 
                          value={newSheetNameSuffix}
                          onChange={(e) => setNewSheetNameSuffix(e.target.value)}
                          placeholder="Nama (e.g. Pribadi)"
                          className="flex-1 bg-transparent px-3 py-3 text-xs font-bold text-gray-900 dark:text-white focus:outline-none placeholder-gray-400 min-w-0"
                        />
                    </div>
                 </div>

                 <button 
                  onClick={handleCreateSheet}
                  disabled={isGoogleLoading || !newSheetNameSuffix.trim()}
                  className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 ios-touch-target transition-transform flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:grayscale"
                >
                  {isGoogleLoading ? <Loader2 className="animate-spin" /> : <Plus size={18} />}
                  Create File {selectedFolder ? `in "${selectedFolder.name}"` : ''}
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-[10px] font-bold">OR SELECT EXISTING</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
              </div>

              <div className="space-y-2">
                {foundSheets.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-4">No matching sheets found.</p>
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
            
            <button onClick={() => setShowSheetModal(false)} className="mt-4 text-gray-400 text-xs font-medium hover:text-gray-600 ios-touch-target">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;