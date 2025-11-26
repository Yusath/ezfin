import React, { useState, useEffect, useRef } from 'react';
import { Category, Transaction, TransactionItem } from '../types';
import { Camera, Plus, Trash2, Sparkles, ChevronLeft, Upload, ScanLine, Image as ImageIcon, ChevronDown, Check, X, Grid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { scanReceipt } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

interface AddTransactionProps {
  categories: Category[];
  onSave: (tx: Transaction) => Promise<void>; 
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  initialData?: Transaction;
}

const AddTransaction: React.FC<AddTransactionProps> = ({ categories, onSave, addToast, initialData }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // Separate Refs for different inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
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
  const [storeName, setStoreName] = useState(initialData?.storeName || '');
  const [items, setItems] = useState<TransactionItem[]>(initialData?.items || [
    { id: 'init_1', name: '', qty: 1, price: 0 }
  ]);
  const [incomeAmount, setIncomeAmount] = useState<string>(initialData && initialData.type === 'income' ? initialData.totalAmount.toString() : '');
  const [date, setDate] = useState(initialData ? initialData.date.substring(0, 16) : getLocalISOString());
  const [txType, setTxType] = useState<'expense' | 'income'>(initialData?.type || 'expense');
  const [categoryId, setCategoryId] = useState('');

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Connecting...');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Initialize Category from initialData
  useEffect(() => {
    if (initialData) {
      const cat = categories.find(c => c.name === initialData.category && c.type === initialData.type);
      if (cat) {
        setCategoryId(cat.id);
      } else {
        // Fallback for custom categories or mismatch, try finding by name only
        const anyCat = categories.find(c => c.name === initialData.category);
        if (anyCat) setCategoryId(anyCat.id);
      }
    }
  }, [initialData, categories]);

  // Sync Category with Type (Only if not initial load or manual type switch)
  useEffect(() => {
    // Prevent overriding if we just loaded initialData which might have set a category
    // But since txType changes, we need to check if current category is valid for new type
    const currentCat = categories.find(c => c.id === categoryId);
    
    // If current category doesn't match the selected type, switch to default
    if (!currentCat || currentCat.type !== txType) {
        const firstValid = categories.find(c => c.type === txType);
        if (firstValid) {
            setCategoryId(firstValid.id);
        }
    }
  }, [txType, categories]);

  // Robust Total Calculation
  const calculateTotal = () => {
    if (txType === 'income') {
        return Number(incomeAmount) || 0;
    }
    return items.reduce((sum, item) => {
      const q = Number(item.qty) || 0;
      const p = Number(item.price) || 0;
      return sum + (q * p);
    }, 0);
  };

  const totalAmount = calculateTotal();

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(36).substring(7), name: '', qty: 1, price: 0 }]);
  };

  const updateItem = (id: string, field: keyof TransactionItem, value: any) => {
    setItems(items.map(item => {
        if (item.id !== id) return item;
        
        let safeValue = value;
        if (field === 'qty' || field === 'price') {
            if (value === '') safeValue = '';
            else {
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
        setItems([{ id: Math.random().toString(36).substring(7), name: '', qty: 1, price: 0 }]);
      }
  };

  const handleSave = async () => {
    if (!storeName) return;
    if (txType === 'expense' && items.length === 0) return;
    
    setIsSaving(true);
    
    const currentCat = categories.find(c => c.id === categoryId);
    const categoryName = currentCat ? currentCat.name : (categories.find(c => c.type === txType)?.name || 'General');
    const finalDate = new Date(date).toISOString();

    // Prepare Items
    let finalItems: TransactionItem[] = [];
    if (txType === 'income') {
        // Construct a dummy item for income to satisfy type requirements
        finalItems = [{
            id: Math.random().toString(36).substring(7),
            name: storeName, // Use source name as item name
            qty: 1,
            price: Number(incomeAmount) || 0
        }];
    } else {
        finalItems = items.map(i => ({
          ...i, 
          qty: Number(i.qty) || 0, 
          price: Number(i.price) || 0
      }));
    }

    await onSave({
      id: initialData ? initialData.id : Math.random().toString(36).substring(7),
      storeName: storeName.trim(),
      items: finalItems,
      totalAmount: Number(totalAmount),
      date: finalDate,
      category: categoryName,
      type: txType
    });
    
    setIsSaving(false);
    navigate(-1);
  };

  // --- AI SCANNING LOGIC ---
  const handleUploadClick = () => fileInputRef.current?.click();
  const handleCameraClick = () => cameraInputRef.current?.click();
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processReceipt(file);
      e.target.value = ''; // Reset input
    }
  };

  const processReceipt = async (file: File) => {
    setIsScanning(true);
    setScanStatus("Menganalisis Struk...");
    try {
      const data = await scanReceipt(file);
      if (data) { 
        populateFromScan(data); 
        if(addToast) addToast('Scan Berhasil! Data terisi.', 'success'); 
      } else { 
        throw new Error("Empty response from AI"); 
      }
    } catch (error) {
      console.error("Gemini Scan Error:", error);
      if(addToast) addToast('Gagal memproses struk. Coba lagi.', 'error');
    } finally { 
      setIsScanning(false); 
    }
  };

  const populateFromScan = (data: any) => {
      if (data.store_name) setStoreName(data.store_name);
      
      if (data.transaction_date) {
        try {
            const d = new Date(data.transaction_date);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setDate(`${year}-${month}-${day}T12:00`);
            }
        } catch (e) {}
      }

      const rawItems = data.items;
      if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
          setItems(rawItems.map((item: any) => ({
              id: Math.random().toString(36).substring(7),
              name: item.name || "Item",
              qty: Number(item.qty) || Number(item.quantity) || 1,
              price: Number(item.price) || Number(item.unit_price) || 0
          })));
      } 
      
      if (data.store_name) autoCategorize(data.store_name);
  };

  const autoCategorize = (store: string) => {
      const lower = (store || '').toLowerCase();
      let foundCat = categories.find(c => c.type === 'expense' && lower.includes(c.name.toLowerCase()));
      if (foundCat) setCategoryId(foundCat.id);
  };

  const availableCategories = categories.filter(c => c.type === txType);
  const selectedCategory = categories.find(c => c.id === categoryId);

  // --- RENDERING ---

  if (isScanning) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 w-full backdrop-blur-sm animate-ios-fade-in">
         <div className="relative z-10 flex flex-col items-center p-6 text-center">
            <div className="relative w-20 h-20 mb-6">
               <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="text-blue-400 animate-pulse" size={28} />
               </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">AI Sedang Bekerja</h2>
            <p className="text-gray-400 text-xs font-medium animate-pulse">{scanStatus}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="pt-safe min-h-screen bg-[#F2F2F7] dark:bg-black pb-32 page-slide-up">
      
      {/* Header */}
      <div className="px-4 py-4 md:py-8 flex items-center justify-between">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-white/10 ios-touch-target">
           <div className="flex items-center gap-1 font-semibold text-sm">
              <ChevronLeft size={22} />
              <span>Kembali</span>
           </div>
         </button>
         <h1 className="text-lg font-bold text-black dark:text-white absolute left-1/2 transform -translate-x-1/2">
             {initialData ? 'Edit Transaksi' : t('add.title')}
         </h1>
         <div className="w-10"></div>
      </div>

      <div className="px-4 space-y-6 md:max-w-xl md:mx-auto">
        
        {/* Type Toggle */}
        <div className="bg-white dark:bg-[#1C1C1E] p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex">
            <button 
                onClick={() => setTxType('expense')} 
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ios-touch-target ${
                    txType === 'expense' 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                {t('add.expense')}
            </button>
            <button 
                onClick={() => setTxType('income')} 
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ios-touch-target ${
                    txType === 'income' 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                {t('add.income')}
            </button>
        </div>

        {/* --- DUAL BUTTON SCANNER (Expense Only) --- */}
        {txType === 'expense' && !initialData && (
          <div className="animate-slide-in-right">
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Metode Input</span>
                <span className="text-[10px] font-medium text-blue-500 flex items-center gap-1"><Sparkles size={10}/> AI Support</span>
            </div>
            <div className="flex gap-4 h-20">
                {/* Button 1: Upload Document */}
                <button 
                  onClick={handleUploadClick}
                  className="flex-1 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-[1.25rem] shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-1.5 group relative overflow-hidden"
                >
                    <div className="w-7 h-7 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload size={16} className="text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="text-center z-10">
                        <span className="block font-bold text-gray-900 dark:text-white text-[10px]">Upload File</span>
                    </div>
                </button>

                {/* Button 2: Camera Direct */}
                <button 
                  onClick={handleCameraClick}
                  className="flex-1 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-[1.25rem] shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex flex-col items-center justify-center gap-1.5 group relative overflow-hidden"
                >
                    {/* Decorative bg elements */}
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl"></div>
                    
                    <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:rotate-12 transition-transform">
                        <ScanLine size={16} className="text-white" />
                    </div>
                    <div className="text-center z-10">
                        <span className="block font-bold text-white text-[10px]">Scan Kamera</span>
                    </div>
                </button>
            </div>

            {/* Hidden Inputs */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,application/pdf" 
              onChange={handleFileChange} 
            />
            <input 
              type="file" 
              ref={cameraInputRef} 
              className="hidden" 
              accept="image/*" 
              capture="environment" 
              onChange={handleFileChange} 
            />
          </div>
        )}

        {/* Transaction Details Form */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800 animate-slide-in-right" style={{animationDelay: '0.1s'}}>
           <div className="mb-6">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">
                  {txType === 'income' ? 'Sumber Pemasukan' : t('add.store')}
              </label>
              <input 
                type="text" 
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder={txType === 'income' ? "e.g. Gaji Bulanan" : "e.g. Starbucks"}
                className="w-full text-xl font-bold bg-transparent border-b border-gray-100 dark:border-gray-800 py-2 focus:outline-none focus:border-blue-500 dark:text-white placeholder-gray-300 transition-colors"
              />
           </div>

           {txType === 'expense' ? (
               <div className="space-y-4">
                  <div className="flex justify-between items-end pb-2 border-b border-gray-100 dark:border-white/5">
                     <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('add.items')}</label>
                     <button onClick={addItem} className="text-blue-500 text-xs font-bold flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-lg transition-colors ios-touch-target">
                       <Plus size={14} /> {t('add.addItem')}
                     </button>
                  </div>

                  {items.map((item, idx) => (
                    <div key={item.id} className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl relative animate-slide-in-right" style={{animationDelay: `${idx * 0.05}s`}}>
                       <button onClick={() => removeItem(item.id)} className="absolute top-3 right-3 text-red-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ios-touch-target">
                          <Trash2 size={16} />
                       </button>
                       
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Item {idx + 1}</label>
                       
                       <input 
                           className="w-full bg-transparent text-base font-bold border-b border-gray-200 dark:border-white/10 py-1.5 mb-3 focus:outline-none focus:border-blue-500 dark:text-white placeholder-gray-300"
                           placeholder="Nama Barang"
                           value={item.name}
                           onChange={e => updateItem(item.id, 'name', e.target.value)}
                       />
                       
                       <div className="flex gap-4">
                          <div className="w-1/3">
                             <label className="text-[10px] text-gray-400 block mb-1">Qty</label>
                             <input 
                                type="number"
                                className="w-full bg-white dark:bg-black/20 rounded-xl p-2 font-bold text-center text-sm dark:text-white border border-transparent focus:border-blue-500 focus:outline-none shadow-sm"
                                placeholder="1"
                                value={item.qty === 0 ? '' : item.qty}
                                onChange={e => updateItem(item.id, 'qty', e.target.value)}
                             />
                          </div>
                          <div className="flex-1">
                             <label className="text-[10px] text-gray-400 block mb-1">Harga Satuan</label>
                             <div className="relative">
                                <span className="absolute left-3 top-2 text-xs text-gray-400 font-bold">Rp</span>
                                <input 
                                   type="number"
                                   className="w-full bg-white dark:bg-black/20 rounded-xl py-2 pl-9 pr-3 text-sm font-bold dark:text-white focus:outline-none border border-transparent focus:border-blue-500 shadow-sm"
                                   placeholder="0"
                                   value={item.price === 0 ? '' : item.price}
                                   onChange={e => updateItem(item.id, 'price', e.target.value)}
                                />
                             </div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
           ) : (
               /* INCOME MODE: SIMPLE INPUT */
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Jumlah Pemasukan</label>
                     <div className="relative">
                        <span className="absolute left-4 top-3.5 text-lg text-gray-400 font-bold">Rp</span>
                        <input 
                           type="number" 
                           inputMode="numeric"
                           value={incomeAmount}
                           onChange={e => setIncomeAmount(e.target.value)}
                           className="w-full bg-gray-50 dark:bg-black/20 text-3xl font-black rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500/50 dark:text-white placeholder-gray-200 transition-all border border-gray-100 dark:border-white/5 text-green-600 dark:text-green-400"
                           placeholder="0"
                        />
                     </div>
                  </div>
               </div>
           )}

           <div className="mt-8 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <span className="font-bold text-gray-500 text-xs uppercase tracking-wide">{t('add.total')}</span>
              <span className={`text-2xl font-black tracking-tight ${txType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  Rp {totalAmount.toLocaleString('id-ID')}
              </span>
           </div>
        </div>

        {/* Date & Category Selection Row */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[2rem] p-1 shadow-sm border border-gray-100 dark:border-gray-800 animate-slide-in-right" style={{animationDelay: '0.2s'}}>
           <div className="flex flex-col md:flex-row">
              <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800">
                 <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">{t('add.date')}</label>
                 <input 
                   type="datetime-local" 
                   value={date}
                   onChange={e => setDate(e.target.value)}
                   className="w-full bg-transparent font-bold text-sm focus:outline-none dark:text-white p-1"
                 />
              </div>
              
              {/* iOS Style Custom Dropdown Trigger */}
              <div 
                className="flex-1 p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors rounded-b-[2rem] md:rounded-bl-none md:rounded-r-[2rem] ios-touch-target"
                onClick={() => setShowCategoryPicker(true)}
              >
                 <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">{t('add.category')}</label>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       {selectedCategory ? (
                         <>
                            <span className="text-lg">{selectedCategory.icon}</span>
                            <span className="font-bold text-sm dark:text-white">{selectedCategory.name}</span>
                         </>
                       ) : (
                         <span className="font-bold text-sm text-gray-300">Pilih Kategori</span>
                       )}
                    </div>
                    <ChevronDown size={16} className="text-gray-400" />
                 </div>
              </div>
           </div>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          disabled={totalAmount === 0 || !storeName || isSaving}
          className={`w-full text-white py-3.5 rounded-[1.5rem] font-bold text-base shadow-xl ios-touch-target disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 mb-10 ${
              txType === 'income' 
              ? 'bg-green-600 shadow-green-500/20 hover:bg-green-700' 
              : 'bg-primary shadow-blue-500/20 hover:bg-blue-600'
          }`}
        >
          {isSaving ? (
            <span className="animate-pulse">{initialData ? 'Memperbarui...' : t('add.saving')}</span>
          ) : (
            <>{initialData ? 'Perbarui Transaksi' : t('add.save')}</>
          )}
        </button>

      </div>

      {/* iOS Bottom Sheet: Category Picker */}
      {showCategoryPicker && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
           {/* Backdrop */}
           <div 
             className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
             onClick={() => setShowCategoryPicker(false)}
           ></div>

           {/* Sheet */}
           <div className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] rounded-t-[2rem] shadow-2xl animate-ios-slide-up flex flex-col max-h-[75vh]">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1" onClick={() => setShowCategoryPicker(false)}>
                 <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
              </div>
              
              <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 dark:border-white/5">
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Grid size={18} />
                    Pilih Kategori
                 </h3>
                 <button onClick={() => setShowCategoryPicker(false)} className="bg-gray-100 dark:bg-white/10 p-2 rounded-full ios-touch-target">
                    <X size={16} className="text-gray-500 dark:text-gray-300" />
                 </button>
              </div>

              {/* List */}
              <div className="overflow-y-auto p-4 space-y-2 pb-safe">
                 {availableCategories.length > 0 ? (
                    availableCategories.map((cat) => {
                       const isSelected = cat.id === categoryId;
                       return (
                         <button
                           key={cat.id}
                           onClick={() => {
                              setCategoryId(cat.id);
                              setShowCategoryPicker(false);
                           }}
                           className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ios-touch-target border ${
                              isSelected 
                                ? 'bg-primary/10 border-primary text-primary' 
                                : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                           }`}
                         >
                            <div className="flex items-center gap-4">
                               <span className="text-2xl">{cat.icon}</span>
                               <span className={`font-bold text-sm ${isSelected ? 'text-primary' : ''}`}>
                                  {cat.name}
                               </span>
                            </div>
                            {isSelected && (
                               <div className="bg-primary text-white p-1 rounded-full">
                                  <Check size={14} strokeWidth={3} />
                               </div>
                            )}
                         </button>
                       )
                    })
                 ) : (
                    <div className="text-center py-10 text-gray-400">
                       <p className="text-sm font-medium">Tidak ada kategori tersedia.</p>
                       <p className="text-xs mt-1">Tambahkan di menu Settings.</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default AddTransaction;