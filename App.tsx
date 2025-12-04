
import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { Transaction, UserProfile, ToastMessage, Category } from './types';
import { DEFAULT_USER_PROFILE, APP_THEMES } from './constants';
import { dbService } from './services/db';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import PinScreen from './components/PinScreen';
import { ToastContainer } from './components/Toast';
import { googleSheetService } from './services/googleSheetService';
import { LanguageProvider } from './contexts/LanguageContext';
import { hashPin } from './utils/security';
import { deriveKeyFromHash, getSecureItem, setSecureItem } from './utils/secureStorage';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AddTransaction = React.lazy(() => import('./pages/AddTransaction'));
const Stats = React.lazy(() => import('./pages/Stats'));
const Settings = React.lazy(() => import('./pages/Settings'));
const HistoryPage = React.lazy(() => import('./pages/History'));

const EditTransactionWrapper = ({ transactions, categories, onSave, addToast }: any) => {
  const { id } = useParams();
  const tx = transactions.find((t: any) => t.id === id);
  if (!tx) return <Navigate to="/" />;
  return <AddTransaction categories={categories} onSave={onSave} addToast={addToast} initialData={tx} />;
};

function App() {
  // Banking App Style Security Logic
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 Minutes

  // -- State --
  const [isAppLoading, setIsAppLoading] = useState(true);
  
  // SESSION SECURITY: Idle PIN Lock Logic
  // Default to Locked on load until verified or timed out
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [isLocked, setIsLocked] = useState(true);

  // Default to Light Mode (false) unless 'dark' is explicitly saved
  const [darkMode, setDarkMode] = useState(false);

  // Theme Color State
  const [themeColor, setThemeColor] = useState('blue');

  // Background Image State
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  const handleSetBackgroundImage = (dataUrl: string | null) => {
    setBackgroundImage(dataUrl);
    if (!cryptoKey) return;

    if (dataUrl) {
      setSecureItem('ezfin_bg_image', dataUrl, cryptoKey).catch(console.error);
    } else {
      setSecureItem('ezfin_bg_image', null, cryptoKey).catch(console.error);
    }
  };
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Data State
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // -- Activity Monitor Effect (Banking Style) --
  useEffect(() => {
    const updateActivity = () => {
      if (cryptoKey) {
        setSecureItem('ezfin_last_active', Date.now().toString(), cryptoKey).catch(console.error);
      }
    };

    // Attach listeners to window to catch general activity
    // This keeps the session alive as long as the user is interacting
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [cryptoKey]);

  // -- Initialization Effect (Data Loading) --
  useEffect(() => {
    const initData = async () => {
      try {
        // 1. Initialize DB and Defaults
        const { user: loadedUser, categories: loadedCats } = await dbService.initDefaultsIfNeeded(DEFAULT_USER_PROFILE);
        const loadedTxs = await dbService.getAllTransactions();

        // SECURITY MIGRATION: Check if PIN is plain text (length < 64 for sha256 hex)
        if (loadedUser.pin.length < 64) {
           console.log("Migrating Plain Text PIN to Hash...");
           const hashed = await hashPin(loadedUser.pin);
           loadedUser.pin = hashed;
           await dbService.saveUser(loadedUser);
        }

        setUser(loadedUser);
        setCategories(loadedCats);
        setTransactions(loadedTxs);
        
        // 2. Initialize Google Service with Persistent Session Restoration
        googleSheetService.initClient(async (success) => {
          if (success) {
             console.log("Google Services Initialized");
             
             // PERSISTENT LOGIN CHECK
             if (googleSheetService.hasValidSession) {
                const token = googleSheetService.getToken();
                if (token) {
                   try {
                     console.log("Restoring User Session info...");
                     const userInfo = await googleSheetService.getUserInfo(token);
                     
                     // Update State AND Persist to DB immediately
                     // This ensures next reload has the data even if offline
                     setUser(prev => {
                       const updated = {
                         ...prev,
                         googleEmail: userInfo.email,
                         googlePhotoUrl: userInfo.picture
                       };
                       dbService.saveUser(updated).catch(console.error);
                       return updated;
                     });
                     
                     console.log("Session restored: User logged in.");
                   } catch (e) {
                     console.warn("Restored session invalid (expired)", e);
                     // If token is stale/invalid, sign out cleanly
                     handleGoogleSessionError();
                   }
                }
             }
          }
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

  // -- Derive encryption key from stored PIN hash --
  useEffect(() => {
    if (!user.pin) return;

    deriveKeyFromHash(user.pin)
      .then(setCryptoKey)
      .catch((err) => console.error('Failed to derive secure storage key', err));
  }, [user.pin]);

  // -- Load secure preferences when key is ready --
  useEffect(() => {
    if (!cryptoKey) return;

    const loadSecurePrefs = async () => {
      const lastActive = await getSecureItem('ezfin_last_active', cryptoKey);
      if (lastActive) {
        const elapsed = Date.now() - parseInt(lastActive, 10);
        setIsLocked(elapsed > INACTIVITY_LIMIT_MS);
      } else {
        setIsLocked(true);
      }

      const savedTheme = await getSecureItem('theme', cryptoKey);
      if (savedTheme) {
        setDarkMode(savedTheme === 'dark');
      }

      const savedColor = await getSecureItem('theme_color', cryptoKey);
      if (savedColor) {
        setThemeColor(savedColor);
      }

      const savedBg = await getSecureItem('ezfin_bg_image', cryptoKey);
      if (savedBg !== null) {
        setBackgroundImage(savedBg);
      }
    };

    loadSecurePrefs();
  }, [cryptoKey]);

  // -- Secured Cloud Sync Effect --
  useEffect(() => {
    // Only trigger auto-sync if:
    // 1. App data is loaded
    // 2. Security Lock is OFF (User entered PIN)
    // 3. User has a Google Sheet ID configured
    if (!isAppLoading && !isLocked && user.googleSheetId) {
       console.log("Secure Session Active: Triggering Auto Sync...");
       // Short delay to ensure network/client readiness
       setTimeout(() => {
         performFullCloudSync(user.googleSheetId!);
       }, 500);
    }
  }, [isAppLoading, isLocked, user.googleSheetId]);

  // -- Theme Mode Effect --
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      if (cryptoKey) setSecureItem('theme', 'dark', cryptoKey).catch(console.error);
    } else {
      document.documentElement.classList.remove('dark');
      if (cryptoKey) setSecureItem('theme', 'light', cryptoKey).catch(console.error);
    }
  }, [darkMode, cryptoKey]);

  // -- Theme Color Effect --
  useEffect(() => {
    const selectedTheme = APP_THEMES.find(t => t.id === themeColor) || APP_THEMES[0];
    
    // Helper to convert hex to RGB triplet for Tailwind opacity variables
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? 
        `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` 
        : '0 122 255';
    };

    document.documentElement.style.setProperty('--primary-color', hexToRgb(selectedTheme.hex));
    if (cryptoKey) setSecureItem('theme_color', themeColor, cryptoKey).catch(console.error);
  }, [themeColor, cryptoKey]);

  // -- Handlers --
  const handleUnlock = () => {
    // Reset timer immediately upon unlock
    if (cryptoKey) setSecureItem('ezfin_last_active', Date.now().toString(), cryptoKey).catch(console.error);
    setIsLocked(false);
  };

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Centralized Error Handler for Google Session
  const handleGoogleSessionError = () => {
    googleSheetService.signOut();
    
    setUser((prev) => {
      // Avoid double processing if already cleared
      if (!prev.googleEmail) return prev;

      const updatedUser = { 
        ...prev, 
        googleEmail: undefined, 
        googlePhotoUrl: undefined 
        // We keep googleSheetId to allow easy reconnection, or could clear it too if desired.
        // For now, clearing email indicates "Disconnected" to the UI.
      };
      
      dbService.saveUser(updatedUser).catch(console.error);
      addToast('Sesi Google berakhir. Mohon login ulang.', 'error');
      return updatedUser;
    });
  };

  const handleAddTransaction = async (newTx: Transaction) => {
    try {
      // 1. Save Local
      await dbService.addTransaction(newTx);
      setTransactions((prev) => [newTx, ...prev]);
      
      // 2. Sync to Cloud if Configured AND Unlocked
      if (!isLocked && user.googleSheetId) {
        googleSheetService.appendTransaction(user.googleSheetId, newTx)
          .then(() => addToast('Transaction saved & synced to Drive!', 'success'))
          .catch((e) => {
             console.error("Sync Error");
             if (e.message === 'UNAUTHENTICATED') {
               handleGoogleSessionError();
             } else {
               addToast('Saved locally, but Google Sync failed.', 'info');
             }
          });
      } else {
        addToast('Transaksi berhasil disimpan!', 'success');
      }

    } catch (error) {
      console.error(error);
      addToast('Gagal menyimpan transaksi ke database', 'error');
    }
  };

  const handleEditTransaction = async (updatedTx: Transaction) => {
    try {
      await dbService.addTransaction(updatedTx); // IndexedDB put = upsert
      setTransactions((prev) => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
      
      if (!isLocked && user.googleSheetId) {
        googleSheetService.updateTransaction(user.googleSheetId, updatedTx)
          .then(() => addToast('Transaction updated & synced!', 'success'))
          .catch((e) => {
             console.error("Sync Edit Error");
             if (e.message === 'UNAUTHENTICATED') {
               handleGoogleSessionError();
             } else {
               addToast('Updated locally, but Google Sync failed.', 'info');
             }
          });
      } else {
        addToast('Transaksi berhasil diperbarui!', 'success');
      }

    } catch (error) {
      console.error(error);
      addToast('Gagal memperbarui transaksi', 'error');
    }
  };

  const handleDeleteTransactions = async (ids: string[]) => {
    try {
      // 1. Delete Local
      await dbService.bulkDeleteTransactions(ids);
      setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
      
      // 2. Delete Cloud if Configured
      if (!isLocked && user.googleSheetId) {
         googleSheetService.deleteTransactions(user.googleSheetId, ids)
           .then(() => addToast(`${ids.length} Transaction(s) deleted.`, 'success'))
           .catch((e) => {
             console.error("Delete Sync Error");
             if (e.message === 'UNAUTHENTICATED') {
               handleGoogleSessionError();
             } else {
               addToast('Deleted locally, but Cloud sync failed.', 'info');
             }
           });
      } else {
        addToast('Transaksi berhasil dihapus!', 'success');
      }
    } catch (error) {
      console.error(error);
      addToast('Gagal menghapus transaksi', 'error');
    }
  };

  const performFullCloudSync = async (sheetId: string) => {
    try {
      // Silent sync if just updating, toast only on explicit or significant events? 
      // User prompt implies "Auto-fetch", so keep it user-friendly.
      
      // 1. Sync Settings
      await handleSyncSettings(sheetId);
      
      // 2. Sync Activity
      const cloudTxs = await googleSheetService.fetchTransactions(sheetId);
      
      const cloudTxIds = new Set(cloudTxs.map(t => t.id));
      const localTxsToPush = transactions.filter(t => !cloudTxIds.has(t.id));
      
      if (localTxsToPush.length > 0) {
         console.log(`Pushing ${localTxsToPush.length} missing transactions to cloud...`);
         await googleSheetService.bulkAppendTransactions(sheetId, localTxsToPush);
      }

      if (cloudTxs.length > 0) {
         await handleImportTransactions(cloudTxs);
      }

      // Only toast on completion to avoid spam
      // addToast('Sync Complete!', 'success');
    } catch (error: any) {
      console.error("Auto Sync Failed");
      if (error.message === 'UNAUTHENTICATED' || error.message === 'Not logged in') {
         handleGoogleSessionError();
      }
    }
  };

  const handleImportTransactions = async (importedTxs: Transaction[]) => {
    try {
      await dbService.bulkAddTransactions(importedTxs);
      
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

  const handleSyncSettings = async (sheetId: string, currentThemeState: boolean = darkMode, currentThemeColor: string = themeColor) => {
    try {
        const cloudSettings = await googleSheetService.fetchAppSettings(sheetId);
        if (cloudSettings) {
            let hasChanges = false;
            
            // SECURITY: If cloud PIN is different AND looks like a valid hash (or force update locally if cloud is master)
            // If cloud PIN is plain text (migrating from old device), we should hash it locally
            if (cloudSettings.pin && cloudSettings.pin !== user.pin) {
                let pinToSave = cloudSettings.pin;
                if (pinToSave.length < 64) {
                    // Cloud has plain text, Hash it
                    pinToSave = await hashPin(pinToSave);
                }
                
                await handleUpdateProfile({ pin: pinToSave });
                hasChanges = true;
            }
            
            if (cloudSettings.categories && cloudSettings.categories.length > 0) {
                 for (const cat of cloudSettings.categories) {
                     await dbService.saveCategory(cat);
                 }
                 setCategories(cloudSettings.categories);
                 hasChanges = true;
            }

            if (cloudSettings.darkMode !== undefined && cloudSettings.darkMode !== currentThemeState) {
               setDarkMode(cloudSettings.darkMode);
               hasChanges = true;
            }
            
            if (cloudSettings.themeColor && cloudSettings.themeColor !== currentThemeColor) {
                setThemeColor(cloudSettings.themeColor);
                hasChanges = true;
            }

            return true;
        } else {
            await googleSheetService.saveAppSettings(sheetId, user.pin, categories, currentThemeState, currentThemeColor);
            return false;
        }
    } catch (e: any) {
        console.error("Settings Sync error");
        if (e.message !== 'UNAUTHENTICATED') {
            // Suppress error toast for background syncs to avoid annoyance
        } else {
            // Rethrow so callers (performFullCloudSync) can detect auth errors
            throw e;
        }
        return false;
    }
  };

  const handleUpdateProfile = async (updatedUserPart: Partial<UserProfile>) => {
    try {
      const newUser = { ...user, ...updatedUserPart };
      await dbService.saveUser(newUser);
      setUser(newUser);
      
      if (newUser.googleSheetId && (updatedUserPart.pin || updatedUserPart.name)) {
         googleSheetService.saveAppSettings(newUser.googleSheetId, newUser.pin, categories, darkMode, themeColor).catch(console.error);
      }
    } catch (error) {
      console.error(error);
      addToast('Gagal memperbarui profil', 'error');
    }
  };

  const handleAddCategory = async (newCat: Category) => {
    try {
      await dbService.saveCategory(newCat);
      const newCats = [...categories, newCat];
      setCategories(newCats);
      addToast('Kategori ditambahkan', 'success');

      if (user.googleSheetId) {
        googleSheetService.saveAppSettings(user.googleSheetId, user.pin, newCats, darkMode, themeColor).catch(console.error);
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

      if (user.googleSheetId) {
        googleSheetService.saveAppSettings(user.googleSheetId, user.pin, newCats, darkMode, themeColor).catch(console.error);
      }
    } catch (e) {
      addToast('Gagal hapus kategori', 'error');
    }
  };
  
  const toggleThemeHandler = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (user.googleSheetId) {
      googleSheetService.saveAppSettings(user.googleSheetId, user.pin, categories, newMode, themeColor).catch(console.error);
    }
  };
  
  const changeThemeColorHandler = (color: string) => {
    setThemeColor(color);
    if (user.googleSheetId) {
      googleSheetService.saveAppSettings(user.googleSheetId, user.pin, categories, darkMode, color).catch(console.error);
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

  // Security Gate
  if (isLocked) {
    return <PinScreen correctPin={user.pin} onSuccess={handleUnlock} />;
  }

  return (
    <LanguageProvider>
      <Router>
        {/* 
          LAYOUT REFACTOR:
          - Use min-h-[100dvh] for mobile viewport support
          - Allow body to scroll (removed overflow-hidden from root)
          - Ensure Sticky Sidebar for desktop
          - Ensure padding-bottom on main content to clear fixed Navbar
          - Add Dynamic Background Layer for custom images
        */}
        <div className={`flex min-h-[100dvh] w-full text-gray-900 dark:text-gray-100 transition-colors duration-300 ${darkMode ? 'dark' : ''} ${!backgroundImage ? 'bg-[#F2F2F7] dark:bg-black' : ''}`}>
          
          {/* Custom Background Image Layer - Blurry & 50% Opacity */}
          {backgroundImage && (
            <div 
              className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none transition-all duration-700 ease-in-out"
              style={{ 
                backgroundImage: `url(${backgroundImage})`, 
                filter: 'blur(12px)',
                opacity: 0.5 
              }}
            />
          )}

          <ToastContainer toasts={toasts} removeToast={removeToast} />
          
          {/* Desktop Sidebar: Sticky to remain visible during body scroll - z-20 to be above bg */}
          <div className="hidden md:flex md:flex-col z-20 sticky top-0 h-[100dvh]">
            <Sidebar />
          </div>

          {/* Main Content Area - relative z-10 to sit on top of fixed background */}
          <div className="flex-1 flex flex-col relative z-10">
            
            {/* Main Content - let the browser handle scrolling (removed overflow-y-auto) */}
            <main className="flex-1 w-full">
              {/* 
                Mobile Padding Fix:
                pb-56 (224px) ensures content clears the fixed bottom navbar and floating buttons.
                max-w limits width on large screens.
              */}
              <div className="pb-56 md:pb-8 md:p-8 max-w-[1600px] mx-auto w-full pt-safe">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-10">
                      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  }
                >
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
                    path="/edit/:id" 
                    element={
                      <div className="md:max-w-2xl md:mx-auto">
                        <EditTransactionWrapper 
                          transactions={transactions} 
                          categories={categories} 
                          onSave={handleEditTransaction}
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
                          onDelete={handleDeleteTransactions}
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
                          themeColor={themeColor}
                          toggleTheme={toggleThemeHandler}
                          setThemeColor={changeThemeColorHandler}
                          backgroundImage={backgroundImage}
                          setBackgroundImage={handleSetBackgroundImage}
                          onAddCategory={handleAddCategory}
                          onDeleteCategory={handleDeleteCategory}
                          updateUser={handleUpdateProfile}
                          onImportTransactions={handleImportTransactions}
                          onSyncSettings={(id) => handleSyncSettings(id, darkMode, themeColor)}
                          addToast={addToast}
                          onGoogleSessionError={handleGoogleSessionError}
                        />
                      </div>
                    }
                  />
                  </Routes>
                </Suspense>
              </div>
            </main>

            {/* Mobile Navbar: Fixed at bottom */}
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
