import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/jpeg;base64, prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const getFinancialAdvice = async (transactions: Transaction[], userName: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Summarize data for the prompt
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

    const prompt = `
      Bertindaklah sebagai penasihat keuangan yang ramah dan cerdas untuk mahasiswa bernama ${userName}.
      
      Data Keuangan Bulan Ini:
      - Total Pemasukan: Rp ${totalIncome.toLocaleString()}
      - Total Pengeluaran: Rp ${totalExpense.toLocaleString()}
      - Sisa Saldo: Rp ${(totalIncome - totalExpense).toLocaleString()}
      
      Pengeluaran Terakhir:
      ${recentExpenses}
      
      Berikan saran singkat (maksimal 3 poin), praktis, dan memotivasi tentang bagaimana mereka bisa menghemat uang atau mengelola keuangan lebih baik. Gunakan bahasa yang santai tapi sopan ala gen-z/millennial. Gunakan Emoji.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Maaf, saya tidak bisa memberikan saran saat ini.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Terjadi kesalahan saat menghubungi AI Advisor.";
  }
};

export const scanReceipt = async (file: File): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64 = await fileToBase64(file);
    
    const prompt = `
      You are a technical reasoning and extraction agent. Your job is to analyze the provided receipt image and convert it into a STRICTLY STRUCTURED JSON object that matches EXACTLY the required manual form fields below.

      ========================================
      ==  FIXED MANUAL FORM FIELD TEMPLATE  ==
      ========================================
      Your JSON output MUST contain these exact fields and structure:

      {
        "store": {
          "name": "",
          "address": "",
          "transaction_date": ""
        },
        "items": [
          {
            "item_name": "",
            "quantity": null,
            "unit_price": null,
            "total_price": null
          }
        ],
        "summary": {
          "grand_total": null
        }
      }

      RULES:
      - Do NOT change field names.
      - Do NOT add extra fields.
      - Do NOT remove required fields.
      - Do NOT nest fields differently.
      - If data is missing, return null, never invent.
      - All numeric values must be integers without separators.
      - Dates must follow dd/mm/yyyy or dd-mm-yyyy format.
      - Item_name must be a cleaned product name, not including quantity or price.

      ========================================
      ==  EXTRACTION RULES FOR INDONESIAN RECEIPTS ==
      ========================================
      - Prices may appear as 3500, 3.500, 3,500 -> normalize to 3500.
      - Quantity may appear as:
        "2 x 3500", "2x3500", "2 pcs", "Qty:2"
      - Item line patterns you must detect:
        [name] [qty] x [unit] [total]
        [name] [total]          -> quantity = 1, unit_price = total
        [name] [qty] [unit_price] [total]
      - Ignore text like "TERIMA KASIH", promos, or membership info.
      - Grand total can appear as:
        "TOTAL"
        "TOTAL BAYAR"
        "TOTAL BELANJA"
        "JUMLAH"
        Always extract the numeric value after it.

      Output ONLY valid JSON. No comments, no explanations.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: file.type, data: base64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Scan Error:", error);
    throw error;
  }
};