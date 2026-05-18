import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── 99 CARE Company Constants ──────────────────────────────
const COMPANY_NAME        = '99 CARE';
const COMPANY_SUBTITLE    = 'HOME HEALTHCARE SERVICE';
const COMPANY_ADDRESS_L1  = '104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN';
const COMPANY_ADDRESS_L2  = 'Surat, GUJARAT - 395007';
const COMPANY_PHONE       = '+91 9016116564';
const COMPANY_EMAIL       = '99careforyou@gmail.com';
const COMPANY_WEBSITE     = '99CARE.ORG';

const BANK_NAME           = 'THE SUTEX CO-OPERATIVE BANK LTD.';
const BANK_HOLDER         = '99 CARE HOME HEALTHCARE SERVICE';
const BANK_ACCOUNT        = '001810021002033';
const BANK_IFSC           = 'SUTB0248018';
const BANK_BRANCH         = 'ADAJAN PAL';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { lead_id, deposit_amount, service_period, invoice_number: input_invoice_number } = await req.json();
        if (!lead_id) throw new Error('lead_id is required');

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Fetch Lead
        const { data: lead, error: leadError } = await supabase
            .from('crm_leads').select('*').eq('id', lead_id).single();
        if (leadError || !lead) throw new Error(`Lead not found: ${leadError?.message || ''}`);

        // Invoice meta
        const invoiceNum   = input_invoice_number || `INV-${Date.now().toString().slice(-6)}`;
        const now          = new Date();
        const due          = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const fmt          = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        const invoiceDate  = fmt(now);
        const dueDate      = fmt(due);

        const clientName   = lead.name || 'Client';
        const clientPhone  = lead.phone || lead.whatsapp_number || '';
        const clientCity   = lead.city || '';
        const amount       = Number(deposit_amount || lead.quoted_monthly_rate || 15000);
        const service      = lead.service_interest || '24HRS HOME HEALTHCARE';
        const servicePeriod = service_period || 'As agreed';
        const amountFmt    = `Rs. ${amount.toLocaleString('en-IN')}`;

        // ── Create PDF ──────────────────────────────────────────
        const pdfDoc = await PDFDocument.create();
        const page   = pdfDoc.addPage([595.28, 841.89]);
        const W = page.getWidth();
        const H = page.getHeight();

        const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const TEAL       = rgb(0.102, 0.651, 0.659);  // #1AA6A8
        const WHITE      = rgb(1, 1, 1);
        const DARK       = rgb(0.13, 0.13, 0.13);
        const GRAY       = rgb(0.45, 0.45, 0.45);
        const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
        const MID_GRAY   = rgb(0.70, 0.70, 0.70);

        // ── 1. TEAL HEADER BANNER ───────────────────────────────
        const BANNER_H = 88;
        page.drawRectangle({ x: 0, y: H - BANNER_H, width: W, height: BANNER_H, color: TEAL });

        // Company name left
        page.drawText(COMPANY_NAME, {
            x: 40, y: H - 52, size: 30, font: bold, color: WHITE,
        });
        page.drawText(COMPANY_SUBTITLE, {
            x: 40, y: H - 72, size: 10, font: regular, color: WHITE,
        });

        // "INVOICE" right
        const invW = bold.widthOfTextAtSize('INVOICE', 28);
        page.drawText('INVOICE', {
            x: W - 40 - invW, y: H - 55, size: 28, font: bold, color: WHITE,
        });

        // ── 2. SUBHEADER (address left / invoice box right) ─────
        const subY = H - BANNER_H - 12;

        // Company address (left)
        page.drawText(COMPANY_ADDRESS_L1, { x: 40, y: subY, size: 9, font: regular, color: GRAY });
        page.drawText(COMPANY_ADDRESS_L2, { x: 40, y: subY - 13, size: 9, font: regular, color: GRAY });
        page.drawText(`Ph: ${COMPANY_PHONE}  |  ${COMPANY_EMAIL}  |  ${COMPANY_WEBSITE}`,
            { x: 40, y: subY - 26, size: 8, font: regular, color: GRAY });

        // Invoice details box (right)
        const BOX_X = W - 195;
        const BOX_Y = subY - 42;
        const BOX_W = 155;
        const BOX_H = 50;
        page.drawRectangle({ x: BOX_X, y: BOX_Y, width: BOX_W, height: BOX_H, borderColor: MID_GRAY, borderWidth: 0.8, color: WHITE });
        const labelX  = BOX_X + 8;
        const valueX  = BOX_X + 80;
        let   bLineY  = BOX_Y + BOX_H - 16;
        const bLines  = [
            ['Invoice No:', invoiceNum],
            ['Invoice Date:', invoiceDate],
            ['Due Date:', dueDate],
        ];
        for (const [label, value] of bLines) {
            page.drawText(label, { x: labelX, y: bLineY, size: 8.5, font: bold, color: DARK });
            page.drawText(value, { x: valueX, y: bLineY, size: 8.5, font: regular, color: DARK });
            bLineY -= 14;
        }

        // ── 3. TEAL DIVIDER LINE ────────────────────────────────
        const divY = H - BANNER_H - 80;
        page.drawLine({ start: { x: 40, y: divY }, end: { x: W - 40, y: divY }, thickness: 1.5, color: TEAL });

        // ── 4. BILL TO ─────────────────────────────────────────
        let curY = divY - 22;
        page.drawText('Bill To:', { x: 40, y: curY, size: 11, font: bold, color: TEAL });
        curY -= 18;
        page.drawText(clientName, { x: 40, y: curY, size: 13, font: bold, color: DARK });
        curY -= 16;
        if (clientPhone) {
            page.drawText(`Phone: ${clientPhone}`, { x: 40, y: curY, size: 9.5, font: regular, color: GRAY });
            curY -= 14;
        }
        if (clientCity) {
            page.drawText(clientCity, { x: 40, y: curY, size: 9.5, font: regular, color: GRAY });
            curY -= 14;
        }

        // ── 5. LINE ITEMS TABLE ────────────────────────────────
        curY -= 18;
        const TABLE_X   = 40;
        const TABLE_W   = W - 80;
        const COL_DESC  = TABLE_X;
        const COL_HSN   = TABLE_X + 310;
        const COL_AMT   = TABLE_X + TABLE_W - 80;
        const ROW_H     = 22;

        // Table header row
        page.drawRectangle({ x: TABLE_X, y: curY - 6, width: TABLE_W, height: ROW_H, color: LIGHT_GRAY });
        page.drawText('Description',  { x: COL_DESC + 8, y: curY + 4, size: 9.5, font: bold, color: DARK });
        page.drawText('HSN/SAC',      { x: COL_HSN,      y: curY + 4, size: 9.5, font: bold, color: DARK });
        page.drawText('Amount (INR)', { x: COL_AMT,       y: curY + 4, size: 9.5, font: bold, color: DARK });
        curY -= ROW_H + 8;

        // Table border
        const TABLE_TOP = curY + ROW_H + 14;
        page.drawLine({ start: { x: TABLE_X, y: TABLE_TOP }, end: { x: TABLE_X + TABLE_W, y: TABLE_TOP }, thickness: 0.6, color: MID_GRAY });

        // Data row
        page.drawText(`Advance Deposit for ${service}`, { x: COL_DESC + 8, y: curY + 2, size: 9.5, font: regular, color: DARK });
        page.drawText('—', { x: COL_HSN + 10, y: curY + 2, size: 9.5, font: regular, color: GRAY });
        page.drawText(amountFmt, { x: COL_AMT, y: curY + 2, size: 9.5, font: regular, color: DARK });

        // Service period sub-line
        if (servicePeriod && servicePeriod !== 'As agreed') {
            curY -= 16;
            page.drawText(`Service Period: ${servicePeriod}`, { x: COL_DESC + 8, y: curY, size: 8.5, font: regular, color: GRAY });
        } else {
            curY -= 4;
        }
        curY -= 20;

        // Bottom table line
        page.drawLine({ start: { x: TABLE_X, y: curY + 10 }, end: { x: TABLE_X + TABLE_W, y: curY + 10 }, thickness: 0.6, color: MID_GRAY });

        // ── 6. TOTAL BOX ────────────────────────────────────────
        curY -= 14;
        const TOT_W = 170;
        const TOT_X = W - 40 - TOT_W;
        page.drawRectangle({ x: TOT_X, y: curY - 8, width: TOT_W, height: 26, borderColor: TEAL, borderWidth: 1.2, color: WHITE });
        page.drawText('Total Amount:', { x: TOT_X + 10, y: curY + 4, size: 10, font: bold, color: DARK });
        const totAmtW = bold.widthOfTextAtSize(amountFmt, 11);
        page.drawText(amountFmt, { x: TOT_X + TOT_W - 10 - totAmtW, y: curY + 4, size: 11, font: bold, color: TEAL });

        // ── 7. NOTES ────────────────────────────────────────────
        curY -= 40;
        page.drawText('Note:', { x: 40, y: curY, size: 10, font: bold, color: DARK });
        curY -= 15;
        page.drawText('*  Purpose: Initial deposit to commence services.', { x: 40, y: curY, size: 9, font: regular, color: GRAY });
        curY -= 13;
        page.drawText('*  Adjustment: The deposit will be adjusted against your final payment.', { x: 40, y: curY, size: 9, font: regular, color: GRAY });

        // ── 8. BANK DETAILS BOX ────────────────────────────────
        curY -= 30;
        const BANK_BOX_W = 260;
        const BANK_BOX_H = 80;
        page.drawRectangle({ x: 40, y: curY - BANK_BOX_H + 16, width: BANK_BOX_W, height: BANK_BOX_H, color: LIGHT_GRAY });
        page.drawText('Bank Details:', { x: 50, y: curY, size: 10, font: bold, color: DARK });
        curY -= 15;
        const bankLines = [
            `Bank: ${BANK_NAME}`,
            `Account Holder: ${BANK_HOLDER}`,
            `Account Number: ${BANK_ACCOUNT}`,
            `IFSC: ${BANK_IFSC}  |  Branch: ${BANK_BRANCH}`,
        ];
        for (const line of bankLines) {
            page.drawText(line, { x: 50, y: curY, size: 8.5, font: regular, color: DARK });
            curY -= 13;
        }

        // ── 9. AUTHORIZED SIGNATORY (right side) ─────────────
        const sigY = curY + 15 + 70;
        const sigLineX = W - 220;
        page.drawLine({ start: { x: sigLineX, y: sigY }, end: { x: W - 40, y: sigY }, thickness: 0.8, color: MID_GRAY });
        page.drawText('For 99 CARE HOME HEALTHCARE SERVICE', { x: sigLineX, y: sigY - 14, size: 8, font: bold, color: DARK });

        // ── 10. FOOTER ──────────────────────────────────────────
        page.drawLine({ start: { x: 40, y: 45 }, end: { x: W - 40, y: 45 }, thickness: 0.8, color: LIGHT_GRAY });
        const footerText = 'Thank you for your business. Please retain this invoice for your records.';
        const footerW = regular.widthOfTextAtSize(footerText, 9);
        page.drawText(footerText, { x: (W - footerW) / 2, y: 30, size: 9, font: regular, color: GRAY });

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
