import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import { Journal, Entry } from '../models/cash-journal.models';
import { formatDateDE, formatCurrencyEUR } from '../utils/cash-utils';

type Row = Entry & { saldo: number };

@Injectable({ providedIn: 'root' })
export class PdfService {
  exportCashReport(journal: Journal, rows: Row[]): jsPDF {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

    // Header
    pdf.setFont('helvetica');
    pdf.setFontSize(18);
    pdf.text(`Kassenbericht:  ${journal.description}`, 40, 80);

    pdf.setFontSize(10);
    pdf.text(
      `Zeitraum:       ${formatDateDE(journal.period.from)} – ${formatDateDE(journal.period.to)}`,
      40,
      120
    );

    // Table
    let docNr = 0;
    const body: RowInput[] = rows.map((r) => [
      formatDateDE(r.date),
      ++docNr,
      r.description || '',
      formatCurrencyEUR(r.debit),
      formatCurrencyEUR(r.credit),
      formatCurrencyEUR(r.saldo),
    ]);

    autoTable(pdf, {
      head: [['Datum', 'Dokument', 'Beschreibung', 'Einnahmen', 'Ausgaben']],
      body,
      startY: 130,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, valign: 'middle' },
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center', cellWidth: 60 },
        2: { cellWidth: 'auto' },
        3: { halign: 'left', cellWidth: 80 },
        4: { halign: 'left', cellWidth: 80 },
        //5: { halign: 'left', cellWidth: 80 },
      },
    });

    const lastY = (pdf as any).lastAutoTable?.finalY ?? 130;
    const closingSaldo =
      rows.length > 0 ? rows[rows.length - 1].saldo : Number(journal.openingBalance || 0);

    pdf.setFont('helvetica', 'bold');
    pdf.text(
      `Gesamteinnahmen im Zeitraum:    ${formatCurrencyEUR(closingSaldo)}`,
      40,
      lastY + 20
    );

    return pdf;
  }
}
