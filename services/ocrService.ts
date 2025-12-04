import { TransactionItem } from "../types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error("Ukuran file terlalu besar (maks 5MB)"));
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Format file tidak didukung. Gunakan JPG atau PNG."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const sanitizeNumber = (input: string): number => {
  const cleaned = input.replace(/[^0-9-]/g, "");
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
};

const parseDate = (text: string): string | null => {
  const dateRegex = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/;
  const match = text.match(dateRegex);
  if (!match) return null;

  const parts = match[0].split(/[\/-]/).map((p) => p.padStart(2, "0"));
  let [day, month, year] = parts;
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
};

const mapItems = (lines: string[]): TransactionItem[] => {
  const items: TransactionItem[] = [];

  lines.forEach((line) => {
    // Match patterns like "Ayam Geprek x2 18000" or "Ayam Geprek 2 18000"
    const itemMatch = line.match(/(.+?)\s+(?:x\s*)?(\d+)\s+([\d\.\,]+)/i);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const qty = sanitizeNumber(itemMatch[2]);
      const price = sanitizeNumber(itemMatch[3]);

      if (name && qty > 0 && price > 0) {
        items.push({
          id: Math.random().toString(36).substring(7),
          name,
          qty,
          price,
        });
      }
    }
  });

  return items;
};

const extractTotals = (lines: string[]) => {
  const result = {
    shipping_cost: 0,
    service_fee: 0,
    shipping_discount: 0,
    voucher_discount: 0,
    grand_total: 0,
    subtotal_products: 0,
  };

  lines.forEach((line) => {
    const lower = line.toLowerCase();

    if (lower.includes("ongkir") || lower.includes("pengiriman")) {
      result.shipping_cost = Math.max(result.shipping_cost, sanitizeNumber(line));
    }

    if (lower.includes("layanan") || lower.includes("service")) {
      result.service_fee = Math.max(result.service_fee, sanitizeNumber(line));
    }

    if (lower.includes("diskon ongkir") || lower.includes("potongan pengiriman")) {
      result.shipping_discount = Math.max(result.shipping_discount, sanitizeNumber(line));
    }

    if (lower.includes("voucher") || lower.includes("diskon")) {
      result.voucher_discount = Math.max(result.voucher_discount, sanitizeNumber(line));
    }

    if (lower.includes("total")) {
      result.grand_total = Math.max(result.grand_total, sanitizeNumber(line));
    }
  });

  return result;
};

export interface ReceiptData {
  store_name: string;
  transaction_date: string | null;
  items: TransactionItem[];
  subtotal_products: number;
  shipping_cost: number;
  service_fee: number;
  shipping_discount: number;
  voucher_discount: number;
  grand_total: number;
}

export const scanReceipt = async (file: File): Promise<ReceiptData> => {
  const imageUrl = await fileToDataUrl(file);

  const { createWorker } = (await import(
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js"
  )) as any;
  const worker = await createWorker();

  try {
    const { data } = await worker.recognize(imageUrl, "eng+ind", {
      preserve_interword_spaces: "1",
    });

    const lines = data.text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const items = mapItems(lines);
    const totals = extractTotals(lines);

    // Fallback subtotal: sum of items when totals missing
    if (!totals.subtotal_products && items.length > 0) {
      totals.subtotal_products = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    }

    const receipt: ReceiptData = {
      store_name: lines[0] || "Toko Tidak Dikenal",
      transaction_date: parseDate(lines.join(" ")),
      items,
      subtotal_products: totals.subtotal_products,
      shipping_cost: totals.shipping_cost,
      service_fee: totals.service_fee,
      shipping_discount: totals.shipping_discount,
      voucher_discount: totals.voucher_discount,
      grand_total: totals.grand_total || totals.subtotal_products,
    };

    return receipt;
  } finally {
    await worker.terminate();
  }
};
