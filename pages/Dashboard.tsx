import React, { useState, useEffect } from 'react';
import { UserProfile, Transaction, Category } from '../types';
import { TrendingUp, TrendingDown, Wallet, X, Save, Settings as SettingsIcon, ChevronRight, LogIn, CheckCircle, RefreshCcw } from 'lucide-react';
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
  const [editName, setEditName] = useState(user.name);
  const [editAvatar, setEditAvatar] = useState(user.avatarUrl);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    setEditName(user.name);
    setEditAvatar(user.avatarUrl);
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // --- ROBUST DATA HELPERS ---
  
  // Calculate amount intelligently: Fallback to summing items if totalAmount is 0 or missing
  const getTxAmount = (t: Transaction): number => {
    let amt = Number(t.totalAmount);
    
    // If total is invalid or 0, try to recalculate from items
    if ((isNaN(amt) || amt === 0) && t.items && t.items.length > 0) {
      const recalculated = t.items.reduce((sum, i) => {
        const qty = Number(i.qty) || 0;
        const price = Number(i.price) || 0;
        return sum + (qty * price);
      }, 0);
      if (recalculated > 0) amt = recalculated;
    }
    
    return isNaN(amt) ? 0 : amt;
  };

  const getValidDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // --- LOGIC CALCULATIONS ---
  
  // 1. Total Balance (ALL TIME)
  const totalIncomeAllTime = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + getTxAmount(t), 0);
    
  const totalExpenseAllTime = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + getTxAmount(t), 0);
    
  const balance = totalIncomeAllTime - totalExpenseAllTime;

  // 2. Monthly Cashflow (THIS MONTH)
  const currentMonth = new Date();
  const isSameMonth = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
  
  const monthlyTransactions = transactions.filter(t => {
    const d = getValidDate(t.date);
    return d && isSameMonth(d, currentMonth);
  });

  const monthlyIncome = monthlyTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + getTxAmount(t), 0);
    
  const monthlyExpense = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + getTxAmount(t), 0);

  // 3. Recent Transactions (GLOBAL - Sorted by Date)
  const recentTransactions = [...transactions]
    .sort((a, b) => {
      const dateA = getValidDate(a.date)?.getTime() || 0;
      const dateB = getValidDate(b.date)?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 10);

  // Chart Data
  const getChartData = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    // Use explicit safe filtering
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
    
    // Initialize map with 0s
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
           dataMap.set(key, (dataMap.get(key) || 0) + getTxAmount(t));
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
      onUpdateUser({ 
        googleEmail: userInfo.email,
        googlePhotoUrl: userInfo.picture,
      });
      setIsProfileModalOpen(false);
      navigate('/settings');
    } catch (error) {
      console.error(error);
      alert("Failed to sign in with Google");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="pt-safe px-6 md:px-0 space-y-8 page-transition pb-10">
      
      {/* Header Profile - Mobile Only */}
      <div className="flex items-center justify-between pt-4 md:hidden">
        <button 
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-4 group ios-touch-target"
        >
          <img 
            src={user.avatarUrl} 
            alt="Profile" 
            className="w-12 h-12 rounded-full object-cover shadow-md border-2 border-white dark:border-gray-800"
          />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{getGreeting()}</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {user.name.split(' ')[0]}
            </h2>
          </div>
        </button>

        <Link 
          to="/settings"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-[#1C1C1E] shadow-sm text-gray-600 dark:text-gray-300 ios-touch-target"
        >
           <SettingsIcon size={20} />
        </Link>
      </div>

      {/* Header Desktop */}
      <div className="hidden md:flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">{t('nav.dashboard')}</h1>
          <p className="text-gray-500">{t('dash.welcome')}, {user.name} 👋</p>
        </div>
        <button 
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-3 bg-white dark:bg-[#1C1C1E] px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all ios-touch-target"
        >
           <img src={user.avatarUrl} alt="Profile" className="w-8 h-8 rounded-full" />
           <span className="font-bold text-sm text-gray-700 dark:text-white">{t('dash.profile')}</span>
        </button>
      </div>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Hero Card (Balance) */}
        <div className="md:col-span-8 relative overflow-hidden rounded-[2.5rem] p-8 shadow-2xl shadow-blue-500/20 bg-gradient-to-br from-[#007AFF] to-[#5856D6] text-white ios-touch-target">
          <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-blue-100 text-xs font-semibold tracking-widest uppercase mb-2">{t('dash.balance')}</span>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-8">Rp {balance.toLocaleString('id-ID')}</h1>
            
            <div className="flex gap-4 w-full md:max-w-md">
              <div className="flex-1 bg-white/20 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center md:items-start border border-white/20 hover:bg-white/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1 bg-white/20 rounded-full">
                    <TrendingUp size={14} className="text-white" />
                  </div>
                  <span className="text-[10px] text-blue-100 font-medium uppercase">{t('dash.income')}</span>
                </div>
                <span className="font-bold text-lg">Rp {monthlyIncome.toLocaleString('id-ID', { notation: 'compact' })}</span>
              </div>
              <div className="flex-1 bg-white/20 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center md:items-start border border-white/20 hover:bg-white/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1 bg-white/20 rounded-full">
                    <TrendingDown size={14} className="text-white" />
                  </div>
                  <span className="text-[10px] text-blue-100 font-medium uppercase">{t('dash.expense')}</span>
                </div>
                <span className="font-bold text-lg">Rp {monthlyExpense.toLocaleString('id-ID', { notation: 'compact' })}</span>
              </div>
            </div>
          </div>
          
          {/* Decorative */}
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
        </div>

        {/* Quick Stats / Info */}
        <div className="flex col-span-12 md:col-span-4 bg-white dark:bg-[#1C1C1E] rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex-col justify-center">
             <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">{t('dash.quickSum')}</h3>
             <div className="space-y-4">
               <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-black/30 rounded-xl">
                 <span className="text-sm text-gray-500">{t('dash.txMonth')}</span>
                 <span className="font-bold text-gray-900 dark:text-white">{monthlyTransactions.length}</span>
               </div>
               <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-black/30 rounded-xl">
                 <span className="text-sm text-gray-500">{t('dash.avgSpend')}</span>
                 <span className="font-bold text-gray-900 dark:text-white">
                   Rp {Math.round((monthlyExpense || 0) / (new Date().getDate() || 1)).toLocaleString('id-ID', { notation: 'compact' })}
                 </span>
               </div>
             </div>
        </div>

        {/* Chart Section */}
        <div className="col-span-12 md:col-span-8 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-xl text-gray-900 dark:text-white">{t('dash.analytics')}</h3>
            <div className="flex bg-gray-200 dark:bg-[#1C1C1E] rounded-lg p-1">
              {(['week', 'month', 'year'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase ios-touch-target ${
                    chartPeriod === p 
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' 
                      : 'text-gray-500 dark:text-gray-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-64 md:h-80 w-full bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: '#007AFF', fontWeight: 'bold' }}
                    cursor={{ stroke: '#007AFF', strokeWidth: 1 }}
                    formatter={(val) => `Rp ${Number(val).toLocaleString()}`}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#007AFF" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
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
        <div className="col-span-12 md:col-span-4 md:row-span-2 flex flex-col h-full">
           <div className="flex justify-between items-center px-1 mb-4">
            <h3 className="font-bold text-xl text-gray-900 dark:text-white">{t('dash.recent')}</h3>
            <Link to="/history" className="text-sm text-primary font-medium hover:underline ios-touch-target">{t('dash.viewAll')}</Link>
          </div>
          
          <div className="flex-1 bg-white dark:bg-[#1C1C1E] md:rounded-3xl p-0 md:p-6 md:shadow-sm md:border md:border-gray-100 dark:md:border-gray-800 overflow-hidden">
            <div className="space-y-3 h-full overflow-y-auto no-scrollbar md:pr-2">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-10 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                   <p className="text-sm text-gray-400">{t('dash.noTx')}</p>
                </div>
              ) : (
                recentTransactions.map((tx, idx) => (
                  <div 
                    key={tx.id} 
                    className="flex justify-between items-center bg-white dark:bg-[#1C1C1E] md:bg-gray-50 md:dark:bg-black/20 p-4 rounded-2xl shadow-sm md:shadow-none ios-touch-target border border-gray-100 dark:border-gray-800 md:border-transparent animate-slide-in-right"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {tx.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{tx.storeName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{getValidDate(tx.date)?.toLocaleDateString('id-ID', {day:'numeric', month:'short'}) || 'Date Error'}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm whitespace-nowrap ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'} {getTxAmount(tx).toLocaleString('id-ID', { notation: 'compact' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Profile & Google Auth Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in w-full">
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-8 shadow-2xl animate-ios-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Account & Profile</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:bg-gray-200 ios-touch-target">
                <X size={20} />
              </button>
            </div>
            
            {/* Avatar Section */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative cursor-pointer ios-touch-target" onClick={generateNewAvatar}>
                 <img src={editAvatar} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-gray-100 dark:border-gray-800 bg-gray-50" />
                 <div className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-black">
                   <RefreshCcw size={14} />
                 </div>
              </div>
            </div>

            {/* Google Login Section - MANDATORY FOR SYNC */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5">
               <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
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
                   <p className="text-sm text-gray-500 dark:text-gray-400">
                     {t('set.backup.desc')}
                   </p>
                   <button 
                     onClick={handleGoogleLogin}
                     disabled={isGoogleLoading}
                     className="w-full bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white py-3 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ios-touch-target"
                   >
                     {isGoogleLoading ? (
                       <span className="animate-pulse">Connecting...</span>
                     ) : (
                       <>
                         <LogIn size={18} />
                         {t('set.signin')}
                       </>
                     )}
                   </button>
                 </div>
               )}
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-3">Display Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-black/50 border-none rounded-2xl px-5 py-4 font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                  placeholder="Nama Lengkap"
                />
              </div>
              <button 
                onClick={handleSaveProfile}
                className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/30 ios-touch-target hover:bg-blue-600"
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