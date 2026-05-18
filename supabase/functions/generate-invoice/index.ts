import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Number to Words Converter (INR) ─────────────────────────
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
    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    const hundred = Math.floor(num / 100);
    num %= 100;

    if (crore > 0) word += formatTens(crore) + ' Crore ';
    if (lakh > 0) word += formatTens(lakh) + ' Lakh ';
    if (thousand > 0) word += formatTens(thousand) + ' Thousand ';
    if (hundred > 0) word += formatTens(hundred) + ' Hundred ';
    
    if (num > 0) {
        if (word !== '') word += 'And ';
        word += formatTens(num);
    }
    
    return word.trim();
}

// ── 99 CARE Company Constants ──────────────────────────────
const COMPANY_NAME        = '99 CARE';
const COMPANY_ADDRESS_L1  = '104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN';
const COMPANY_ADDRESS_L2  = 'Surat, GUJARAT, 395007';
const COMPANY_PHONE       = '+91 9016116564';
const COMPANY_EMAIL       = '99careforyou@gmail.com';
const COMPANY_WEBSITE     = '99CARE.ORG';

const BANK_NAME           = 'The Sutex Co-Operative BankLtd.';
const BANK_HOLDER         = '99 CARE HOME HEALTHCARE SERVICE';
const BANK_ACCOUNT        = '001810021002033';
const BANK_IFSC           = 'SUTB0248018';
const BANK_BRANCH         = 'Adajan Pal';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { lead_id, deposit_amount, service_period, invoice_number: input_invoice_number, due_date } = await req.json();
        if (!lead_id) throw new Error('lead_id is required');

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabase = createClient(
            supabaseUrl,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Fetch Lead
        const { data: lead, error: leadError } = await supabase
            .from('crm_leads').select('*').eq('id', lead_id).single();
        if (leadError || !lead) throw new Error(`Lead not found: ${leadError?.message || ''}`);

        // Invoice meta
        const invoiceNum   = input_invoice_number || `INV-${Date.now().toString().slice(-6)}`;
        const now          = new Date();
        
        let due = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        if (due_date) {
            try {
                const parsedDue = new Date(due_date);
                if (!isNaN(parsedDue.getTime())) {
                    due = parsedDue;
                }
            } catch (e) {}
        }
        
        const monthNames   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const fullMonthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
        const fmt          = (d: Date) => `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        
        const invoiceDate  = fmt(now);
        const dueDate      = fmt(due);
        const currentMonthYear = `${fullMonthNames[now.getMonth()]}(${now.getFullYear()})`;

        // Parse structured data from notes if it exists
        const notesStr = lead.notes || '';
        const serviceMatch = notesStr.match(/^Service:\s*(.+)$/im);
        const shiftMatch   = notesStr.match(/^Shift:\s*(.+)$/im);
        const locMatch     = notesStr.match(/^Location:\s*(.+)$/im);

        const extractedService = serviceMatch ? serviceMatch[1].trim() : 'OLD AGE CARE';
        const extractedShift   = shiftMatch ? shiftMatch[1].trim() : '24';
        const extractedLocation = locMatch ? locMatch[1].trim() : '';

        const clientName   = lead.name || 'Client';
        const clientPhone  = lead.phone || lead.whatsapp_number || '';
        
        const amount       = Number(deposit_amount || lead.quoted_monthly_rate || 15000);
        
        const rawShift = extractedShift.toUpperCase().replace('HR', '').replace('HRS', '').replace('HOURS', '').trim() || '24';
        const shift = `${rawShift}HRS`;
        const service      = `${shift} (${extractedService.toUpperCase()})`;
        
        const servicePeriod = service_period || 'As agreed';
        
        // Calculate number of days from servicePeriod (Format: "DD/MM/YYYY To DD/MM/YYYY")
        let numberOfDays = 1;
        try {
            if (servicePeriod.includes(' To ')) {
                const [startStr, endStr] = servicePeriod.split(' To ');
                const parseDate = (dStr: string) => {
                    const [d, m, y] = dStr.split('/');
                    return new Date(Number(y), Number(m) - 1, Number(d));
                };
                const sDate = parseDate(startStr);
                const eDate = parseDate(endStr);
                if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
                    const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
                    if (diffDays > 0) numberOfDays = diffDays;
                }
            }
        } catch (e) {
            // Ignore parse errors, fallback to 1
        }
        
        const amountStr    = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const amountWords  = `INR ${numberToWordsINR(amount)} Rupees Only.`;

        // ── Fetch Images ─────────────────────────────────────────
        const fetchImage = async (path: string) => {
            const res = await fetch(`${supabaseUrl}/storage/v1/object/public/invoices/${path}`);
            if (!res.ok) return null;
            return await res.arrayBuffer();
        };

        const [logoBuf, qrBuf, sigBuf] = await Promise.all([
            fetchImage('99care-logo.png'),
            fetchImage('payment-qr.JPG'),
            fetchImage('Signature.png')
        ]);

        // ── Create PDF ──────────────────────────────────────────
        const pdfDoc = await PDFDocument.create();
        const page   = pdfDoc.addPage([595.28, 841.89]); // A4
        const W = page.getWidth();
        const H = page.getHeight();

        const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const BLUE       = rgb(0.235, 0.47, 0.847);   // #3c78d8
        const WHITE      = rgb(1, 1, 1);
        const DARK       = rgb(0.1, 0.1, 0.1);
        const GRAY       = rgb(0.4, 0.4, 0.4);
        const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
        const BLUE_LINE  = rgb(0.5, 0.6, 0.9);

        let curY = H - 50;

        // ── 1. HEADER (Logo left, Company Right) ────────────────
        let taxInvoiceYOffset = 70;
        if (logoBuf) {
            try {
                const logoImg = await pdfDoc.embedPng(logoBuf);
                // Make logo significantly bigger
                const logoDims = logoImg.scaleToFit(220, 220); 
                page.drawImage(logoImg, {
                    x: 40,
                    y: curY - logoDims.height + 40, // Moved upwards
                    width: logoDims.width,
                    height: logoDims.height
                });
                taxInvoiceYOffset = Math.max(70, logoDims.height - 25); // Adjusted gap
            } catch (e) {
                page.drawText('99 CARE', { x: 40, y: curY - 20, size: 24, font: bold, color: BLUE });
            }
        }
        
        page.drawText('TAX INVOICE', { x: 40, y: curY - taxInvoiceYOffset, size: 14, font: bold, color: DARK });

        // Company Info (Right)
        const cRightX = W - 40;
        const rightAlign = (text: string, size: number, fontFace: any, y: number, color = DARK) => {
            const w = fontFace.widthOfTextAtSize(text, size);
            page.drawText(text, { x: cRightX - w, y, size, font: fontFace, color });
        };

        rightAlign(COMPANY_NAME, 20, bold, curY - 20);
        rightAlign(COMPANY_ADDRESS_L1, 10, regular, curY - 35);
        rightAlign(COMPANY_ADDRESS_L2, 10, regular, curY - 48);
        rightAlign(`Mobile ${COMPANY_PHONE}`, 10, bold, curY - 61);
        rightAlign(`Email ${COMPANY_EMAIL}`, 10, bold, curY - 74);
        rightAlign(`Website ${COMPANY_WEBSITE}`, 10, bold, curY - 87);

        curY -= 105;

        // ── Divider Line ────────────────────────────────────────
        page.drawLine({ start: { x: 40, y: curY }, end: { x: W - 40, y: curY }, thickness: 2, color: BLUE_LINE });
        curY -= 20;

        // ── 2. BILL TO & INVOICE META ───────────────────────────
        const bTopY = curY;
        
        // Left
        page.drawText('Bill To:', { x: 40, y: curY, size: 10, font: bold, color: DARK });
        curY -= 16;
        page.drawText(clientName, { x: 40, y: curY, size: 12, font: bold, color: DARK });
        curY -= 14;
        if (clientPhone) {
            let formattedPhone = clientPhone.toString().replace(/^\+?91\s*/, '');
            page.drawText(`Ph: +91 ${formattedPhone}`, { x: 40, y: curY, size: 10, font: regular, color: DARK });
            curY -= 14;
        }
        
        // Add full address
        const fullAddress = extractedLocation || 'Address not provided';
        // Wrap address if it's too long
        const wrapAddress = (text: string, maxWidth: number) => {
            const words = text.split(' ');
            let lines = [];
            let currentLine = words[0];
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = regular.widthOfTextAtSize(currentLine + " " + word, 10);
                if (width < maxWidth) { currentLine += " " + word; } 
                else { lines.push(currentLine); currentLine = word; }
            }
            lines.push(currentLine);
            return lines;
        };
        const addressLines = wrapAddress(fullAddress, 250);
        for (const line of addressLines) {
            page.drawText(line, { x: 40, y: curY, size: 10, font: regular, color: DARK });
            curY -= 14;
        }

        // Right
        let metaY = bTopY;
        const labelX = W - 180;
        const valX   = W - 40;
        
        const drawMeta = (lbl: string, val: string, isBold: boolean = false) => {
            const lblW = bold.widthOfTextAtSize(lbl, 10);
            page.drawText(lbl, { x: labelX - lblW, y: metaY, size: 10, font: bold, color: DARK });
            const valW = (isBold ? bold : regular).widthOfTextAtSize(val, 10);
            page.drawText(val, { x: valX - valW, y: metaY, size: 10, font: isBold ? bold : regular, color: DARK });
            metaY -= 16;
        };

        drawMeta('Invoice #:', invoiceNum, true);
        drawMeta('Invoice Date:', invoiceDate, true);
        drawMeta('Due Date:', dueDate, true);

        curY = Math.min(curY, metaY) - 10;

        // ── 3. TABLE ────────────────────────────────────────────
        const TABLE_H = 20;
        page.drawRectangle({ x: 40, y: curY - TABLE_H, width: W - 80, height: TABLE_H, color: BLUE });
        
        const COL_1 = 45;   // #
        const COL_2 = 80;   // Item
        const COL_3 = 400;  // HSN/SAC
        const COL_4 = W - 45; // Amount (right aligned)

        const drawColHeader = (text: string, x: number, alignRight: boolean = false) => {
            const width = bold.widthOfTextAtSize(text, 10);
            page.drawText(text, { x: alignRight ? x - width : x, y: curY - 14, size: 10, font: bold, color: WHITE });
        };

        drawColHeader('#', COL_1);
        drawColHeader('Item', COL_2);
        drawColHeader('HSN/SAC', COL_3);
        drawColHeader('Amount', COL_4, true);

        curY -= TABLE_H + 16;

        // Data Row
        page.drawText('1', { x: COL_1, y: curY, size: 10, font: regular, color: DARK });
        page.drawText(service, { x: COL_2, y: curY, size: 10, font: bold, color: DARK });
        page.drawText('-', { x: COL_3 + 20, y: curY, size: 10, font: regular, color: DARK });
        
        const amtW = regular.widthOfTextAtSize(amountStr, 10);
        page.drawText(amountStr, { x: COL_4 - amtW, y: curY, size: 10, font: regular, color: DARK });

        curY -= 20;
        
        // Table bottom border
        page.drawLine({ start: { x: 40, y: curY }, end: { x: W - 40, y: curY }, thickness: 1, color: GRAY });
        curY -= 16;

        // ── 4. TOTALS ───────────────────────────────────────────
        const totLbl = 'Total';
        const totLblW = bold.widthOfTextAtSize(totLbl, 12);
        page.drawText(totLbl, { x: COL_3 + 10 - totLblW, y: curY, size: 12, font: bold, color: DARK });
        
        const totValW = bold.widthOfTextAtSize(amountStr, 12);
        page.drawText(`Rs. ${amountStr}`, { x: COL_4 - totValW - 5, y: curY, size: 12, font: bold, color: DARK });

        curY -= 20;

        // Total Items & Words
        page.drawText('Total Items / Qty : 1 / 1', { x: 40, y: curY, size: 8, font: regular, color: GRAY });
        const wordText = `Total amount (in words): ${amountWords}`;
        const wordW = regular.widthOfTextAtSize(wordText, 8);
        page.drawText(wordText, { x: W - 40 - wordW, y: curY, size: 8, font: regular, color: DARK });

        curY -= 8;
        page.drawLine({ start: { x: 40, y: curY }, end: { x: W - 40, y: curY }, thickness: 1, color: BLUE_LINE });

        // Amount Payable
        curY -= 16;
        const pLbl = 'Amount Payable:';
        const pLblW = bold.widthOfTextAtSize(pLbl, 10);
        page.drawText(pLbl, { x: COL_3 + 10 - pLblW, y: curY, size: 10, font: bold, color: GRAY });
        
        const pValW = bold.widthOfTextAtSize(amountStr, 10);
        page.drawText(`Rs. ${amountStr}`, { x: COL_4 - pValW - 5, y: curY, size: 10, font: bold, color: DARK });

        curY -= 40;

        // ── 5. BOTTOM SECTION (QR, Bank, Sig) ───────────────────
        const btmY = curY;

        // QR Code (Left)
        page.drawText('Pay using UPI:', { x: 40, y: btmY, size: 9, font: bold, color: DARK });
        if (qrBuf) {
            try {
                const qrImg = await pdfDoc.embedJpg(qrBuf);
                page.drawImage(qrImg, { x: 40, y: btmY - 110, width: 100, height: 100 });
            } catch (e) {
                try {
                    const qrImgPng = await pdfDoc.embedPng(qrBuf);
                    page.drawImage(qrImgPng, { x: 40, y: btmY - 110, width: 100, height: 100 });
                } catch (e2) {
                    // Ignore if QR fails to load
                }
            }
        }

        // Bank Details (Center)
        const bX = 200;
        let bkY = btmY;
        page.drawText('Bank Details:', { x: bX, y: bkY, size: 9, font: bold, color: DARK });
        bkY -= 14;
        
        const bLbls = ['Bank:', 'Account Holder:', 'Account #:', 'IFSC Code:', 'Branch:'];
        const bVals = [BANK_NAME, BANK_HOLDER, BANK_ACCOUNT, BANK_IFSC, BANK_BRANCH];
        
        for (let i = 0; i < bLbls.length; i++) {
            page.drawText(bLbls[i], { x: bX, y: bkY, size: 9, font: regular, color: DARK });
            page.drawText(bVals[i], { x: bX + 70, y: bkY, size: 9, font: bold, color: DARK });
            bkY -= 14;
        }

        // Signature (Right)
        const sigX = W - 150;
        const sigText = `For ${COMPANY_NAME}`;
        const sigTextW = regular.widthOfTextAtSize(sigText, 8);
        page.drawText(sigText, { x: W - 40 - sigTextW, y: btmY - 14, size: 8, font: regular, color: DARK });

        if (sigBuf) {
            try {
                const sigImg = await pdfDoc.embedPng(sigBuf);
                const sigDims = sigImg.scaleToFit(140, 60);
                page.drawImage(sigImg, {
                    x: W - 40 - sigDims.width,
                    y: btmY - 80,
                    width: sigDims.width,
                    height: sigDims.height
                });
            } catch (e) {
                // No valid sig image
            }
        }
        
        const authText = 'Authorized Signatory';
        const authW = regular.widthOfTextAtSize(authText, 8);
        page.drawText(authText, { x: W - 40 - authW, y: btmY - 90, size: 8, font: regular, color: DARK });

        // ── 6. NOTES SECTION ────────────────────────────────────
        curY = btmY - 135;
        page.drawText('Notes:', { x: 40, y: curY, size: 9, font: bold, color: DARK });
        curY -= 14;
        page.drawText(currentMonthYear, { x: 40, y: curY, size: 9, font: regular, color: DARK });
        curY -= 12;
        page.drawText(servicePeriod, { x: 40, y: curY, size: 9, font: regular, color: DARK });
        curY -= 20;

        const rawNoteLines = [
            `Thank you So much for appoint us.`,
            `We 99 care is part of 99FAS companies based on Services provider entities. Where we can supply all Building and maintenance related work. In our 99CARE we provide best care taker and nursing services at home.`,
            `${amountStr}/- paid in advanced before work start for more than ${numberOfDays} days' work. And all bill has to paid on timely based. Advanced Will Settled in Last final bill.`,
            `Please Rate us, your one vote is very important and precious for us.`,
            ``,
            `Falguni(Co-Founder)`,
            `[99care.org]`,
            `[+91 9016116564]`
        ];

        // Text wrapping function
        const wrapText = (text: string, maxWidth: number, font: any, fontSize: number) => {
            const words = text.split(' ');
            let lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = font.widthOfTextAtSize(currentLine + " " + word, fontSize);
                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        const wrappedNotes: string[] = [];
        const maxNoteWidth = W - 80;
        for (const line of rawNoteLines) {
            if (line === '') {
                wrappedNotes.push('');
            } else {
                wrappedNotes.push(...wrapText(line, maxNoteWidth, regular, 9));
            }
        }

        for (const line of wrappedNotes) {
            page.drawText(line, { x: 40, y: curY, size: 9, font: regular, color: DARK });
            curY -= 12;
        }

        // ── Save & Upload ───────────────────────────────────────
        const pdfBytes = await pdfDoc.save();
        const fileName = `${lead_id}/${invoiceNum}.pdf`;

        const { error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(fileName);

        return new Response(
            JSON.stringify({ success: true, invoice_number: invoiceNum, public_url: publicUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
