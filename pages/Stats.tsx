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
    <div className="p-6 pb-24 min-h-screen space-y-6 bg-gray-50 dark:bg-dark">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{t('stats.title')}</h1>

      {/* Pie Chart Card */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 text-center">{t('stats.dist')}</h3>
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <RechartsTooltip 
                   formatter={(value: number) => `Rp ${value.toLocaleString()}`}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              {t('stats.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Top Categories List */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
         <h3 className="font-semibold mb-4 dark:text-white">{t('stats.details')}</h3>
         <div className="space-y-4">
            {chartData.sort((a, b) => b.value - a.value).map((item, idx) => (
              <div key={item.name} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                   <span className="text-sm font-medium dark:text-gray-300">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-white">Rp {item.value.toLocaleString()}</span>
              </div>
            ))}
         </div>
      </div>

      {/* AI Advisor Button */}
      <button
        onClick={handleAskAI}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform"
      >
        <Sparkles size={24} className="animate-pulse" />
        <div className="text-left">
          <p className="font-bold text-lg">{t('stats.advisor.btn')}</p>
          <p className="text-xs opacity-90 text-indigo-100">{t('stats.advisor.desc')}</p>
        </div>
      </button>

      {/* AI Modal */}
      {isAdvisorOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 w-full max-w-[480px] mx-auto left-0 right-0">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Bot size={24} />
                <h3 className="font-bold">FinBot Advisor</h3>
              </div>
              <button onClick={() => setIsAdvisorOpen(false)} className="hover:bg-white/20 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 min-h-[200px] max-h-[60vh] overflow-y-auto">
              {loadingAdvice ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-500 animate-pulse">Sedang menganalisis keuanganmu...</p>
                </div>
              ) : (
                <div className="prose dark:prose-invert text-sm">
                   <p className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
                     {advice}
                   </p>
                   <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800">
                      <p className="text-xs text-indigo-600 dark:text-indigo-300 italic">
                        *Saran ini dibuat oleh AI berdasarkan data transaksi Anda.
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