
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/jpeg;base64, prefix if present
      // Works for PDF data URLs too (data:application/pdf;base64,...)
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
      You are an expert Indonesian Receipt Extraction Agent.
      Analyze the image/document and extract transaction details into valid JSON.

      CONTEXT:
      - Currency: Indonesian Rupiah (IDR).
      - Number Format: "10.000" means 10000. "10,000" usually means 10. Ignore thousands separators (dots).
      - If a store name is abbreviated, try to infer the full name (e.g., "Indomrt" -> "Indomaret").

      EXTRACTION TARGETS:
      1. Store Name (nama_toko)
      2. Transaction Date (tanggal) - Format YYYY-MM-DD
      3. Items (daftar_barang):
         - Name (nama)
         - Quantity (jumlah) -> If missing, deduce from TotalPrice / UnitPrice. Default to 1.
         - Unit Price (harga_satuan) -> If missing, deduce from TotalPrice / Quantity.
         - Total Price (total_harga)
      4. Grand Total (total_belanja)

      JSON SCHEMA:
      {
        "store_name": "String",
        "transaction_date": "YYYY-MM-DD",
        "items": [
          {
            "name": "String",
            "qty": Number,
            "price": Number,
            "total": Number
          }
        ],
        "grand_total": Number
      }

      RULES:
      - Output ONLY raw JSON. No markdown formatting.
      - Ensure all numbers are integers (no decimals).
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
    
    // Remove Markdown code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Gemini Scan Error:", error);
    throw error;
  }
};
