import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Transaction, UserProfile, ToastMessage, Category } from './types';
import { DEFAULT_USER_PROFILE } from './constants';
import { dbService } from './services/db';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import PinScreen from './components/PinScreen';
import { ToastContainer } from './components/Toast';
import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import HistoryPage from './pages/History';
import { googleSheetService } from './services/googleSheetService';
import { LanguageProvider } from './contexts/LanguageContext';

function App() {
  // -- State --
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Default to Dark Mode (true) unless 'light' is explicitly saved
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved !== 'light';
  });
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Data State
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // -- Initialization Effect --
  useEffect(() => {
    const initData = async () => {
      try {
        const { user: loadedUser, categories: loadedCats } = await dbService.initDefaultsIfNeeded(DEFAULT_USER_PROFILE);
        const loadedTxs = await dbService.getAllTransactions();

        setUser(loadedUser);
        setCategories(loadedCats);
        setTransactions(loadedTxs);
        
        // Theme initialization is handled by useState lazy init

        // Init Google Service
        googleSheetService.initClient((success) => {
          if (success) console.log("Google Services Initialized");
        });

      } catch (error) {
        console.error("Failed to load data from DB", error);
        addToast("Gagal memuat database. Silakan refresh.", 'error');
      } finally {
        setIsAppLoading(false);
      }
    };

    initData();
  }, []);

  // -- Automated Cloud Sync Effect on Login --
  useEffect(() => {
    if (isAuthenticated && user.googleSheetId) {
      performFullCloudSync(user.googleSheetId);
    }
  }, [isAuthenticated, user.googleSheetId]);

  // -- Theme Effect --
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // -- Handlers --
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTransaction = async (newTx: Transaction) => {
    try {
      // 1. Save Local
      await dbService.addTransaction(newTx);
      setTransactions((prev) => [newTx, ...prev]);
      
      // 2. Sync to Cloud if Configured
      if (user.googleSheetId) {
        // We attempt to sync without blocking UI
        googleSheetService.appendTransaction(user.googleSheetId, newTx)
          .then(() => addToast('Transaction saved & synced to Drive!', 'success'))
          .catch((e) => {
             console.error("Sync Error", e);
             addToast('Saved locally, but Google Sync failed.', 'info');
          });
      } else {
        addToast('Transaksi berhasil disimpan!', 'success');
      }

    } catch (error) {
      console.error(error);
      addToast('Gagal menyimpan transaksi ke database', 'error');
    }
  };

  const performFullCloudSync = async (sheetId: string) => {
    try {
      addToast('Syncing data from Cloud...', 'info');
      
      // 1. Sync Settings (Security & Preferences: PIN, Categories, Theme)
      // fetch & save logic handled inside
      await handleSyncSettings(sheetId);
      
      // 2. Sync Activity (Transactions) - Bidirectional Fetch & Save
      const cloudTxs = await googleSheetService.fetchTransactions(sheetId);
      
      // a. Identify Local transactions that are NOT in Cloud (Offline entries)
      const cloudTxIds = new Set(cloudTxs.map(t => t.id));
      const localTxsToPush = transactions.filter(t => !cloudTxIds.has(t.id));
      
      // b. Push missing local transactions to Cloud (Save)
      if (localTxsToPush.length > 0) {
         console.log(`Pushing ${localTxsToPush.length} missing transactions to cloud...`);
         await googleSheetService.bulkAppendTransactions(sheetId, localTxsToPush);
      }

      // c. Import missing Cloud transactions to Local (Fetch)
      if (cloudTxs.length > 0) {
         await handleImportTransactions(cloudTxs);
      }

      addToast('Sync Complete! Security, Preferences & Activity updated.', 'success');
    } catch (error) {
      console.error("Auto Sync Failed", error);
      // Don't show error toast for background sync to avoid annoyance if offline
    }
  };

  const handleImportTransactions = async (importedTxs: Transaction[]) => {
    try {
      await dbService.bulkAddTransactions(importedTxs);
      
      // Merge with state, avoiding duplicates by ID
      setTransactions(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newUnique = importedTxs.filter(t => !existingIds.has(t.id));
          if (newUnique.length === 0) return prev;
          
          return [...newUnique, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
      
    } catch (e) {
      console.error(e);
      addToast('Failed to save imported data', 'error');
    }
  };

  const handleSyncSettings = async (sheetId: string, currentThemeState: boolean = darkMode) => {
    try {
        const cloudSettings = await googleSheetService.fetchAppSettings(sheetId);
        if (cloudSettings) {
            let hasChanges = false;
            
            // 1. Sync PIN (Security)
            if (cloudSettings.pin && cloudSettings.pin !== user.pin) {
                await handleUpdateProfile({ pin: cloudSettings.pin });
                hasChanges = true;
            }
            
            // 2. Sync Categories (Preferences)
            if (cloudSettings.categories && cloudSettings.categories.length > 0) {
                 // Overwrite local categories for simplicity, assuming Cloud is truth
                 for (const cat of cloudSettings.categories) {
                     await dbService.saveCategory(cat);
                 }
                 setCategories(cloudSettings.categories);
                 hasChanges = true;
            }

            // 3. Sync Theme (Preferences)
            if (cloudSettings.darkMode !== undefined && cloudSettings.darkMode !== currentThemeState) {
               setDarkMode(cloudSettings.darkMode);
               hasChanges = true;
            }

            if (hasChanges) {
                console.log('Settings updated from Cloud');
            } else {
                console.log('Settings are already up to date');
            }
            return true;
        } else {
            // Cloud is empty, push local settings to initialize (Save)
            await googleSheetService.saveAppSettings(sheetId, user.pin, categories, currentThemeState);
            return false;
        }
    } catch (e) {
        console.error(e);
        addToast('Settings sync failed', 'error');
        return false;
    }
  };

  const handleUpdateProfile = async (updatedUserPart: Partial<UserProfile>) => {
    try {
      const newUser = { ...user, ...updatedUserPart };
      await dbService.saveUser(newUser);
      setUser(newUser);
      
      // Cloud Sync for PIN changes
      if (newUser.googleSheetId && (updatedUserPart.pin || updatedUserPart.name)) {
         googleSheetService.saveAppSettings(newUser.googleSheetId, newUser.pin, categories, darkMode).catch(console.error);
      }
    } catch (error) {
      console.error(error);
      addToast('Gagal memperbarui profil', 'error');
    }
  };

  // Category Handlers
  const handleAddCategory = async (newCat: Category) => {
    try {
      await dbService.saveCategory(newCat);
      const newCats = [...categories, newCat];
      setCategories(newCats);
      addToast('Kategori ditambahkan', 'success');

      // Cloud Sync
      if (user.googleSheetId) {
        googleSheetService.saveAppSettings(user.googleSheetId, user.pin, newCats, darkMode).catch(console.error);
      }
    } catch (e) {
      addToast('Gagal simpan kategori', 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await dbService.deleteCategory(id);
      const newCats = categories.filter(c => c.id !== id);
      setCategories(newCats);
      addToast('Kategori dihapus', 'success');

      // Cloud Sync
      if (user.googleSheetId) {
        googleSheetService.saveAppSettings(user.googleSheetId, user.pin, newCats, darkMode).catch(console.error);
      }
    } catch (e) {
      addToast('Gagal hapus kategori', 'error');
    }
  };
  
  const toggleThemeHandler = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    // Sync preference change
    if (user.googleSheetId) {
      googleSheetService.saveAppSettings(user.googleSheetId, user.pin, categories, newMode).catch(console.error);
    }
  };

  if (isAppLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F2F2F7] dark:bg-black">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wide">EZFin Loading...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PinScreen correctPin={user.pin} onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <LanguageProvider>
      <Router>
        <div className={`flex h-screen w-full bg-[#F2F2F7] dark:bg-black text-gray-900 dark:text-gray-100 transition-colors duration-300 overflow-hidden ${darkMode ? 'dark' : ''}`}>
          
          <ToastContainer toasts={toasts} removeToast={removeToast} />
          
          {/* Desktop Sidebar (Hidden on Mobile) */}
          <div className="hidden md:flex md:flex-col z-20">
            <Sidebar />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            
            {/* Scrollable Page Content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth no-scrollbar">
              <div className="min-h-full pb-24 md:pb-8 md:p-8 max-w-[1600px] mx-auto w-full">
                <Routes>
                  <Route 
                    path="/" 
                    element={
                      <Dashboard 
                        user={user} 
                        transactions={transactions} 
                        categories={categories}
                        onUpdateUser={handleUpdateProfile}
                      />
                    } 
                  />
                  <Route 
                    path="/add" 
                    element={
                      <div className="md:max-w-2xl md:mx-auto">
                        <AddTransaction 
                          categories={categories} 
                          onSave={handleAddTransaction} 
                          addToast={addToast}
                        />
                      </div>
                    } 
                  />
                  <Route 
                    path="/history" 
                    element={
                      <div className="md:max-w-4xl md:mx-auto">
                        <HistoryPage 
                          transactions={transactions} 
                        />
                      </div>
                    } 
                  />
                  <Route 
                    path="/stats" 
                    element={
                      <div className="md:max-w-4xl md:mx-auto">
                        <Stats 
                          transactions={transactions} 
                          user={user}
                        />
                      </div>
                    } 
                  />
                  <Route 
                    path="/settings" 
                    element={
                      <div className="md:max-w-3xl md:mx-auto">
                        <Settings 
                          user={user} 
                          categories={categories}
                          darkMode={darkMode}
                          toggleTheme={toggleThemeHandler}
                          onAddCategory={handleAddCategory}
                          onDeleteCategory={handleDeleteCategory}
                          updateUser={handleUpdateProfile}
                          onImportTransactions={handleImportTransactions}
                          onSyncSettings={(id) => handleSyncSettings(id, darkMode)}
                          addToast={addToast}
                        />
                      </div>
                    } 
                  />
                </Routes>
              </div>
            </main>

            {/* Mobile Navbar (Hidden on Desktop) */}
            <div className="md:hidden">
              <Navbar />
            </div>
          </div>
        </div>
      </Router>
    </LanguageProvider>
  );
}

export default App;