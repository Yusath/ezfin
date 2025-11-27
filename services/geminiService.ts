
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error("Ukuran file terlalu besar (Maks 5MB)"));
      return;
    }
    
    // Strict MIME type check
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      reject(new Error("Format file tidak didukung. Gunakan JPG, PNG, atau PDF."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
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
      Bertindaklah sebagai asisten keuangan pribadi untuk ${userName}.
      
      Data Keuangan:
      - Total Masuk: Rp ${totalIncome.toLocaleString()}
      - Total Keluar: Rp ${totalExpense.toLocaleString()}
      - Sisa: Rp ${(totalIncome - totalExpense).toLocaleString()}
      - Pengeluaran Terbesar: ${recentExpenses}
      
      Tugas:
      Berikan saran atau komentar keuangan yang SANGAT RINGKAS dan PADAT.
      
      Aturan Ketat:
      1. Maksimal 2 kalimat pendek atau poin.
      2. Langsung pada inti masalah atau solusi.
      3. Jangan gunakan pembukaan basa-basi (seperti "Halo", "Berdasarkan data", dll).
      4. Gunakan emoji.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Hemat pangkal kaya! 🌱";
  } catch (error) {
    console.error("Gemini API Error (Advice)");
    return "Terjadi kesalahan saat menghubungi AI Advisor.";
  }
};

export const scanReceipt = async (file: File): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64 = await fileToBase64(file);
    
    const prompt = `
      You are an expert Indonesian Receipt Extraction Agent, specialized in Marketplace/Delivery apps (Shopee, GoFood, Grab, Tokopedia).
      Analyze the image and extract details into valid JSON.

      CONTEXT:
      - Currency: Indonesian Rupiah (IDR).
      - Ignore thousands separators (dots). "10.000" = 10000.
      - If store name is abbreviated, infer full name.

      EXTRACTION TARGETS:
      1. Store Name (nama_toko)
      2. Transaction Date (tanggal) - Format YYYY-MM-DD
      3. Product Items (daftar_barang): Standard items.
      4. **Additional Fees & Discounts (CRITICAL):**
         - Subtotal (subtotal_produk) -> Sum of products only.
         - Shipping Cost (ongkos_kirim/pengiriman)
         - Service/Admin/App Fee (biaya_layanan/penanganan)
         - Shipping Discount (diskon_ongkir/potongan_pengiriman) -> Extract as POSITIVE NUMBER.
         - Voucher/Marketplace Discount (diskon_voucher/diskon_belanja) -> Extract as POSITIVE NUMBER.
      5. Grand Total (total_pembayaran)

      JSON SCHEMA:
      {
        "store_name": "String",
        "transaction_date": "YYYY-MM-DD",
        "items": [
          { "name": "String", "qty": Number, "price": Number, "total": Number }
        ],
        "subtotal_products": Number,
        "shipping_cost": Number,
        "service_fee": Number,
        "shipping_discount": Number,
        "voucher_discount": Number,
        "grand_total": Number
      }

      RULES:
      - Output ONLY raw JSON. No markdown.
      - Ensure all numbers are integers.
      - If a field is not found (e.g. no discount), set to 0.
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
    console.error("Gemini Scan Error (Processing)");
    throw error;
  }
};
