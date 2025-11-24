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
      
      addToast(`${importedTxs.length} transactions synced from cloud!`, 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to save imported data', 'error');
    }
  };

  const handleUpdateProfile = async (updatedUserPart: Partial<UserProfile>) => {
    try {
      const newUser = { ...user, ...updatedUserPart };
      await dbService.saveUser(newUser);
      setUser(newUser);
      addToast('Profil diperbarui', 'success');
    } catch (error) {
      console.error(error);
      addToast('Gagal memperbarui profil', 'error');
    }
  };

  // Category Handlers
  const handleAddCategory = async (newCat: Category) => {
    try {
      await dbService.saveCategory(newCat);
      setCategories(prev => [...prev, newCat]);
      addToast('Kategori ditambahkan', 'success');
    } catch (e) {
      addToast('Gagal simpan kategori', 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await dbService.deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      addToast('Kategori dihapus', 'success');
    } catch (e) {
      addToast('Gagal hapus kategori', 'error');
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
                          toggleTheme={() => setDarkMode(!darkMode)}
                          onAddCategory={handleAddCategory}
                          onDeleteCategory={handleDeleteCategory}
                          updateUser={handleUpdateProfile}
                          onImportTransactions={handleImportTransactions}
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