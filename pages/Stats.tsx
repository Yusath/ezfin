import React, { useState } from 'react';
import { Transaction, UserProfile } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Bot, X, Sparkles } from 'lucide-react';
import { getFinancialAdvice } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

interface StatsProps {
  transactions: Transaction[];
  user: UserProfile;
}

const COLORS = ['#4F46E5', '#10B981', '#F43F5E', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

const Stats: React.FC<StatsProps> = ({ transactions, user }) => {
  const { t } = useLanguage();
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [advice, setAdvice] = useState('');
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // Aggregate data by category for Expenses only
  const categoryData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: Record<string, number>, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.totalAmount;
      return acc;
    }, {});

  const chartData = Object.keys(categoryData).map(key => ({
    name: key,
    value: categoryData[key]
  }));

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
    <div className="p-6 pb-28 md:pb-10 min-h-screen space-y-6 bg-[#F2F2F7] dark:bg-black page-transition pt-safe">
      <div className="pb-2">
        <h1 className="text-2xl font-extrabold text-black dark:text-white tracking-tight">{t('stats.title')}</h1>
      </div>

      {/* Pie Chart Card */}
      <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6 text-center">{t('stats.dist')}</h3>
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  cornerRadius={6}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <RechartsTooltip 
                   formatter={(value: number) => `Rp ${value.toLocaleString()}`}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', padding: '8px', fontSize: '12px' }}
                   itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px', fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
              <div className="w-14 h-14 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center">
                 <div className="w-7 h-7 bg-gray-200 dark:bg-white/10 rounded-full"></div>
              </div>
              <p className="text-xs font-medium opacity-50">{t('stats.noData')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Categories List */}
      <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5">
         <h3 className="font-bold mb-5 dark:text-white text-base">{t('stats.details')}</h3>
         <div className="space-y-3">
            {chartData.sort((a, b) => b.value - a.value).map((item, idx) => (
              <div key={item.name} className="flex justify-between items-center animate-slide-in-right p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className="flex items-center gap-3">
                   <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                   <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{item.name}</span>
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white">Rp {item.value.toLocaleString()}</span>
              </div>
            ))}
         </div>
      </div>

      {/* AI Advisor Button */}
      <button
        onClick={handleAskAI}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 rounded-[2rem] shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-4 ios-touch-target hover:scale-[1.01] transition-transform"
      >
        <div className="p-2 bg-white/20 rounded-full backdrop-blur-md">
           <Sparkles size={20} className="animate-pulse text-yellow-200" />
        </div>
        <div className="text-left">
          <p className="font-bold text-base">{t('stats.advisor.btn')}</p>
          <p className="text-[10px] opacity-80 text-indigo-100 font-medium">{t('stats.advisor.desc')}</p>
        </div>
      </button>

      {/* AI Modal */}
      {isAdvisorOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md w-full animate-ios-fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden page-slide-up max-h-[80vh] flex flex-col m-0 sm:m-4">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-1.5 rounded-full">
                  <Bot size={20} />
                </div>
                <h3 className="font-bold text-base">FinBot Advisor</h3>
              </div>
              <button onClick={() => setIsAdvisorOpen(false)} aria-label="Close advisor" className="hover:bg-white/20 p-2 rounded-full ios-touch-target transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto min-h-[200px]">
              {loadingAdvice ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-5">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-medium text-gray-500 animate-pulse">Sedang menganalisis keuanganmu...</p>
                </div>
              ) : (
                <div className="prose dark:prose-invert text-xs animate-ios-fade-in">
                   <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl mb-4">
                      <p className="whitespace-pre-line text-gray-800 dark:text-gray-200 leading-relaxed font-medium text-sm">
                        {advice}
                      </p>
                   </div>
                   <div className="flex items-center gap-2 justify-center mt-6">
                      <Sparkles size={10} className="text-indigo-400" />
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                        Powered by Google AI
                      </p>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stats;