import React, { useState, useEffect } from 'react';
import { UserProfile, Category, Transaction } from '../types';
import { Moon, Shield, Trash2, Plus, Wifi, Cloud, FileSpreadsheet, LogOut, Loader2, ArrowRight, Download, Globe, FileText, Folder, Calendar, Clock } from 'lucide-react';
import { googleSheetService } from '../services/googleSheetService';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/db';
import { exportService } from '../services/exportService';

interface SettingsProps {
  user: UserProfile;
  categories: Category[];
  darkMode: boolean;
  toggleTheme: () => void;
  isOnlineScanEnabled: boolean;
  toggleOnlineScan: () => void;
  onAddCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  updateUser: (user: Partial<UserProfile>) => void;
  onImportTransactions: (txs: Transaction[]) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type ExportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const Settings: React.FC<SettingsProps> = ({ 
  user, categories, darkMode, toggleTheme, isOnlineScanEnabled, toggleOnlineScan, onAddCategory, onDeleteCategory, updateUser, onImportTransactions, addToast
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [catTypeFilter, setCatTypeFilter] = useState<'expense' | 'income'>('expense');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [newPin, setNewPin] = useState('');
  const [oldPinInput, setOldPinInput] = useState(''); 
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
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

  const verifyAndSavePin = () => {
    if (oldPinInput !== user.pin) {
      addToast('Wrong Old PIN', 'error');
      return;
    }
    updateUser({ pin: newPin });
    setNewPin('');
    setIsConfirmOpen(false);
    addToast('PIN Updated', 'success');
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
          // Check if within current week (starting Sunday) or last 7 days. 
          // Using last 7 days for simplicity and utility.
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
    setIsGoogleLoading(true);
    try {
      const sheet = await googleSheetService.createSpreadsheet(
        `EZFin Tracker - ${user.name}`, 
        selectedFolder?.id
      );
      updateUser({ googleSheetId: sheet.id, googleSheetName: sheet.name });
      setShowSheetModal(false);
      addToast("New Spreadsheet Created!", "success");
    } catch (e) {
      addToast("Failed to create sheet", "error");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSelectSheet = (sheet: {id: string, name: string}) => {
    updateUser({ googleSheetId: sheet.id, googleSheetName: sheet.name });
    setShowSheetModal(false);
    addToast("Spreadsheet Linked!", "success");
  };

  const handleSyncFromCloud = async () => {
    if (!user.googleSheetId) return;
    setIsGoogleLoading(true);
    try {
      const txs = await googleSheetService.fetchTransactions(user.googleSheetId);
      onImportTransactions(txs);
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
    <div className="pt-safe min-h-screen bg-[#F2F2F7] dark:bg-black animate-fade-in pb-20">
      
      {/* iOS Large Title */}
      <div className="px-6 py-6 pb-2">
        <h1 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">{t('set.title')}</h1>
      </div>

      <div className="p-4 space-y-6">
        
        {/* GROUP 0: EXPORT - PROMINENT */}
        <button 
           onClick={() => setShowExportModal(true)}
           className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-5 shadow-lg shadow-green-500/20 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
           <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                 <Download size={24} />
              </div>
              <div className="text-left">
                 <p className="font-bold text-lg">{t('set.export')}</p>
                 <p className="text-xs text-green-100">{t('set.export.desc')}</p>
              </div>
           </div>
           <ArrowRight size={20} className="opacity-70" />
        </button>

        {/* GROUP 1: GOOGLE ACCOUNT */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-4">{t('set.google')}</h2>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm p-5">

            {!user.googleEmail ? (
              <div className="flex flex-col items-center text-center space-y-4 py-2">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-primary mb-2">
                  <Cloud size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('set.backup')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mt-1">
                    {t('set.backup.desc')}
                  </p>
                </div>
                <button 
                  onClick={handleConnectGoogle}
                  disabled={isGoogleLoading}
                  className="w-full bg-primary text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                >
                  {isGoogleLoading ? <Loader2 className="animate-spin" /> : <ArrowRight size={20} />}
                  {t('set.signin')}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4">
                   <div className="flex items-center gap-3">
                      <img src={user.googlePhotoUrl || user.avatarUrl} className="w-10 h-10 rounded-full border border-gray-100" />
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{user.googleEmail}</p>
                        <p className="text-xs text-green-500 font-medium">Account Linked</p>
                      </div>
                   </div>
                   <button onClick={handleDisconnectGoogle} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                     <LogOut size={20} />
                   </button>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">{t('set.sheet')}</h4>
                  {!user.googleSheetId ? (
                     <button 
                       onClick={handleChangeSheet}
                       className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors gap-2"
                     >
                        <FileSpreadsheet size={24} />
                        <span className="font-semibold text-sm">Select or Create Sheet</span>
                     </button>
                  ) : (
                     <div className="space-y-3">
                       <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden">
                             <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center shrink-0">
                               <FileSpreadsheet size={16} />
                             </div>
                             <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.googleSheetName}</span>
                          </div>
                          <button onClick={handleChangeSheet} className="text-xs text-primary font-bold px-2 py-1">
                            Change
                          </button>
                       </div>
                       
                       <button 
                          onClick={handleSyncFromCloud}
                          disabled={isGoogleLoading}
                          className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
                       >
                          {isGoogleLoading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                          {t('set.sync')}
                       </button>
                       <p className="text-[10px] text-gray-400 text-center">
                         Use this to restore data if you switch devices.
                       </p>
                     </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GROUP 2: PREFERENCES */}
        <div className="space-y-2">
           <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-4">{t('set.pref')}</h2>
           <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
                     <Globe size={18} />
                   </div>
                   <span className="font-medium text-gray-900 dark:text-white">{t('set.lang')}</span>
                 </div>
                 <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button onClick={() => setLanguage('id')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${language === 'id' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary' : 'text-gray-400'}`}>ID</button>
                    <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary' : 'text-gray-400'}`}>EN</button>
                 </div>
              </div>
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                     <Moon size={18} fill="currentColor" />
                   </div>
                   <span className="font-medium text-gray-900 dark:text-white">{t('set.dark')}</span>
                 </div>
                 <button onClick={toggleTheme} className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${darkMode ? 'bg-green-500' : 'bg-gray-300'}`}>
                   <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${darkMode ? 'translate-x-5' : ''}`}></div>
                 </button>
              </div>
              <div className="flex items-center justify-between p-4">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                     <Wifi size={18} />
                   </div>
                   <div>
                     <span className="block font-medium text-gray-900 dark:text-white">{t('set.online')}</span>
                     <span className="text-xs text-gray-500">{t('set.online.desc')}</span>
                   </div>
                 </div>
                 <button onClick={toggleOnlineScan} className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${isOnlineScanEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                   <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${isOnlineScanEnabled ? 'translate-x-5' : ''}`}></div>
                 </button>
              </div>
           </div>
        </div>

        {/* GROUP 3: CATEGORIES */}
        <div className="space-y-2">
           <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-4">{t('set.cats')}</h2>
           <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm p-4">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4">
                 <button onClick={() => setCatTypeFilter('expense')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${catTypeFilter === 'expense' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-400'}`}>{t('add.expense')}</button>
                 <button onClick={() => setCatTypeFilter('income')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${catTypeFilter === 'income' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-400'}`}>{t('add.income')}</button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
                {filteredCategories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center py-2 px-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                       <span className="text-xl">{cat.icon}</span>
                       <span className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</span>
                    </div>
                    <button onClick={() => onDeleteCategory(cat.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} className="w-10 h-10 text-center bg-gray-100 dark:bg-gray-800 rounded-xl" />
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New Category..." className="flex-1 px-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm" />
                <button onClick={handleAddCategoryClick} className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center"><Plus size={20}/></button>
              </div>
           </div>
        </div>

        {/* GROUP 4: SECURITY */}
        <div className="space-y-2">
           <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-4">{t('set.sec')}</h2>
           <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-500 mb-4">
                <Shield size={24} />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t('set.pin')}</h3>
              <input 
                value={newPin} 
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 6) setNewPin(val);
                }}
                type="password" 
                inputMode="numeric"
                placeholder="Enter 6-digit New PIN"
                className="w-full text-center text-xl tracking-widest bg-gray-100 dark:bg-gray-800 rounded-xl py-3 mb-4"
              />
              <button onClick={handleSavePinClick} disabled={newPin.length !== 6} className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {t('set.updatePin')}
              </button>
           </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 w-full">
           <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-xs p-6 rounded-[2rem] shadow-2xl animate-bounce-small text-center">
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Verify Old PIN</h3>
              <p className="text-sm text-gray-500 mb-6">Please enter your current PIN to confirm.</p>
              <input 
                autoFocus
                value={oldPinInput}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 6) setOldPinInput(val);
                }}
                type="password" 
                inputMode="numeric"
                className="w-full text-center text-2xl tracking-widest bg-gray-100 dark:bg-gray-800 rounded-xl py-3 mb-6"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-gray-600 dark:text-gray-300">{t('common.cancel')}</button>
                <button onClick={verifyAndSavePin} disabled={oldPinInput.length !== 6} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50">{t('common.confirm')}</button>
              </div>
           </div>
        </div>
      )}

      {/* Export Modal with Period Selector */}
      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-center mb-2 dark:text-white">{t('set.export')}</h3>
            <p className="text-center text-sm text-gray-400 mb-6">Pilih periode laporan</p>

            {/* Time Range Selector */}
            <div className="grid grid-cols-2 gap-2 mb-6">
               {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(period => (
                 <button
                   key={period}
                   onClick={() => setExportPeriod(period)}
                   className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border-2 ${
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

            <div className="space-y-3">
              <button onClick={() => handleExport('excel')} className="w-full p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl flex items-center gap-4 font-bold hover:bg-green-100 transition-colors">
                <FileSpreadsheet size={24} /> Excel (.xlsx)
              </button>
              <button onClick={() => handleExport('pdf')} className="w-full p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-4 font-bold hover:bg-red-100 transition-colors">
                <FileText size={24} /> PDF (.pdf)
              </button>
              <button onClick={() => handleExport('docx')} className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl flex items-center gap-4 font-bold hover:bg-blue-100 transition-colors">
                <FileText size={24} /> Word (.doc)
              </button>
            </div>
            <button onClick={() => setShowExportModal(false)} className="mt-6 w-full py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-gray-600 dark:text-gray-400">
               {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Google Sheet Selection Modal */}
      {showSheetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-[2rem] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <h3 className="text-xl font-bold text-center mb-2 dark:text-white">Setup Google Sheets</h3>
            <p className="text-center text-sm text-gray-500 mb-6">Choose where to save your data</p>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
              
              <div className="space-y-3">
                 <h4 className="text-xs font-bold text-gray-400 uppercase">Create New</h4>
                 <div className="relative">
                   <div className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 p-2 rounded-xl border border-gray-100 dark:border-gray-800">
                      <Folder size={18} className="text-gray-400 ml-2" />
                      <input 
                        className="w-full bg-transparent text-sm p-1 focus:outline-none dark:text-white"
                        placeholder={t('set.searchFolder')}
                        value={folderQuery}
                        onChange={(e) => handleSearchFolder(e.target.value)}
                      />
                      {selectedFolder && (
                        <div className="absolute right-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                           {selectedFolder.name} 
                           <button onClick={() => {setSelectedFolder(null); setFolderQuery('');}}><Trash2 size={10}/></button>
                        </div>
                      )}
                   </div>
                   {foundFolders.length > 0 && !selectedFolder && (
                     <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 shadow-xl rounded-xl mt-1 z-10 max-h-32 overflow-y-auto border border-gray-100 dark:border-gray-700">
                        {foundFolders.map(f => (
                          <button 
                            key={f.id} 
                            onClick={() => {setSelectedFolder(f); setFoundFolders([]); setFolderQuery('');}}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 dark:text-white"
                          >
                            <Folder size={14} /> {f.name}
                          </button>
                        ))}
                     </div>
                   )}
                 </div>

                 <button 
                  onClick={handleCreateSheet}
                  disabled={isGoogleLoading}
                  className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  {isGoogleLoading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                  Create {selectedFolder ? `in "${selectedFolder.name}"` : '"EZFin Tracker"'}
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OR SELECT EXISTING</span>
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
                      className="w-full text-left p-4 rounded-xl bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-3"
                    >
                      <FileSpreadsheet className="text-green-600" size={20} />
                      <span className="font-semibold text-sm truncate dark:text-white">{sheet.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            
            <button onClick={() => setShowSheetModal(false)} className="mt-4 text-gray-400 text-sm font-medium hover:text-gray-600">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;