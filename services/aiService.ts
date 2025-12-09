
import { AIConfig, Transaction } from "../types";

const AI_CONFIG_KEY = 'ezfin_ai_config';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Default Config
const DEFAULT_CONFIG: AIConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  modelName: "gpt-4o-mini"
};

export const getAIConfig = (): AIConfig => {
  const saved = localStorage.getItem(AI_CONFIG_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
};

export const saveAIConfig = (config: AIConfig) => {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error("Ukuran file terlalu besar (Maks 5MB)"));
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      reject(new Error("Format file tidak didukung. Gunakan JPG, PNG, atau WEBP."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result); 
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Universal Fetch Wrapper
const callAIProvider = async (messages: any[], jsonMode: boolean = false): Promise<string> => {
  const config = getAIConfig();
  
  if (!config.apiKey) {
    throw new Error("MISSING_API_KEY");
  }

  let endpoint = config.baseUrl;
  if (!endpoint.endsWith('/chat/completions')) {
     endpoint = endpoint.replace(/\/+$/, ""); 
     if (!endpoint.includes('/v1')) {
         endpoint = `${endpoint}/v1/chat/completions`;
     } else {
         endpoint = `${endpoint}/chat/completions`;
     }
  }

  const payload: any = {
    model: config.modelName,
    messages: messages,
    temperature: 0.7,
  };

  if (jsonMode) {
    payload.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Provider Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error: any) {
    console.error("AI Service Error:", error);
    // Propagate the specific error key if previously thrown
    if (error.message === 'MISSING_API_KEY') throw error;
    throw new Error(error.message || "Gagal menghubungi AI Provider");
  }
};

export const getFinancialAdvice = async (transactions: Transaction[], userName: string): Promise<string> => {
  try {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.totalAmount, 0);
      
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const recentExpenses = transactions
      .filter(t => t.type === 'expense')
      .slice(0, 5)
      .map(t => `${t.storeName} (${t.category}): Rp ${t.totalAmount.toLocaleString()}`)
      .join(', ');

    const systemPrompt = `Anda adalah asisten keuangan pribadi yang bijak dan hemat. Berikan saran DALAM BAHASA INDONESIA yang sangat ringkas (maksimal 2 kalimat) dan gunakan emoji.`;
    
    const userPrompt = `
      User: ${userName}
      Total Masuk: Rp ${totalIncome.toLocaleString()}
      Total Keluar: Rp ${totalExpense.toLocaleString()}
      Sisa: Rp ${(totalIncome - totalExpense).toLocaleString()}
      Pengeluaran Terakhir: ${recentExpenses}
      
      Berikan komentar atau saran keuangan singkat berdasarkan data di atas.
    `;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    const result = await callAIProvider(messages);
    return result || "Hemat pangkal kaya! 🌱";
  } catch (error) {
    console.error("Advice Error");
    return "Gagal memuat saran AI. Cek konfigurasi API Key.";
  }
};

export const scanReceipt = async (file: File): Promise<any> => {
  try {
    const base64Data = await fileToBase64(file);
    
    const systemPrompt = `
      You are an expert Receipt Extraction Agent (Indonesian Context).
      Extract data into valid JSON.
      
      JSON SCHEMA:
      {
        "store_name": "String",
        "transaction_date": "YYYY-MM-DD",
        "items": [ { "name": "String", "qty": Number, "price": Number } ],
        "shipping_cost": Number,
        "service_fee": Number,
        "shipping_discount": Number,
        "voucher_discount": Number
      }
      
      RULES:
      1. Currency is IDR. Ignore thousands separators. "10.000" = 10000.
      2. Extract Discounts as POSITIVE numbers.
      3. If field not found, set to 0 or empty string.
      4. ONLY return raw JSON, no markdown blocks.
    `;

    const messages = [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: [
          { type: "text", text: "Extract information from this receipt image." },
          { type: "image_url", image_url: { url: base64Data } }
        ]
      }
    ];

    const result = await callAIProvider(messages, true);
    
    const cleanText = result.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);

  } catch (error) {
    throw error;
  }
};

/**
 * Fallback Offline OCR using Tesseract.js (Loaded via CDN in index.html)
 * Extracts basic info using Regex matching.
 */
export const scanReceiptOffline = async (file: File): Promise<any> => {
    // @ts-ignore
    if (!window.Tesseract) {
        throw new Error("Offline OCR engine not loaded.");
    }

    return new Promise((resolve, reject) => {
        // @ts-ignore
        window.Tesseract.recognize(
            file,
            'eng+ind',
            { 
                logger: (m: any) => console.log(m) 
            }
        ).then(({ data: { text } }: any) => {
            console.log("Offline OCR Result:", text);
            
            // --- SIMPLE REGEX PARSING LOGIC ---
            
            // 1. Find Total (Look for Total/Jumlah/Bayar followed by number)
            const totalRegex = /(?:Total|Jumlah|Bayar|Tagihan)[\D]*?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i;
            const totalMatch = text.match(totalRegex);
            let grandTotal = 0;
            if (totalMatch) {
                 grandTotal = parseInt(totalMatch[1].replace(/[.,]/g, ''));
            }

            // 2. Find Date (DD/MM/YYYY or YYYY-MM-DD)
            const dateRegex = /(\d{2}[-/]\d{2}[-/]\d{4})|(\d{4}[-/]\d{2}[-/]\d{2})/;
            const dateMatch = text.match(dateRegex);
            let dateStr = new Date().toISOString().split('T')[0];
            if (dateMatch) {
                // Simplistic date parsing, assumes valid format from OCR
                try {
                   dateStr = new Date(dateMatch[0]).toISOString().split('T')[0]; 
                } catch(e) {}
            }

            // 3. Guess Store Name (First non-empty line usually)
            const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 3);
            const storeName = lines.length > 0 ? lines[0] : "Unknown Store";

            resolve({
                store_name: storeName,
                transaction_date: dateStr,
                items: [
                   { name: "Item Scan (Offline)", qty: 1, price: grandTotal }
                ],
                shipping_cost: 0,
                service_fee: 0,
                shipping_discount: 0,
                voucher_discount: 0
            });
        }).catch((err: any) => {
            reject(err);
        });
    });
};