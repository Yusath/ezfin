
import { Transaction, UserProfile } from "../types";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { escapeHtml } from '../utils/security';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

export const exportService = {
  
  toExcel: (transactions: Transaction[], user: UserProfile, periodLabel: string) => {
    // 1. Split Data
    const incomes = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');

    const headers = ["Tanggal", "Tempat/Toko", "Kategori", "Jumlah", "Rincian Item"];

    const mapToRowArray = (tx: Transaction) => [
      formatDate(tx.date),
      tx.storeName,
      tx.category,
      tx.totalAmount,
      tx.items.map(i => `${i.qty}x ${i.name}`).join(', ')
    ];

    // 2. Calculate Totals
    const totalIncome = incomes.reduce((s, t) => s + t.totalAmount, 0);
    const totalExpense = expenses.reduce((s, t) => s + t.totalAmount, 0);
    const profitLoss = totalIncome - totalExpense;

    // 3. Build Sheet with Multiple Tables
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [`EZFin Report: ${periodLabel}`],
      [`User: ${user.name}`],
      [""], // Spacer
      ["PEMASUKAN (INCOME)"],
    ]);

    // Income Section
    const incomeStartRow = 5; // A5
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: `A${incomeStartRow}` });
    if (incomes.length > 0) {
      XLSX.utils.sheet_add_aoa(worksheet, incomes.map(mapToRowArray), { origin: `A${incomeStartRow + 1}` });
    } else {
      XLSX.utils.sheet_add_aoa(worksheet, [["(Tidak ada data pemasukan)"]], { origin: `A${incomeStartRow + 1}` });
    }

    // Expense Section
    // Calculate start row: 5 (Start) + 1 (Header) + (Data Length or 1 for message) + 2 (Spacer)
    const incomeRows = incomes.length > 0 ? incomes.length : 1;
    const expenseStartRow = incomeStartRow + 1 + incomeRows + 2;
    
    XLSX.utils.sheet_add_aoa(worksheet, [["PENGELUARAN (EXPENSE)"]], { origin: `A${expenseStartRow - 1}` });
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: `A${expenseStartRow}` });
    
    if (expenses.length > 0) {
      XLSX.utils.sheet_add_aoa(worksheet, expenses.map(mapToRowArray), { origin: `A${expenseStartRow + 1}` });
    } else {
      XLSX.utils.sheet_add_aoa(worksheet, [["(Tidak ada data pengeluaran)"]], { origin: `A${expenseStartRow + 1}` });
    }

    // Summary Section
    const expenseRows = expenses.length > 0 ? expenses.length : 1;
    const summaryStartRow = expenseStartRow + 1 + expenseRows + 2;

    XLSX.utils.sheet_add_aoa(worksheet, [
      ["RINGKASAN (SUMMARY)"],
      ["Total Pemasukan", totalIncome],
      ["Total Pengeluaran", totalExpense],
      ["UNTUNG / RUGI", profitLoss]
    ], { origin: `A${summaryStartRow}` });

    // Formatting widths
    worksheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Keuangan");
    XLSX.writeFile(workbook, `EZFin_Report_${user.name.split(' ')[0]}_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  toPDF: (transactions: Transaction[], user: UserProfile, periodLabel: string) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // Split Data
    const incomes = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalIncome = incomes.reduce((s, t) => s + t.totalAmount, 0);
    const totalExpense = expenses.reduce((s, t) => s + t.totalAmount, 0);
    const profitLoss = totalIncome - totalExpense;

    // --- Header ---
    doc.setFontSize(18);
    doc.setTextColor(0, 122, 255);
    doc.text("Laporan Keuangan EZFin", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Periode: ${periodLabel}`, 14, 27);
    doc.text(`Dibuat oleh: ${user.name}`, 14, 32);

    let finalY = 40;

    // --- Table 1: Incomes ---
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("1. PEMASUKAN", 14, finalY);
    
    if (incomes.length > 0) {
      autoTable(doc, {
        startY: finalY + 3,
        head: [['Tanggal', 'Sumber', 'Kategori', 'Jumlah']],
        body: incomes.map(tx => [formatDate(tx.date), tx.storeName, tx.category, formatCurrency(tx.totalAmount)]),
        headStyles: { fillColor: [34, 197, 94] }, // Green
        styles: { fontSize: 9 },
      });
      finalY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("(Tidak ada data pemasukan)", 14, finalY + 8);
      finalY += 20;
    }

    // --- Table 2: Expenses ---
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("2. PENGELUARAN", 14, finalY);

    if (expenses.length > 0) {
      autoTable(doc, {
        startY: finalY + 3,
        head: [['Tanggal', 'Toko/Tempat', 'Kategori', 'Jumlah']],
        body: expenses.map(tx => [formatDate(tx.date), tx.storeName, tx.category, formatCurrency(tx.totalAmount)]),
        headStyles: { fillColor: [239, 68, 68] }, // Red
        styles: { fontSize: 9 },
      });
      finalY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("(Tidak ada data pengeluaran)", 14, finalY + 8);
      finalY += 20;
    }

    // --- Summary Section (Bottom) ---
    // Check if we need a new page
    if (finalY > 250) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFillColor(245, 247, 250);
    doc.rect(14, finalY, 180, 40, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("RINGKASAN AKHIR", 20, finalY + 10);
    
    doc.setFontSize(10);
    doc.text("Total Pemasukan:", 20, finalY + 20);
    doc.text(formatCurrency(totalIncome), 100, finalY + 20);
    
    doc.text("Total Pengeluaran:", 20, finalY + 26);
    doc.text(formatCurrency(totalExpense), 100, finalY + 26);
    
    // Profit Line
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("UNTUNG / RUGI:", 20, finalY + 35);
    
    doc.setTextColor(profitLoss >= 0 ? 34 : 239, profitLoss >= 0 ? 197 : 68, profitLoss >= 0 ? 94 : 68); // Green or Red
    doc.text(formatCurrency(profitLoss), 100, finalY + 35);

    doc.save(`Laporan_EZFin_${new Date().toISOString().slice(0,10)}.pdf`);
  },

  toDocx: (transactions: Transaction[], user: UserProfile, periodLabel: string) => {
    // Split Data
    const incomes = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalIncome = incomes.reduce((s, t) => s + t.totalAmount, 0);
    const totalExpense = expenses.reduce((s, t) => s + t.totalAmount, 0);
    const profitLoss = totalIncome - totalExpense;

    // SECURITY FIX: Sanitize all user input to prevent HTML injection in the DOCX content
    const safeUser = escapeHtml(user.name);
    const safePeriod = escapeHtml(periodLabel);

    const generateTable = (data: Transaction[], color: string) => {
        if (data.length === 0) return '<p><i>Tidak ada data.</i></p>';
        return `
        <table>
          <thead>
            <tr>
              <th style="background-color:${color}">Tanggal</th>
              <th style="background-color:${color}">Keterangan</th>
              <th style="background-color:${color}">Kategori</th>
              <th style="background-color:${color}" class="amount">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(tx => `
              <tr>
                <td>${formatDate(tx.date)}</td>
                <td>${escapeHtml(tx.storeName)} <br/><small>${escapeHtml(tx.items.map(i => i.name).join(', '))}</small></td>
                <td>${escapeHtml(tx.category)}</td>
                <td class="amount">${formatCurrency(tx.totalAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    };

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Laporan Keuangan</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; }
          h1, h2, h3 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11pt; }
          th { color: white; }
          .amount { text-align: right; }
          .header { margin-bottom: 30px; border-bottom: 2px solid #007AFF; padding-bottom: 10px; }
          .summary-box { background: #f8f9fa; border: 1px solid #ddd; padding: 15px; margin-top: 30px; }
          .profit { color: ${profitLoss >= 0 ? 'green' : 'red'}; font-weight: bold; font-size: 14pt; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Laporan Keuangan EZFin</h1>
          <p><strong>User:</strong> ${safeUser}</p>
          <p><strong>Periode:</strong> ${safePeriod}</p>
        </div>

        <h3>1. Pemasukan (Income)</h3>
        ${generateTable(incomes, '#22c55e')}

        <h3>2. Pengeluaran (Expense)</h3>
        ${generateTable(expenses, '#ef4444')}

        <div class="summary-box">
          <h3>Ringkasan Akhir</h3>
          <p>Total Pemasukan: <strong>${formatCurrency(totalIncome)}</strong></p>
          <p>Total Pengeluaran: <strong>${formatCurrency(totalExpense)}</strong></p>
          <hr/>
          <p>Untung / Rugi: <span class="profit">${formatCurrency(profitLoss)}</span></p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_EZFin_${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
