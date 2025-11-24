import React, { useState, useEffect, useRef } from 'react';
import { Category, Transaction, TransactionItem } from '../types';
import { Camera, Plus, Trash2, Save, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { scanReceipt } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

interface AddTransactionProps {
  categories: Category[];
  onSave: (tx: Transaction) => Promise<void>; 
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const AddTransaction: React.FC<AddTransactionProps> = ({ categories, onSave, addToast }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const getLocalISOString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Form State
  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState<TransactionItem[]>([
    { id: 'init_1', name: '', qty: 1, price: 0 }
  ]);
  const [date, setDate] = useState(getLocalISOString());
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  // Initialize category based on default type
  const [categoryId, setCategoryId] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Connecting...');

  // Effect: Sync Category with Type (Simplified to avoid loops)
  useEffect(() => {
    // Only update if current category is invalid for the new type
    const currentCat = categories.find(c => c.id === categoryId);
    if (!currentCat || currentCat.type !== txType) {
        const firstValid = categories.find(c => c.type === txType);
        if (firstValid) {
            setCategoryId(firstValid.id);
        }
    }
  }, [txType, categories]); // Removed categoryId from deps

  // Robust Total Calculation
  const totalAmount = items.reduce((sum, item) => {
      const q = Number(item.qty) || 0;
      const p = Number(item.price) || 0;
      return sum + (q * p);
  }, 0);

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(36).substring(7), name: '', qty: 1, price: 0 }]);
  };

  const updateItem = (id: string, field: keyof TransactionItem, value: any) => {
    setItems(items.map(item => {
        if (item.id !== id) return item;
        
        let safeValue = value;
        if (field === 'qty' || field === 'price') {
            // Allow empty string for better typing experience, but convert to number for storage/calc
            if (value === '') safeValue = '';
            else {
               // Ensure valid number parsing
               const parsed = parseFloat(value);
               safeValue = isNaN(parsed) ? 0 : parsed;
            }
        }
        return { ...item, [field]: safeValue };
    }));
  };

  const removeItem = (id: string) => {
      if (items.length > 1) {
        setItems(items.filter(item => item.id !== id));
      } else {
        // Don't remove last item, just clear it
        setItems([{ id: Math.random().toString(36).substring(7), name: '', qty: 1, price: 0 }]);
      }
  };

  const handleSave = async () => {
    if (!storeName || items.length === 0) return;
    setIsSaving(true);
    
    // Fallback if categoryId is somehow empty
    const currentCat = categories.find(c => c.id === categoryId);
    const categoryName = currentCat ? currentCat.name : (categories.find(c => c.type === txType)?.name || 'General');
    
    const finalDate = new Date(date).toISOString();

    await onSave({
      id: Math.random().toString(36).substring(7),
      storeName: storeName.trim(),
      items: items.map(i => ({
          ...i, 
          qty: Number(i.qty) || 0, 
          price: Number(i.price) || 0
      })),
      totalAmount: Number(totalAmount), // Ensure it's a number
      date: finalDate,
      category: categoryName,
      type: txType
    });
    
    setIsSaving(false);
    navigate('/');
  };

  const handleScanClick = () => fileInputRef.current?.click();
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processReceipt(file);
      e.target.value = '';
    }
  };

  const processReceipt = async (file: File) => {
    setIsScanning(true);
    setScanStatus("Analyzing with AI...");
    try {
      const data = await scanReceipt(file);
      if (data) { 
        populateFromScan(data); 
        if(addToast) addToast('Scan Success!', 'success'); 
      } else { 
        throw new Error("Empty response from AI"); 
      }
    } catch (error) {
      console.error("Gemini Scan Error:", error);
      if(addToast) addToast('Sorry, The SCAN Offline', 'error');
    } finally { 
      setIsScanning(false); 
    }
  };

  const populateFromScan = (data: any) => {
      const rawStoreName = data.store?.name || data.store_name;
      if (rawStoreName) setStoreName(rawStoreName);
      
      const rawDate = data.store?.transaction_date || data.transaction_date;
      if (rawDate) {
        try {
            // Attempt to parse date
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setDate(`${year}-${month}-${day}T12:00`);
            }
        } catch (e) {}
      }

      const rawItems = data.items;
      if (rawItems && Array.isArray(rawItems)) {
          setItems(rawItems.map((item: any) => ({
              id: Math.random().toString(36).substring(7),
              name: item.item_name || item.name || "Item",
              qty: Number(item.quantity) || 1,
              price: Number(item.unit_price) || (Number(item.total_price)/Number(item.quantity)) || 0
          })));
      } 
      
      autoCategorize(rawStoreName || '');
  };

  const autoCategorize = (store: string) => {
      const lower = (store || '').toLowerCase();
      // Heuristic for categorizing based on store name
      let foundCat = categories.find(c => c.type === 'expense' && lower.includes(c.name.toLowerCase()));
      if (foundCat) setCategoryId(foundCat.id);
  };

  // Get categories relevant to current type
  const availableCategories = categories.filter(c => c.type === txType);

  if (isScanning) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black w-full">
         <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-80"></div>
         <div className="relative z-10 flex flex-col items-center p-6 text-center">
            <div className="relative w-24 h-24 mb-6">
               <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="text-blue-400 animate-pulse" size={32} />
               </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">AI Analysis</h2>
            <p className="text-gray-400 text-sm">{scanStatus}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="pt-safe min-h-screen bg-[#F2F2F7] dark:bg-black pb-32 page-slide-up">
      
      <div className="px-6 py-6 pb-4 md:px-0">
        <h1 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">{t('add.title')}</h1>
      </div>

      <div className="px-4 space-y-6 md:px-0">
        
        {/* Type Toggle */}
        <div className="bg-white dark:bg-[#1C1C1E] p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex">
            <button 
                onClick={() => setTxType('expense')} 
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ios-touch-target ${
                    txType === 'expense' 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                {t('add.expense')}
            </button>
            <button 
                onClick={() => setTxType('income')} 
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ios-touch-target ${
                    txType === 'income' 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                {t('add.income')}
            </button>
        </div>

        {/* Camera (Only show for Expense) */}
        {txType === 'expense' && (
            <>
                <button 
                onClick={handleScanClick}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white p-5 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-between group ios-touch-target hover:shadow-xl"
                >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                    <Camera size={24} />
                    </div>
                    <div className="text-left">
                    <p className="font-bold text-lg">{t('add.scan')}</p>
                    <p className="text-xs text-blue-100">{t('add.scan.ai')}</p>
                    </div>
                </div>
                </button>
                <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                capture="environment" 
                onChange={handleFileChange} 
                />
            </>
        )}

        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 animate-slide-in-right">
           <div className="mb-6">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">
                  {txType === 'income' ? 'Sumber Pemasukan' : t('add.store')}
              </label>
              <input 
                type="text" 
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder={txType === 'income' ? "e.g. Gaji Bulanan" : "e.g. Starbucks"}
                className="w-full text-2xl font-bold bg-transparent border-b border-gray-100 dark:border-gray-800 py-2 focus:outline-none focus:border-blue-500 dark:text-white placeholder-gray-300 transition-colors"
              />
           </div>

           <div className="space-y-4">
              <div className="flex justify-between items-end pb-2">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('add.items')}</label>
                 <button onClick={addItem} className="text-blue-500 text-sm font-bold flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-lg transition-colors ios-touch-target">
                   <Plus size={16} /> {t('add.addItem')}
                 </button>
              </div>

              {items.map((item) => (
                <div key={item.id} className="flex gap-2 items-start animate-slide-in-right">
                   <div className="flex-1 space-y-2 bg-gray-50 dark:bg-black/30 p-3 rounded-xl">
                      <input 
                        className="w-full bg-transparent font-semibold text-sm focus:outline-none dark:text-white"
                        placeholder={txType === 'income' ? "Keterangan" : "Item Name"}
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                      />
                      <div className="flex gap-2">
                         <input 
                            type="number"
                            className="w-16 bg-white dark:bg-gray-800 rounded-lg text-center text-sm py-1 font-bold dark:text-white border border-transparent focus:border-blue-500 focus:outline-none"
                            placeholder="Qty"
                            value={item.qty === 0 ? '' : item.qty}
                            onChange={e => updateItem(item.id, 'qty', e.target.value)}
                         />
                         <div className="flex-1 relative">
                            <span className="absolute left-2 top-1.5 text-xs text-gray-400">Rp</span>
                            <input 
                               type="number"
                               className="w-full bg-white dark:bg-gray-800 rounded-lg pl-8 py-1 text-sm font-bold dark:text-white focus:outline-none border border-transparent focus:border-blue-500"
                               placeholder="0"
                               value={item.price === 0 ? '' : item.price}
                               onChange={e => updateItem(item.id, 'price', e.target.value)}
                            />
                         </div>
                      </div>
                   </div>
                   <button onClick={() => removeItem(item.id)} className="mt-4 text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ios-touch-target"><Trash2 size={18}/></button>
                </div>
              ))}
           </div>

           <div className="mt-8 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <span className="font-bold text-gray-500">{t('add.total')}</span>
              <span className={`text-2xl font-black ${txType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  Rp {totalAmount.toLocaleString('id-ID')}
              </span>
           </div>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-800 animate-slide-in-right" style={{animationDelay: '0.1s'}}>
           <div className="flex flex-col md:flex-row">
              <div className="flex-1 p-4 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800">
                 <label className="text-xs font-bold text-gray-400 uppercase block mb-1">{t('add.date')}</label>
                 <input 
                   type="datetime-local" 
                   value={date}
                   onChange={e => setDate(e.target.value)}
                   className="w-full bg-transparent font-semibold text-sm focus:outline-none dark:text-white"
                 />
              </div>
              <div className="flex-1 p-4">
                 <label className="text-xs font-bold text-gray-400 uppercase block mb-1">{t('add.category')}</label>
                 <select 
                   value={categoryId} 
                   onChange={e => setCategoryId(e.target.value)}
                   className="w-full bg-transparent font-semibold text-sm focus:outline-none dark:text-white appearance-none cursor-pointer"
                 >
                    {availableCategories.length > 0 ? (
                        availableCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)
                    ) : (
                        <option value="" disabled>No Categories</option>
                    )}
                 </select>
              </div>
           </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={totalAmount === 0 || !storeName || isSaving}
          className={`w-full text-white py-4 rounded-2xl font-bold text-lg shadow-xl ios-touch-target disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 ${
              txType === 'income' 
              ? 'bg-green-600 shadow-green-500/20 hover:bg-green-700' 
              : 'bg-primary shadow-blue-500/20 hover:bg-blue-600'
          }`}
        >
          {isSaving ? (
            <>{t('add.saving')}</>
          ) : (
            <>{t('add.save')}</>
          )}
        </button>

      </div>
    </div>
  );
};

export default AddTransaction;