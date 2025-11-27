
import React, { useState } from 'react';
import { Transaction } from '../types';
import { Search, ArrowUpRight, ArrowDownLeft, Trash2, Check, CheckCircle2, Circle, AlertCircle, Edit2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface HistoryProps {
  transactions: Transaction[];
  onDelete: (ids: string[]) => Promise<void>;
}

const HistoryPage: React.FC<HistoryProps> = ({ transactions, onDelete }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const filteredTransactions = transactions
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => t.storeName.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } else {
      setIsSelectionMode(true);
    }
  };

  const toggleSelectId = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
        await onDelete([itemToDelete]);
        setItemToDelete(null);
    } else if (selectedIds.size > 0) {
        await onDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    }
    setIsConfirmOpen(false);
  };

  return (
    <div className="pt-safe min-h-screen page-transition">
      <div className="px-6 py-6 pb-2 flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-black dark:text-white tracking-tight">{t('hist.title')}</h1>
        <button 
          onClick={toggleSelectionMode}
          className={`text-sm font-bold ios-touch-target px-3 py-1 rounded-full transition-colors ${
            isSelectionMode 
              ? 'text-primary bg-blue-50 dark:bg-blue-900/20' 
              : 'text-primary'
          }`}
        >
          {isSelectionMode ? t('common.cancel') : 'Pilih'}
        </button>
      </div>

      {!isSelectionMode && (
        <div className="px-4 mb-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-2.5 flex items-center shadow-sm mb-3 border border-gray-100 dark:border-white/5 transition-colors focus-within:ring-2 focus-within:ring-primary/20">
             <Search className="text-gray-400 ml-2" size={16} />
             <input 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               placeholder={t('hist.search')}
               className="w-full bg-transparent border-none focus:outline-none px-3 text-sm dark:text-white h-full font-medium placeholder-gray-400"
             />
          </div>
          
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
             {['all', 'expense', 'income'].map(f => (
               <button
                 key={f}
                 onClick={() => setFilter(f as any)}
                 className={`px-4 py-1.5 rounded-full text-[10px] font-bold capitalize transition-all ios-touch-target ${filter === f ? 'bg-primary text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-[#1C1C1E] text-gray-500 border border-gray-100 dark:border-white/5'}`}
               >
                 {f === 'all' ? t('hist.filter.all') : f === 'expense' ? t('add.expense') : t('add.income')}
               </button>
             ))}
          </div>
        </div>
      )}

      {isSelectionMode && (
        <div className="px-6 mb-4 animate-slide-in-right">
           <p className="text-sm font-semibold text-gray-500">
             {selectedIds.size} transaksi dipilih
           </p>
        </div>
      )}

      <div className="px-4 pb-32 space-y-5">
        {Object.entries(groupedTransactions).map(([date, txs], groupIdx) => (
          <div key={date} className="animate-slide-in-right" style={{ animationDelay: `${groupIdx * 0.05}s` }}>
            <h2 className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide ml-3 mb-2">{date}</h2>
            <div className="bg-white dark:bg-[#1C1C1E] rounded-[1.25rem] overflow-hidden shadow-sm border border-gray-100 dark:border-white/5">
              {txs.map((tx, idx) => {
                const isSelected = selectedIds.has(tx.id);
                return (
                  <div key={tx.id}>
                    <div 
                      onClick={() => {
                          if (isSelectionMode) toggleSelectId(tx.id);
                          else navigate(`/edit/${tx.id}`);
                      }}
                      className={`p-3.5 flex items-center justify-between transition-all duration-300 ios-touch-target ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-900/10' 
                          : 'active:bg-gray-50 dark:active:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <div 
                          className={`transition-all duration-300 overflow-hidden ${
                            isSelectionMode ? 'w-6 opacity-100 mr-2' : 'w-0 opacity-0 mr-0'
                          }`}
                        >
                           {isSelected ? (
                             <CheckCircle2 className="text-primary fill-blue-100 dark:fill-blue-900" size={24} />
                           ) : (
                             <Circle className="text-gray-300 dark:text-gray-600" size={24} />
                           )}
                        </div>

                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                          {tx.type === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div className="truncate flex-1 pr-2">
                          <p className={`font-bold text-sm text-gray-900 dark:text-white leading-tight mb-0.5 truncate ${isSelected ? 'text-primary dark:text-blue-400' : ''}`}>{tx.storeName}</p>
                          <p className="text-[10px] text-gray-600 dark:text-gray-400 font-medium truncate">{tx.category} • {new Date(tx.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                          <span className={`font-bold text-sm whitespace-nowrap ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {tx.type === 'income' ? '+' : '-'} {tx.totalAmount.toLocaleString('id-ID')}
                          </span>
                          
                          {!isSelectionMode && (
                              <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setItemToDelete(tx.id);
                                      setIsConfirmOpen(true);
                                  }}
                                  aria-label="Delete transaction"
                                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors ios-touch-target"
                              >
                                  <Trash2 size={14} />
                              </button>
                          )}
                      </div>
                    </div>
                    {idx < txs.length - 1 && <hr className={`border-gray-100 dark:border-white/5 ${isSelectionMode ? 'ml-14' : 'ml-14'}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(groupedTransactions).length === 0 && (
           <div className="text-center py-20 text-gray-400 flex flex-col items-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                 <Search size={20} className="opacity-50" />
              </div>
              <p className="text-xs font-medium">{t('hist.noFound')}</p>
           </div>
        )}
      </div>

      <div className={`fixed bottom-20 left-0 right-0 p-6 transition-transform duration-500 z-40 ${isSelectionMode && selectedIds.size > 0 ? 'translate-y-0' : 'translate-y-[200%]'}`}>
         <button 
           onClick={() => setIsConfirmOpen(true)}
           className="w-full max-w-md mx-auto bg-red-500 text-white shadow-xl shadow-red-500/30 rounded-2xl py-3.5 font-bold flex items-center justify-center gap-2 active:scale-95 transition-all ios-touch-target"
         >
            <Trash2 size={18} />
            Hapus ({selectedIds.size})
         </button>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 w-full animate-fade-in">
           <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-xs p-6 rounded-[2rem] shadow-2xl animate-shake text-center page-slide-up">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertCircle size={24} />
              </div>
              <h2 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
                  {itemToDelete ? "Hapus Transaksi?" : `Hapus ${selectedIds.size} Transaksi?`}
              </h2>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Data akan dihapus dari penyimpanan lokal dan Google Sheets (jika terhubung).
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => { setIsConfirmOpen(false); setItemToDelete(null); }} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-300 ios-touch-target">
                  {t('common.cancel')}
                </button>
                <button onClick={handleDeleteConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-xs hover:bg-red-600 transition-colors ios-touch-target">
                  Ya, Hapus
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
