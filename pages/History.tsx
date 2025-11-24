import React, { useState } from 'react';
import { Transaction } from '../types';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface HistoryProps {
  transactions: Transaction[];
}

const HistoryPage: React.FC<HistoryProps> = ({ transactions }) => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransactions = transactions
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => t.storeName.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Helper functions
  const isToday = (d: Date) => {
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const groupedTransactions: Record<string, Transaction[]> = {};
  filteredTransactions.forEach(tx => {
    const date = new Date(tx.date);
    let key = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    if (isToday(date)) key = 'Today';
    if (!groupedTransactions[key]) groupedTransactions[key] = [];
    groupedTransactions[key].push(tx);
  });

  return (
    <div className="pt-safe min-h-screen bg-[#F2F2F7] dark:bg-black animate-fade-in">
      {/* Title */}
      <div className="px-6 py-6 pb-2">
        <h1 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">{t('hist.title')}</h1>
      </div>

      {/* Search & Filter */}
      <div className="px-4 mb-4">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl p-2 flex items-center shadow-sm mb-4">
           <Search className="text-gray-400 ml-2" size={18} />
           <input 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             placeholder={t('hist.search')}
             className="w-full bg-transparent border-none focus:outline-none px-3 text-sm dark:text-white h-8"
           />
        </div>
        
        <div className="flex gap-2">
           {['all', 'expense', 'income'].map(f => (
             <button
               key={f}
               onClick={() => setFilter(f as any)}
               className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${filter === f ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-[#1C1C1E] text-gray-500'}`}
             >
               {f === 'all' ? t('hist.filter.all') : f === 'expense' ? t('add.expense') : t('add.income')}
             </button>
           ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pb-32 space-y-6">
        {Object.entries(groupedTransactions).map(([date, txs]) => (
          <div key={date}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-2 mb-2">{date}</h3>
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm">
              {txs.map((tx, idx) => (
                <div key={tx.id}>
                  <div className="p-4 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {tx.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{tx.storeName}</p>
                        <p className="text-xs text-gray-400">{tx.category} • {new Date(tx.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'} {tx.totalAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                  {idx < txs.length - 1 && <hr className="border-gray-100 dark:border-gray-800 ml-16" />}
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(groupedTransactions).length === 0 && (
           <div className="text-center py-20 text-gray-400">
              <p>{t('hist.noFound')}</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;