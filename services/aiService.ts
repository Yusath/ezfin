
import { AIConfig, Transaction } from "../types";

const AI_CONFIG_KEY = 'ezfin_ai_config';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Default Config (Can be anything, using Groq or generic OpenAI placeholder)
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
      // Keep the data prefix for generic usage or strip it depending on provider?
      // Standard OpenAI format usually takes the full data URI or just base64. 
      // We will use the full Data URI scheme for maximum compatibility.
      resolve(result); 
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Universal Fetch Wrapper for OpenAI-compatible Chat Completions
const callAIProvider = async (messages: any[], jsonMode: boolean = false): Promise<string> => {
  const config = getAIConfig();
  
  if (!config.apiKey) {
    throw new Error("API Key belum dikonfigurasi. Silakan atur di menu Settings.");
  }

  // Ensure URL ends with /chat/completions if user just put base domain
  let endpoint = config.baseUrl;
  if (!endpoint.endsWith('/chat/completions')) {
     // Remove trailing slash if exists
     endpoint = endpoint.replace(/\/+$/, ""); 
     // Append path if not present (heuristic)
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
    throw new Error(error.message || "Gagal menghubungi AI Provider");
  }
};

export const getFinancialAdvice = async (transactions: Transaction[], userName: string): Promise<string> => {
  try {
    // Summarize data
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

    const result = await callAIProvider(messages, true); // Enable JSON mode if supported
    
    // Cleaning generic markdown if provider sends it despite instructions
    const cleanText = result.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);

  } catch (error) {
    console.error("Scan Error:", error);
    throw error;
  }
};
