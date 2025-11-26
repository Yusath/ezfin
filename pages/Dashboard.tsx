import React, { useState, useEffect } from 'react';
import { UserProfile, Transaction, Category } from '../types';
import { TrendingUp, TrendingDown, Wallet, X, Settings as SettingsIcon, LogIn, CheckCircle, RefreshCcw, PieChart, Activity, Plus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, CartesianGrid } from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import { googleSheetService } from '../services/googleSheetService';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  user: UserProfile;
  transactions: Transaction[];
  categories: Category[];
  onUpdateUser: (user: Partial<UserProfile>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, transactions, onUpdateUser }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Local state for editing profile
  const [editName, setEditName] = useState(user.name);
  const [editAvatar, setEditAvatar] = useState(user.avatarUrl);
  
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Sync local edit state when user prop updates (e.g. after Google Login or DB Load)
  useEffect(() => {
    setEditName(user.name);
    setEditAvatar(user.avatarUrl);
  }, [user]);

  // --- 1. CORE DATA CALCULATION ENGINE ---
  const calculateRealTotal = (t: Transaction): number => {
    let amt = Number(t.totalAmount);
    if (!amt || isNaN(amt) || amt === 0) {
      if (t.items && t.items.length > 0) {
         amt = t.items.reduce((sum, item) => {
             const qty = Number(item.qty) || 0;
             const price = Number(item.price) || 0;
             return sum + (qty * price);
         }, 0);
      }
    }
    return Math.max(0, amt || 0);
  };

  const getValidDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // --- 2. AGGREGATION LOGIC ---
  const totalIncomeAllTime = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + calculateRealTotal(t), 0);
    
  const totalExpenseAllTime = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + calculateRealTotal(t), 0);
    
  const balance = totalIncomeAllTime - totalExpenseAllTime;

  const currentMonth = new Date();
  const isSameMonth = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
  
  const monthlyTransactions = transactions.filter(t => {
    const d = getValidDate(t.date);
    return d && isSameMonth(d, currentMonth);
  });

  const monthlyIncome = monthlyTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + calculateRealTotal(t), 0);
    
  const monthlyExpense = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + calculateRealTotal(t), 0);

  const recentTransactions = [...transactions]
    .sort((a, b) => {
      const dateA = getValidDate(a.date)?.getTime() || 0;
      const dateB = getValidDate(b.date)?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 10);

  // Chart Data Generation
  const getChartData = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    const filteredTxs = transactions.filter(t => t.type === 'expense');
    
    let start: Date;
    const end = now;
    let groupBy: 'day' | 'month' = 'day';

    if (chartPeriod === 'week') {
      start = new Date();
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (chartPeriod === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
      groupBy = 'month';
    }

    const dataMap = new Map<string, number>();
    const cursor = new Date(start);
    
    while (cursor <= end) {
        let key = groupBy === 'day' 
          ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
          : `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        dataMap.set(key, 0);
        
        if (groupBy === 'day') cursor.setDate(cursor.getDate() + 1);
        else cursor.setMonth(cursor.getMonth() + 1);
    }

    filteredTxs.forEach(t => {
      const d = getValidDate(t.date);
      if (!d) return;

      if (d >= start && d <= end) {
         let key = groupBy === 'day' 
           ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
           : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
         
         if (dataMap.has(key)) {
           dataMap.set(key, (dataMap.get(key) || 0) + calculateRealTotal(t));
         }
      }
    });

    return Array.from(dataMap.entries()).map(([key, value]) => {
        const [y, m, d] = key.split('-').map(Number);
        let name = groupBy === 'day' ? `${d}/${m}` : new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'short' });
        return { name, amount: value };
    });
  };

  const chartData = getChartData();
  const hasChartData = chartData.some(d => d.amount > 0);

  // --- 3. UI HANDLERS ---
  const handleSaveProfile = () => {
    onUpdateUser({ name: editName, avatarUrl: editAvatar });
    setIsProfileModalOpen(false);
  };

  const generateNewAvatar = () => {
    const encodedName = encodeURIComponent(editName || 'User');
    const colors = ['007AFF', '34C759', 'FF9500', 'AF52DE', 'FF2D55', '5856D6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setEditAvatar(`https://ui-avatars.com/api/?name=${encodedName}&background=${randomColor}&color=fff&size=128&bold=true`);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const token = await googleSheetService.signIn();
      const userInfo = await googleSheetService.getUserInfo(token);
      
      // Update User Profile with Google Info
      onUpdateUser({ 
        name: userInfo.name,          // Sync Name
        avatarUrl: userInfo.picture,  // Sync Photo
        googleEmail: userInfo.email,
        googlePhotoUrl: userInfo.picture,
      });
      
    } catch (error) {
      console.error(error);
      alert("Failed to sign in with Google");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  return (
    <div className="pt-safe md:px-0 space-y-6 md:space-y-8 page-transition pb-28 md:pb-10 w-full overflow-x-hidden">
      
      {/* Header Profile - Mobile */}
      <div className="flex items-center justify-between pt-4 px-4 md:hidden">
        <button 
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-4 group ios-touch-target"
        >
          <img 
            src={user.avatarUrl} 
            alt="Profile" 
            className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-white dark:border-card-dark"
          />
          <div className="flex flex-col items-start text-left">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{getGreeting()}</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
              {user.name.split(' ')[0]}
            </h2>
          </div>
        </button>

        <Link 
          to="/settings"
          aria-label="Settings"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-white/10 shadow-sm text-gray-600 dark:text-gray-300 ios-touch-target"
        >
           <SettingsIcon size={18} />
        </Link>
      </div>

      {/* Header Desktop */}
      <div className="hidden md:flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{t('nav.dashboard')}</h1>
          <p className="text-sm text-gray-500">{t('dash.welcome')}, {user.name} 👋</p>
        </div>
        <button 
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-3 bg-card-light dark:bg-card-dark px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all ios-touch-target"
        >
           <img src={user.avatarUrl} alt="Profile" className="w-8 h-8 rounded-full" />
           <span className="font-bold text-sm text-gray-700 dark:text-white">{t('dash.profile')}</span>
        </button>
      </div>

      {/* DASHBOARD GRID */}
      {/* Changed gap-4 to gap-y-4 to remove horizontal gap on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-y-4 md:gap-6 w-full">

        {/* Hero Card (Balance) - Full Stretch on Mobile */}
        {/* Adjusted Font Sizes for Proportion */}
        <div className="md:col-span-8 w-full flex flex-col gap-6">
          <div className="w-full relative overflow-hidden rounded-b-[2rem] md:rounded-[2rem] p-6 md:p-8 shadow-ios shadow-blue-500/20 bg-gradient-to-br from-[#007AFF] to-[#5856D6] text-white ios-touch-target">
            <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
              <span className="text-blue-100 text-[10px] font-semibold tracking-widest uppercase mb-1 opacity-80">{t('dash.balance')}</span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 break-words max-w-full">
                Rp {balance.toLocaleString('id-ID')}
              </h1>
              
              <div className="grid grid-cols-2 gap-3 md:gap-4 w-full md:max-w-md">
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 md:p-4 flex flex-col items-center md:items-start border border-white/10 hover:bg-white/30 transition-colors min-w-0">
                  <div className="flex items-center gap-1.5 md:gap-2 mb-1 justify-center md:justify-start w-full">
                    <div className="p-1 md:p-1.5 bg-white/20 rounded-full shrink-0">
                      <TrendingUp size={10} className="md:w-3 md:h-3 text-white" />
                    </div>
                    <span className="text-[10px] text-blue-100 font-bold uppercase tracking-wider truncate">{t('dash.income')}</span>
                  </div>
                  {/* Fixed: Use Total Income All Time to match Balance Context */}
                  <span className="font-bold text-base md:text-lg truncate w-full">Rp {totalIncomeAllTime.toLocaleString('id-ID')}</span>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 md:p-4 flex flex-col items-center md:items-start border border-white/10 hover:bg-white/30 transition-colors min-w-0">
                  <div className="flex items-center gap-1.5 md:gap-2 mb-1 justify-center md:justify-start w-full">
                    <div className="p-1 md:p-1.5 bg-white/20 rounded-full shrink-0">
                      <TrendingDown size={10} className="md:w-3 md:h-3 text-white" />
                    </div>
                    <span className="text-[10px] text-blue-100 font-bold uppercase tracking-wider truncate">{t('dash.expense')}</span>
                  </div>
                   {/* Fixed: Use Total Expense All Time to match Balance Context */}
                  <span className="font-bold text-base md:text-lg truncate w-full">Rp {totalExpenseAllTime.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
            
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
          </div>
          
          {/* Desktop Only: Big "New Transaction" Button */}
          <Link 
            to="/add" 
            className="hidden md:flex w-full bg-black dark:bg-white dark:text-black text-white py-4 rounded-[1.5rem] font-bold shadow-lg shadow-gray-200 dark:shadow-none hover:shadow-xl transition-all items-center justify-center gap-3 active:scale-[0.99] text-lg"
          >
             <div className="bg-white/20 rounded-full p-1">
               <Plus size={24} strokeWidth={3} />
             </div>
             <span>{t('nav.add')}</span>
          </Link>
        </div>

        {/* Quick Stats / Info */}
        <div className="col-span-12 md:col-span-4 flex flex-col h-full mx-4 md:mx-0">
           <div className="bg-card-light dark:bg-card-dark rounded-[2rem] p-5 shadow-sm border border-gray-100 dark:border-white/5 h-full flex flex-col justify-center">
             <h3 className="font-bold text-base mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                <Activity size={16} className="text-primary"/>
                {t('dash.quickSum')}
             </h3>
             {/* Grid layout for mobile flexibility */}
             <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-3 h-full">
               <div className="flex flex-col justify-center items-center md:items-start p-3 bg-surface dark:bg-white/5 rounded-2xl md:flex-row md:justify-between">
                 <div className="text-center md:text-left">
                    <span className="text-[10px] font-medium text-gray-500 block mb-0.5">{t('dash.txMonth')}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-xl md:text-lg">{monthlyTransactions.length}</span>
                 </div>
                 <div className="hidden md:flex w-8 h-8 rounded-full bg-blue-100 dark:bg-white/10 items-center justify-center text-primary">
                    <PieChart size={14} />
                 </div>
               </div>
               
               <div className="flex flex-col justify-center items-center md:items-start p-3 bg-surface dark:bg-white/5 rounded-2xl md:flex-row md:justify-between">
                 <div className="text-center md:text-left w-full">
                    <span className="text-[10px] font-medium text-gray-500 block mb-0.5">{t('dash.avgSpend')}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-base md:text-lg truncate block">
                       Rp {Math.round((monthlyExpense || 0) / (new Date().getDate() || 1)).toLocaleString('id-ID', { notation: 'compact' })}
                    </span>
                 </div>
                 <div className="hidden md:flex w-8 h-8 rounded-full bg-orange-100 dark:bg-white/10 items-center justify-center text-orange-500">
                    <TrendingUp size={14} />
                 </div>
               </div>
             </div>
           </div>
        </div>

        {/* Chart Section */}
        <div className="col-span-12 md:col-span-8 space-y-4 mx-4 md:mx-0">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{t('dash.analytics')}</h3>
            <div className="flex bg-gray-200 dark:bg-white/10 rounded-lg p-0.5">
              {(['week', 'month', 'year'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase ios-touch-target ${
                    chartPeriod === p 
                      ? 'bg-card-light dark:bg-card-dark shadow-sm text-primary' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-56 md:h-80 w-full bg-card-light dark:bg-card-dark rounded-[2rem] p-4 md:p-6 shadow-sm border border-gray-100 dark:border-white/5">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)', fontSize: '12px' }}
                    itemStyle={{ color: '#007AFF', fontWeight: 'bold' }}
                    cursor={{ stroke: '#007AFF', strokeWidth: 1 }}
                    formatter={(val) => `Rp ${Number(val).toLocaleString()}`}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#007AFF" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p className="text-xs font-medium">No data available for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent List */}
        <div className="col-span-12 md:col-span-4 md:row-span-2 flex flex-col h-full mx-4 md:mx-0">
           <div className="flex justify-between items-center px-2 mb-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{t('dash.recent')}</h3>
            <Link to="/history" className="text-xs text-primary font-medium hover:underline ios-touch-target">{t('dash.viewAll')}</Link>
          </div>
          
          <div className="flex-1 bg-card-light dark:bg-card-dark rounded-[2rem] p-0 md:p-6 md:shadow-sm md:border md:border-gray-100 dark:md:border-white/5 overflow-hidden">
            <div className="space-y-3 h-full overflow-y-auto no-scrollbar md:pr-2 pb-4 md:pb-0">
              {recentTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center rounded-3xl border border-dashed border-gray-200 dark:border-white/10 m-2">
                   <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-2">
                      <Wallet size={18} className="text-gray-400" />
                   </div>
                   <p className="text-xs text-gray-400 font-medium">{t('dash.noTx')}</p>
                </div>
              ) : (
                recentTransactions.map((tx, idx) => {
                  const realAmount = calculateRealTotal(tx);
                  return (
                    <div 
                      key={tx.id} 
                      className="flex justify-between items-center bg-white dark:bg-card-dark md:bg-gray-50 md:dark:bg-white/5 p-3 rounded-2xl shadow-sm md:shadow-none ios-touch-target border border-gray-100 dark:border-white/5 md:border-transparent animate-slide-in-right group"
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center group-active:scale-95 transition-transform ${tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                          {tx.type === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-xs md:text-sm line-clamp-1">{tx.storeName}</p>
                          <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5 font-medium">
                             <span>{getValidDate(tx.date)?.toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</span>
                             {tx.items && tx.items.length > 0 && <span>• {tx.items.length} Items</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`font-bold text-xs md:text-sm whitespace-nowrap ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {tx.type === 'income' ? '+' : '-'} {realAmount.toLocaleString('id-ID', { notation: 'compact' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Profile & Google Auth Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in w-full">
          <div className="bg-card-light dark:bg-card-dark w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl animate-ios-slide-up max-h-[90vh] overflow-y-auto page-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Account & Profile</h3>
              <button onClick={() => setIsProfileModalOpen(false)} aria-label="Close profile" className="p-2 bg-gray-100 dark:bg-white/10 rounded-full text-gray-500 hover:bg-gray-200 ios-touch-target">
                <X size={18} />
              </button>
            </div>
            
            {/* Avatar Section */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative cursor-pointer ios-touch-target" onClick={generateNewAvatar}>
                 <img src={editAvatar} alt="Avatar" className="w-20 h-20 rounded-full border-4 border-gray-100 dark:border-white/10 bg-gray-50 object-cover" />
                 <div className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg border-2 border-white dark:border-black">
                   <RefreshCcw size={12} />
                 </div>
              </div>
            </div>

            {/* Google Login Section - MANDATORY FOR SYNC */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/5">
               <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                 {t('set.backup')}
               </h4>
               
               {user.googleEmail ? (
                 <div className="flex items-center gap-3">
                    <div className="relative">
                       <img src={user.googlePhotoUrl || user.avatarUrl} className="w-10 h-10 rounded-full border border-gray-200" />
                       <div className="absolute -bottom-1 -right-1 bg-green-500 p-0.5 rounded-full border-2 border-white">
                         <CheckCircle size={10} className="text-white" />
                       </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                       <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{user.googleEmail}</p>
                       <p className="text-xs text-green-600 font-medium">Connected</p>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-3">
                   <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                     {t('set.backup.desc')}
                   </p>
                   <button 
                     onClick={handleGoogleLogin}
                     disabled={isGoogleLoading}
                     className="w-full bg-card-light dark:bg-black border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white py-3 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ios-touch-target text-sm"
                   >
                     {isGoogleLoading ? (
                       <span className="animate-pulse">Connecting...</span>
                     ) : (
                       <>
                         <LogIn size={16} />
                         {t('set.signin')}
                       </>
                     )}
                   </button>
                 </div>
               )}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-3 mb-1 block">Display Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-white/10 border-none rounded-2xl px-4 py-3 font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="Nama Lengkap"
                />
              </div>
              <button 
                onClick={handleSaveProfile}
                className="w-full bg-primary text-white py-3.5 rounded-2xl font-bold text-base shadow-lg shadow-blue-500/30 ios-touch-target hover:bg-blue-600 active:scale-95 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;