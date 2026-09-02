import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from '../lib/supabase';

function numberToWordsINR(num: number): string {
    if (num === 0) return 'Zero';
    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const formatTens = (n: number) => {
        if (n < 10) return single[n];
        if (n < 20) return double[n - 10];
        return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + single[n % 10] : '');
    };
    let word = '';
    let rem = Math.floor(Math.abs(num));
    const crore = Math.floor(rem / 10000000);
    rem %= 10000000;
    const lakh = Math.floor(rem / 100000);
    rem %= 100000;
    const thousand = Math.floor(rem / 1000);
    rem %= 1000;
    const hundred = Math.floor(rem / 100);
    rem %= 100;
    if (crore > 0) word += formatTens(crore) + ' Crore ';
    if (lakh > 0) word += formatTens(lakh) + ' Lakh ';
    if (thousand > 0) word += formatTens(thousand) + ' Thousand ';
    if (hundred > 0) word += formatTens(hundred) + ' Hundred ';
    if (rem > 0) {
        if (word !== '') word += 'And ';
        word += formatTens(rem);
    }
    return word.trim();
}

export interface InvoicePdfOptions {
    clientId: string;
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    invoiceNumber: string;
    invoiceDate?: string;
    dueDate?: string;
    serviceName: string;
    servicePeriod: string;
    days: number;
    ratePerDay: number;
    grossAmount: number;
    previouslyBilled?: number;
    depositCollected?: number;
    settlementAmount?: number; // negative means refund
    isFinalSettlement?: boolean;
}

export async function generateAndUploadInvoicePdf(opts: InvoicePdfOptions): Promise<string> {
    const fetchImg = async (path: string) => {
        try {
            const { data } = await supabase.storage.from('invoices').download(path);
            if (!data) return null;
            return await data.arrayBuffer();
        } catch {
            return null;
        }
    };

    const [logoBuf, qrBuf, sigBuf] = await Promise.all([
        fetchImg('99care-logo.png'),
        fetchImg('payment-qr.JPG'),
        fetchImg('Signature.png')
    ]);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const W = page.getWidth();
    const H = page.getHeight();

    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const BLUE = rgb(0.235, 0.47, 0.847);
    const WHITE = rgb(1, 1, 1);
    const DARK = rgb(0.1, 0.1, 0.1);
    const GRAY = rgb(0.4, 0.4, 0.4);
    const BLUE_LINE = rgb(0.5, 0.6, 0.9);

    let curY = H - 50;

    // 1. Logo & Company Details
    if (logoBuf) {
        try {
            const logoImg = await pdfDoc.embedPng(logoBuf);
            const logoDims = logoImg.scaleToFit(220, 220);
            page.drawImage(logoImg, {
                x: 40,
                y: curY - logoDims.height + 40,
                width: logoDims.width,
                height: logoDims.height
            });
        } catch {
            page.drawText('99 CARE', { x: 40, y: curY - 20, size: 24, font: bold, color: BLUE });
        }
    }

    const cRightX = W - 40;
    const rightAlign = (text: string, size: number, fontFace: any, y: number, color = DARK) => {
        const w = fontFace.widthOfTextAtSize(text, size);
        page.drawText(text, { x: cRightX - w, y, size, font: fontFace, color });
    };

    rightAlign('99 CARE', 20, bold, curY - 20);
    rightAlign('104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN', 10, regular, curY - 35);
    rightAlign('Surat, GUJARAT, 395007', 10, regular, curY - 48);
    rightAlign('Mobile +91 9016116564', 10, bold, curY - 61);
    rightAlign('Email 99careforyou@gmail.com', 10, bold, curY - 74);
    rightAlign('Website 99CARE.ORG', 10, bold, curY - 87);

    curY -= 105;
    page.drawLine({ start: { x: 40, y: curY }, end: { x: W - 40, y: curY }, thickness: 2, color: BLUE_LINE });
    curY -= 20;

    // 2. Bill To & Invoice Meta
    const bTopY = curY;
    page.drawText('Bill To:', { x: 40, y: curY, size: 10, font: bold, color: DARK });
    curY -= 16;
    page.drawText(opts.clientName || 'Client', { x: 40, y: curY, size: 12, font: bold, color: DARK });
    curY -= 14;
    if (opts.clientPhone) {
        page.drawText(`Ph: ${opts.clientPhone}`, { x: 40, y: curY, size: 10, font: regular, color: DARK });
        curY -= 14;
    }
    if (opts.clientAddress) {
        page.drawText(opts.clientAddress.slice(0, 60), { x: 40, y: curY, size: 10, font: regular, color: DARK });
        curY -= 14;
    }

    let metaY = bTopY;
    const labelX = W - 180;
    const valX = W - 40;
    const drawMeta = (lbl: string, val: string, isB = false) => {
        const lblW = bold.widthOfTextAtSize(lbl, 10);
        page.drawText(lbl, { x: labelX - lblW, y: metaY, size: 10, font: bold, color: DARK });
        const valW = (isB ? bold : regular).widthOfTextAtSize(val, 10);
        page.drawText(val, { x: valX - valW, y: metaY, size: 10, font: isB ? bold : regular, color: DARK });
        metaY -= 16;
    };

    const formatDateStr = (dStr?: string) => {
        if (!dStr) return '';
        try {
            const d = new Date(dStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        } catch {}
        return dStr;
    };

    drawMeta('Invoice #:', opts.invoiceNumber, true);
    drawMeta('Invoice Date:', formatDateStr(opts.invoiceDate) || 'Today', true);
    if (opts.dueDate) {
        drawMeta('Due Date:', formatDateStr(opts.dueDate), true);
    }

    curY = Math.min(curY, metaY) - 10;

    // 3. Table Header
    const TABLE_H = 20;
    page.drawRectangle({ x: 40, y: curY - TABLE_H, width: W - 80, height: TABLE_H, color: BLUE });

    const COL_1 = 45;
    const COL_2 = 80;
    const COL_3 = 400;
    const COL_4 = W - 45;

    const drawColHeader = (text: string, x: number, alignRight = false) => {
        const width = bold.widthOfTextAtSize(text, 10);
        page.drawText(text, { x: alignRight ? x - width : x, y: curY - 14, size: 10, font: bold, color: WHITE });
    };

    drawColHeader('#', COL_1);
    drawColHeader('Item', COL_2);
    drawColHeader('HSN/SAC', COL_3);
    drawColHeader('Amount', COL_4, true);

    curY -= TABLE_H + 16;

    // 4. Data Row
    page.drawText('1', { x: COL_1, y: curY, size: 10, font: regular, color: DARK });
    page.drawText(opts.serviceName.toUpperCase(), { x: COL_2, y: curY, size: 10, font: bold, color: DARK });
    page.drawText('-', { x: COL_3 + 20, y: curY, size: 10, font: regular, color: DARK });

    const grossStr = opts.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const amtW = regular.widthOfTextAtSize(grossStr, 10);
    page.drawText(grossStr, { x: COL_4 - amtW, y: curY, size: 10, font: regular, color: DARK });

    curY -= 14;
    const detailLine = `Service Period: ${opts.servicePeriod} (${opts.days} Days @ Rs. ${opts.ratePerDay.toLocaleString('en-IN')}/day)`;
    page.drawText(detailLine, { x: COL_2, y: curY, size: 8.5, font: regular, color: GRAY });

    curY -= 16;
    page.drawLine({ start: { x: 40, y: curY }, end: { x: W - 40, y: curY }, thickness: 1, color: GRAY });
    curY -= 16;

    // 5. Totals & Deductions
    const prevBilled = opts.previouslyBilled || 0;
    const deposit = opts.depositCollected || 0;
    const settlement = opts.settlementAmount !== undefined
        ? opts.settlementAmount
        : (opts.grossAmount - prevBilled - deposit);
    const isRefund = settlement < 0;
    const refundAmount = Math.abs(settlement);
    const balanceDue = Math.max(0, settlement);

    const totLbl = 'Total Gross Amount';
    const totLblW = bold.widthOfTextAtSize(totLbl, 11);
    page.drawText(totLbl, { x: COL_3 + 10 - totLblW, y: curY, size: 11, font: bold, color: DARK });
    const totVal = `Rs. ${grossStr}`;
    const totValW = bold.widthOfTextAtSize(totVal, 11);
    page.drawText(totVal, { x: COL_4 - totValW, y: curY, size: 11, font: bold, color: DARK });
    curY -= 18;

    if (prevBilled > 0) {
        const prevLbl = 'Collected Earlier';
        const prevLblW = regular.widthOfTextAtSize(prevLbl, 9.5);
        page.drawText(prevLbl, { x: COL_3 + 10 - prevLblW, y: curY, size: 9.5, font: regular, color: GRAY });
        const prevVal = `- Rs. ${prevBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        const prevValW = regular.widthOfTextAtSize(prevVal, 9.5);
        page.drawText(prevVal, { x: COL_4 - prevValW, y: curY, size: 9.5, font: regular, color: GRAY });
        curY -= 16;
    }

    if (deposit > 0) {
        const depLbl = 'Security Deposit';
        const depLblW = regular.widthOfTextAtSize(depLbl, 9.5);
        page.drawText(depLbl, { x: COL_3 + 10 - depLblW, y: curY, size: 9.5, font: regular, color: GRAY });
        const depVal = `- Rs. ${deposit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        const depValW = regular.widthOfTextAtSize(depVal, 9.5);
        page.drawText(depVal, { x: COL_4 - depValW, y: curY, size: 9.5, font: regular, color: GRAY });
        curY -= 16;
    }

    if (isRefund) {
        const refLbl = 'Refund Due to Client';
        const refLblW = bold.widthOfTextAtSize(refLbl, 10);
        page.drawText(refLbl, { x: COL_3 + 10 - refLblW, y: curY, size: 10, font: bold, color: rgb(0.8, 0.35, 0.1) });
        const refVal = `Rs. ${refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Refund)`;
        const refValW = bold.widthOfTextAtSize(refVal, 10);
        page.drawText(refVal, { x: COL_4 - refValW, y: curY, size: 10, font: bold, color: rgb(0.8, 0.35, 0.1) });
        curY -= 16;
    }

    page.drawText('Total Items / Qty : 1 / 1', { x: 40, y: curY, size: 8, font: regular, color: GRAY });
    const inWords = isRefund
        ? `Refund amount (in words): INR ${numberToWordsINR(Math.round(refundAmount))} Rupees Refund Due to Client.`
        : `Total amount (in words): INR ${numberToWordsINR(Math.round(balanceDue))} Rupees Only.`;
    const wordW = regular.widthOfTextAtSize(inWords, 8);
    page.drawText(inWords, { x: W - 40 - wordW, y: curY, size: 8, font: regular, color: DARK });

    curY -= 8;
    page.drawLine({ start: { x: 40, y: curY }, end: { x: W - 40, y: curY }, thickness: 1, color: BLUE_LINE });
    curY -= 16;

    const pLbl = isRefund ? 'Amount to Return:' : 'Amount Payable:';
    const pLblW = bold.widthOfTextAtSize(pLbl, 10);
    page.drawText(pLbl, { x: COL_3 + 10 - pLblW, y: curY, size: 10, font: bold, color: isRefund ? rgb(0.8, 0.35, 0.1) : GRAY });

    const payableValue = isRefund
        ? `Rs. ${refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Refund)`
        : `Rs. ${balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const pValW = bold.widthOfTextAtSize(payableValue, 10);
    page.drawText(payableValue, { x: COL_4 - pValW, y: curY, size: 10, font: bold, color: isRefund ? rgb(0.8, 0.35, 0.1) : DARK });

    curY -= 35;

    // 6. Bank Details & QR & Signature
    const bLeft = 240;
    page.drawText('Bank Details:', { x: bLeft, y: curY, size: 9, font: bold, color: DARK });
    curY -= 14;
    const drawBankRow = (k: string, v: string) => {
        page.drawText(k, { x: bLeft, y: curY, size: 8.5, font: regular, color: GRAY });
        page.drawText(v, { x: bLeft + 70, y: curY, size: 8.5, font: bold, color: DARK });
        curY -= 12;
    };
    drawBankRow('Bank:', 'The Sutex Co-Operative BankLtd.');
    drawBankRow('Account Holder:', '99 CARE HOME HEALTHCARE SERVICE');
    drawBankRow('Account #:', '001810021002033');
    drawBankRow('IFSC Code:', 'SUTB0248018');
    drawBankRow('Branch:', 'Adajan Pal');

    if (qrBuf) {
        try {
            const qrImg = await pdfDoc.embedJpg(qrBuf);
            page.drawText('Pay using UPI:', { x: 40, y: curY + 60, size: 9, font: bold, color: DARK });
            page.drawImage(qrImg, { x: 40, y: curY - 10, width: 75, height: 75 });
        } catch {}
    }

    if (sigBuf) {
        try {
            const sigImg = await pdfDoc.embedPng(sigBuf);
            page.drawText('For 99 CARE', { x: W - 140, y: curY + 45, size: 8.5, font: regular, color: DARK });
            page.drawImage(sigImg, { x: W - 150, y: curY + 5, width: 80, height: 35 });
            page.drawText('Authorized Signatory', { x: W - 155, y: curY - 5, size: 8, font: regular, color: GRAY });
        } catch {}
    }

    // 7. Notes Section
    curY -= 35;
    page.drawText('Notes:', { x: 40, y: curY, size: 8.5, font: bold, color: DARK });
    curY -= 12;
    page.drawText(opts.isFinalSettlement ? 'Final Settlement Invoice — Service concluded.' : 'Service Invoice.', { x: 40, y: curY, size: 8, font: regular, color: DARK });
    curY -= 10;
    page.drawText(`Service Period: ${opts.servicePeriod} (${opts.days} Days Attendance Verified)`, { x: 40, y: curY, size: 8, font: regular, color: DARK });
    curY -= 10;
    if (deposit > 0) {
        page.drawText(`Security Deposit of Rs. ${deposit.toLocaleString('en-IN')} adjusted against service fee of Rs. ${grossStr}.`, { x: 40, y: curY, size: 8, font: regular, color: DARK });
        curY -= 10;
    }
    if (isRefund) {
        page.drawText(`Net refundable balance of Rs. ${refundAmount.toLocaleString('en-IN')} will be refunded to the client bank account.`, { x: 40, y: curY, size: 8, font: regular, color: DARK });
    }

    const pdfBytes = await pdfDoc.save();

    // Upload to Supabase Storage
    const storagePath = `${opts.clientId}/${opts.invoiceNumber}.pdf`;
    await supabase.storage.from('invoices').upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
    });

    const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(storagePath);
    return `${publicUrl}?t=${Date.now()}`;
}
