
import React, { useState } from 'react';
import { Transaction, UserProfile } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Bot, X, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { getFinancialAdvice } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

interface StatsProps {
  transactions: Transaction[];
  user: UserProfile;
}

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6', '#FF3B30', '#8E8E93'];

const Stats: React.FC<StatsProps> = ({ transactions, user }) => {
  const { t } = useLanguage();
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [advice, setAdvice] = useState('');
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // 1. Calculate Expenses by Category
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  const categoryMap = expenseTransactions.reduce((acc: Record<string, number>, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.totalAmount;
    return acc;
  }, {});

  const chartData = Object.keys(categoryMap)
    .map(key => ({
      name: key,
      value: categoryMap[key]
    }))
    .sort((a, b) => b.value - a.value);

  const handleAskAI = async () => {
    setIsAdvisorOpen(true);
    if (!advice) {
      setLoadingAdvice(true);
      const result = await getFinancialAdvice(transactions, user.name);
      setAdvice(result);
      setLoadingAdvice(false);
    }
  };

  return (
    <div className="pt-safe min-h-screen page-transition pb-32">
      <div className="px-6 py-6 pb-2">
        <h1 className="text-2xl font-extrabold text-black dark:text-white tracking-tight">{t('stats.title')}</h1>
      </div>

      <div className="px-4 space-y-6">
        
        {/* AI ADVISOR SECTION - NOW AT THE TOP */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[1.5rem] p-5 text-white shadow-lg shadow-indigo-500/25 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                        <Bot size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg leading-tight">{t('stats.advisor.btn')}</h2>
                        <p className="text-indigo-100 text-xs font-medium opacity-90">{t('stats.advisor.desc')}</p>
                    </div>
                </div>

                {!isAdvisorOpen ? (
                    <button 
                        onClick={handleAskAI}
                        className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles size={16} />
                        Minta Analisis AI
                    </button>
                ) : (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 animate-fade-in">
                         {loadingAdvice ? (
                             <div className="flex items-center gap-3">
                                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                 <span className="text-xs font-medium animate-pulse">Sedang menganalisis data keuanganmu...</span>
                             </div>
                         ) : (
                             <div>
                                 <div className="flex justify-between items-start mb-2">
                                     <h3 className="text-xs font-bold uppercase tracking-wider opacity-70">Saran AI:</h3>
                                     <button onClick={() => setIsAdvisorOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={14}/></button>
                                 </div>
                                 <p className="text-sm font-medium leading-relaxed">{advice}</p>
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>

        {/* CHART SECTION */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-white/5">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                 <TrendingUp size={16} className="text-primary"/>
                 {t('stats.dist')}
             </h3>
             
             {chartData.length > 0 ? (
                 <div className="h-64 w-full relative">
                     <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                             <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                             >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                ))}
                             </Pie>
                             <RechartsTooltip 
                                formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`}
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                             />
                         </PieChart>
                     </ResponsiveContainer>
                     
                     {/* Center Label */}
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                         <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Total</span>
                         <span className="text-lg font-black text-gray-900 dark:text-white">
                             {totalExpense >= 1000000 
                               ? `${(totalExpense / 1000000).toFixed(1)}Jt` 
                               : `${(totalExpense / 1000).toFixed(0)}K`
                             }
                         </span>
                     </div>
                 </div>
             ) : (
                 <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                     <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                        <AlertCircle size={24} className="opacity-50" />
                     </div>
                     <p className="text-xs font-medium">{t('stats.noData')}</p>
                 </div>
             )}
        </div>

        {/* DETAILS LIST */}
        <div className="space-y-3">
             <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-2">{t('stats.details')}</h3>
             {chartData.map((item, index) => (
                 <div key={item.name} className="bg-white dark:bg-[#1C1C1E] p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-white/5 shadow-sm ios-touch-target">
                     <div className="flex items-center gap-3">
                         <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                         <span className="font-bold text-sm text-gray-900 dark:text-white">{item.name}</span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            ({((item.value / totalExpense) * 100).toFixed(1)}%)
                         </span>
                     </div>
                     <span className="font-bold text-sm text-gray-900 dark:text-white">Rp {item.value.toLocaleString('id-ID')}</span>
                 </div>
             ))}
        </div>

      </div>
    </div>
  );
};

export default Stats;
