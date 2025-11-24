import React, { useState, useEffect, useRef } from 'react';
import { Category, Transaction, TransactionItem } from '../types';
import { Camera, Plus, Trash2, Save, FileText, Sparkles, WifiOff, AlertTriangle, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { scanReceipt } from '../services/geminiService';
import Tesseract from 'tesseract.js';
import { useLanguage } from '../contexts/LanguageContext';

interface AddTransactionProps {
  categories: Category[];
  onSave: (tx: Transaction) => Promise<void>; // Updated to Promise
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  isOnlineScanEnabled?: boolean;
}

const AddTransaction: React.FC<AddTransactionProps> = ({ categories, onSave, addToast, isOnlineScanEnabled = true }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // FIX: Properly initialize date to user's local time string "YYYY-MM-DDTHH:mm"
  // This prevents the date from defaulting to UTC and potentially showing up as "Yesterday"
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
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [date, setDate] = useState(getLocalISOString());
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [isSaving, setIsSaving] = useState(false);

  // Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Connecting...');
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const totalAmount = items.reduce((sum, item) => sum + (item.qty * item.price), 0);

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(36).substring(7), name: '', qty: 1, price: 0 }]);
  };

  const updateItem = (id: string, field: keyof TransactionItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value === 0 && field === 'qty' ? 0 : value } : item));
  };

  const removeItem = (id: string) => setItems(items.filter(item => item.id !== id));

  const handleSave = async () => {
    if (!storeName || items.length === 0) return;
    setIsSaving(true);
    
    const categoryName = categories.find(c => c.id === categoryId)?.name || 'General';
    
    // Create Date object from local input string (Browser treats "YYYY-MM-DDTHH:mm" as local)
    // Then convert to ISO string for storage. This preserves the exact instant in time.
    const finalDate = new Date(date).toISOString();

    await onSave({
      id: Math.random().toString(36).substring(7),
      storeName: storeName.trim(),
      items,
      totalAmount,
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
    if (!isOnlineScanEnabled) {
      setIsOfflineMode(true);
      setScanStatus("Processing Offline...");
      try { await performOfflineOCR(file); } catch (err) { if(addToast) addToast('Scan Failed', 'error'); } finally { setIsScanning(false); }
      return;
    }
    setIsOfflineMode(false);
    setScanStatus("Analyzing with AI...");
    try {
      const data = await scanReceipt(file);
      if (data) { populateFromScan(data); if(addToast) addToast('Scan Success!', 'success'); } else { throw new Error("Empty"); }
    } catch (error) {
      console.warn("Switching to offline");
      setIsOfflineMode(true);
      setScanStatus("AI Failed. Trying Offline...");
      try { await performOfflineOCR(file); } catch (e) { if(addToast) addToast('Scan Failed', 'error'); }
    } finally { setIsScanning(false); }
  };

  const populateFromScan = (data: any) => {
      const rawStoreName = data.store?.name || data.store_name;
      if (rawStoreName) setStoreName(rawStoreName);
      const rawDate = data.store?.transaction_date || data.transaction_date;
      if (rawDate) {
        try {
          if (rawDate.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
             const parts = rawDate.split(/[-/]/);
             // parts[2] = YYYY, parts[1] = MM, parts[0] = DD
             // Set default time to 12:00
             setDate(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00`);
          } else {
             // If ISO-like or other format
             const d = new Date(rawDate.length === 10 ? rawDate + 'T12:00' : rawDate);
             if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setDate(`${year}-${month}-${day}T12:00`);
             }
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

  const preprocessImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(img.src);
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          const color = avg > 140 ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = color;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = () => resolve(URL.createObjectURL(file));
    });
  };

  const performOfflineOCR = async (file: File) => {
    setScanStatus("Preprocessing Image...");
    const processedImageSrc = await preprocessImage(file);
    setScanStatus("Reading Text...");
    const result = await Tesseract.recognize(processedImageSrc, 'eng');
    parseOfflineText(result.data.text);
  };

  const parseOfflineText = (text: string) => {
      const cleanLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      if (!storeName) {
        for (const line of cleanLines.slice(0, 5)) {
           if (/[a-zA-Z]{3,}/.test(line) && !line.match(/\d{2}\/\d{2}/) && !line.includes('Total')) {
              setStoreName(line.replace(/[^a-zA-Z0-9\s\.\-]/g, '')); break;
           }
        }
      }
      
      let detectedTotal = 0;
      const allNumbers = text.match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?/g) || [];
      const candidates = allNumbers.map(n => parseInt(n.replace(/[^0-9]/g, ''))).filter(n => n > 1000);
      if (candidates.length > 0) detectedTotal = Math.max(...candidates);
      
      if (detectedTotal > 0) {
        setItems([{ id: Math.random().toString(), name: "Total Scan", qty: 1, price: detectedTotal }]);
      } else {
        setItems([{ id: Math.random().toString(), name: "Item", qty: 1, price: 0 }]);
      }
      autoCategorize(storeName || '');
      if (addToast) addToast('Offline Scan Completed', 'info');
  };

  const autoCategorize = (store: string) => {
      const lower = (store || '').toLowerCase();
      let catId = '';
      if (lower.match(/mart|indo|alfa/)) catId = categories.find(c => c.name === 'Belanja')?.id || '';
      else if (lower.match(/cafe|kopi|food/)) catId = categories.find(c => c.name === 'Makanan')?.id || '';
      if (catId) setCategoryId(catId);
  };

  // --- UI RENDER ---

  if (isScanning) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black w-full">
         <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-80"></div>
         <div className="relative z-10 flex flex-col items-center p-6 text-center">
            <div className="relative w-24 h-24 mb-6">
               <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                  {isOfflineMode ? <WifiOff className="text-gray-400" size={32} /> : <Sparkles className="text-blue-400 animate-pulse" size={32} />}
               </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{isOfflineMode ? 'Offline OCR' : 'AI Analysis'}</h2>
            <p className="text-gray-400 text-sm">{scanStatus}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="pt-safe min-h-screen bg-[#F2F2F7] dark:bg-black pb-32 animate-fade-in">
      
      {/* Title */}
      <div className="px-6 py-6 pb-4 md:px-0">
        <h1 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">{t('add.title')}</h1>
      </div>

      <div className="px-4 space-y-6 md:px-0">
        
        {/* Camera Button */}
        <button 
          onClick={handleScanClick}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white p-5 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-between group active:scale-[0.98] transition-all hover:shadow-xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
               {isOnlineScanEnabled ? <Camera size={24} /> : <WifiOff size={24} />}
            </div>
            <div className="text-left">
               <p className="font-bold text-lg">{t('add.scan')}</p>
               <p className="text-xs text-blue-100">{isOnlineScanEnabled ? t('add.scan.ai') : t('add.scan.offline')}</p>
            </div>
          </div>
          <Wifi size={20} className={`opacity-50 ${!isOnlineScanEnabled && 'hidden'}`} />
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

        {/* Main Form Card */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
           
           {/* Store Name */}
           <div className="mb-6">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">{t('add.store')}</label>
              <input 
                type="text" 
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder="e.g. Starbucks"
                className="w-full text-2xl font-bold bg-transparent border-b border-gray-100 dark:border-gray-800 py-2 focus:outline-none focus:border-blue-500 dark:text-white placeholder-gray-300 transition-colors"
              />
           </div>

           {/* Items List */}
           <div className="space-y-4">
              <div className="flex justify-between items-end pb-2">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('add.items')}</label>
                 <button onClick={addItem} className="text-blue-500 text-sm font-bold flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-lg transition-colors">
                   <Plus size={16} /> {t('add.addItem')}
                 </button>
              </div>

              {items.map((item, idx) => (
                <div key={item.id} className="flex gap-2 items-start animate-fade-in-up">
                   <div className="flex-1 space-y-2 bg-gray-50 dark:bg-black/30 p-3 rounded-xl">
                      <input 
                        className="w-full bg-transparent font-semibold text-sm focus:outline-none dark:text-white"
                        placeholder="Item Name"
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                      />
                      <div className="flex gap-2">
                         <input 
                            type="number"
                            className="w-16 bg-white dark:bg-gray-800 rounded-lg text-center text-sm py-1 font-bold dark:text-white border border-transparent focus:border-blue-500 focus:outline-none"
                            placeholder="Qty"
                            value={item.qty || ''}
                            onChange={e => updateItem(item.id, 'qty', parseInt(e.target.value))}
                         />
                         <div className="flex-1 relative">
                            <span className="absolute left-2 top-1.5 text-xs text-gray-400">Rp</span>
                            <input 
                               type="number"
                               className="w-full bg-white dark:bg-gray-800 rounded-lg pl-8 py-1 text-sm font-bold dark:text-white focus:outline-none border border-transparent focus:border-blue-500"
                               placeholder="0"
                               value={item.price || ''}
                               onChange={e => updateItem(item.id, 'price', parseInt(e.target.value))}
                            />
                         </div>
                      </div>
                   </div>
                   <button onClick={() => removeItem(item.id)} className="mt-4 text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={18}/></button>
                </div>
              ))}
           </div>

           {/* Total */}
           <div className="mt-8 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <span className="font-bold text-gray-500">{t('add.total')}</span>
              <span className="text-2xl font-black text-blue-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
           </div>

        </div>

        {/* Details Card */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-800">
           <div className="flex flex-col md:flex-row border-b border-gray-100 dark:border-gray-800 md:border-b-0">
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
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                 </select>
              </div>
           </div>
           <div className="p-2 border-t border-gray-100 dark:border-gray-800 md:border-t-0">
             <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                <button onClick={() => setTxType('expense')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${txType === 'expense' ? 'bg-white dark:bg-gray-600 shadow-sm text-red-500' : 'text-gray-400 hover:text-gray-600'}`}>{t('add.expense')}</button>
                <button onClick={() => setTxType('income')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${txType === 'income' ? 'bg-white dark:bg-gray-600 shadow-sm text-green-500' : 'text-gray-400 hover:text-gray-600'}`}>{t('add.income')}</button>
             </div>
           </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={totalAmount === 0 || !storeName || isSaving}
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:grayscale hover:bg-blue-600 flex items-center justify-center gap-2"
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