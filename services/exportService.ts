import { Transaction, UserProfile } from "../types";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

export const exportService = {
  
  toExcel: (transactions: Transaction[], user: UserProfile) => {
    // 1. Prepare Data
    const rows = transactions.map(tx => ({
      Date: formatDate(tx.date),
      Store: tx.storeName,
      Category: tx.category,
      Type: tx.type === 'expense' ? 'Pengeluaran' : 'Pemasukan',
      Amount: tx.totalAmount,
      Items: tx.items.map(i => `${i.qty}x ${i.name}`).join(', ')
    }));

    // 2. Create Sheet
    const worksheet = XLSX.utils.json_to_sheet(rows);
    
    // Adjust Column Widths
    const wscols = [
      { wch: 25 }, // Date
      { wch: 20 }, // Store
      { wch: 15 }, // Category
      { wch: 12 }, // Type
      { wch: 15 }, // Amount
      { wch: 40 }  // Items
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

    // 3. Save
    XLSX.writeFile(workbook, `EZFin_Report_${user.name.replace(/\s+/g, '_')}.xlsx`);
  },

  toPDF: (transactions: Transaction[], user: UserProfile) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 122, 255); // Blue
    doc.text("EZFin Financial Report", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated for: ${user.name}`, 14, 28);
    doc.text(`Date: ${new Date().toLocaleDateString('id-ID')}`, 14, 33);

    // Summary Calculation
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.totalAmount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.totalAmount, 0);
    const balance = totalIncome - totalExpense;

    // Summary Table
    autoTable(doc, {
      startY: 40,
      head: [['Metric', 'Amount']],
      body: [
        ['Total Income', formatCurrency(totalIncome)],
        ['Total Expense', formatCurrency(totalExpense)],
        ['Net Balance', formatCurrency(balance)]
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    });

    // Main Transaction Table
    const tableRows = transactions.map(tx => [
      formatDate(tx.date),
      tx.storeName,
      tx.category,
      tx.type === 'income' ? '+' : '-',
      formatCurrency(tx.totalAmount)
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Date', 'Store', 'Category', 'Type', 'Amount']],
      body: tableRows,
      headStyles: { fillColor: [0, 122, 255] },
      alternateRowStyles: { fillColor: [245, 245, 247] },
      styles: { fontSize: 8 },
    });

    doc.save(`EZFin_Report.pdf`);
  },

  toDocx: (transactions: Transaction[], user: UserProfile) => {
    // Generating a proper .docx in browser without heavy libraries involves
    // creating a specific XML structure or simpler: HTML-to-Doc mime type.
    // This method is robust for simple tables.

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.totalAmount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.totalAmount, 0);

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Financial Report</title>
        <style>
          body { font-family: 'Arial', sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #007AFF; color: white; }
          .amount { text-align: right; }
          .header { margin-bottom: 20px; }
          .summary { background: #f0f0f0; padding: 10px; border-radius: 8px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>EZFin Report</h1>
          <p><strong>User:</strong> ${user.name}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="summary">
          <p><strong>Total Income:</strong> ${formatCurrency(totalIncome)}</p>
          <p><strong>Total Expense:</strong> ${formatCurrency(totalExpense)}</p>
          <p><strong>Net Balance:</strong> ${formatCurrency(totalIncome - totalExpense)}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Store</th>
              <th>Category</th>
              <th>Type</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(tx => `
              <tr>
                <td>${formatDate(tx.date)}</td>
                <td>${tx.storeName}</td>
                <td>${tx.category}</td>
                <td style="color:${tx.type === 'income' ? 'green' : 'red'}">${tx.type}</td>
                <td class="amount">${formatCurrency(tx.totalAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EZFin_Report_${user.name}.doc`; // .doc opens correctly in Word/Docs
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};