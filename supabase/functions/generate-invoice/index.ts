import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { lead_id, deposit_amount, service_period, invoice_number: input_invoice_number } = await req.json();

        if (!lead_id) {
            throw new Error('lead_id is required');
        }

        // 1. Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Fetch Lead Details
        const { data: lead, error: leadError } = await supabaseClient
            .from('crm_leads')
            .select('*')
            .eq('id', lead_id)
            .single();

        if (leadError || !lead) {
            throw new Error(`Lead not found: ${leadError?.message || ''}`);
        }

        // Determine Invoice Details
        const invoiceNum = input_invoice_number || `INV-${Date.now().toString().slice(-6)}`;
        const invoiceDate = new Date().toLocaleDateString('en-IN');
        const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN'); // +3 days
        
        const clientName = lead.name || 'Client';
        const clientPhone = lead.phone || lead.whatsapp_number || 'N/A';
        const clientCity = lead.city || 'N/A';
        const amount = deposit_amount || lead.quoted_monthly_rate || 15000;
        const service = lead.service_interest || '24HRS OLD AGE CARE';
        const serviceNotes = lead.notes ? lead.notes.substring(0, 100).replace(/\n/g, ' ') : '';
        const displayServicePeriod = service_period || 'As agreed';

        // 3. Generate PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
        const { width, height } = page.getSize();
        
        // Fonts
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Colors
        const primaryColor = rgb(0.1, 0.65, 0.66); // #1AA6A8
        const darkGray = rgb(0.2, 0.2, 0.2);
        const lightGray = rgb(0.5, 0.5, 0.5);

        // HEADER
        page.drawText('99 CARE', { x: 50, y: height - 50, size: 24, font: helveticaBold, color: primaryColor });
        page.drawText('Old Age Care Services', { x: 50, y: height - 70, size: 10, font: helveticaFont, color: lightGray });
        
        page.drawText('INVOICE', { x: width - 150, y: height - 50, size: 24, font: helveticaBold, color: darkGray });

        // INVOICE DETAILS (Right side)
        const detailsX = width - 200;
        let currentY = height - 90;
        page.drawText(`Invoice Number:`, { x: detailsX, y: currentY, size: 10, font: helveticaBold });
        page.drawText(invoiceNum, { x: detailsX + 90, y: currentY, size: 10, font: helveticaFont });
        currentY -= 15;
        page.drawText(`Invoice Date:`, { x: detailsX, y: currentY, size: 10, font: helveticaBold });
        page.drawText(invoiceDate, { x: detailsX + 90, y: currentY, size: 10, font: helveticaFont });
        currentY -= 15;
        page.drawText(`Due Date:`, { x: detailsX, y: currentY, size: 10, font: helveticaBold });
        page.drawText(dueDate, { x: detailsX + 90, y: currentY, size: 10, font: helveticaFont });

        // BILL TO (Left side)
        currentY = height - 120;
        page.drawText('Bill To:', { x: 50, y: currentY, size: 12, font: helveticaBold, color: primaryColor });
        currentY -= 20;
        page.drawText(clientName, { x: 50, y: currentY, size: 14, font: helveticaBold, color: darkGray });
        currentY -= 15;
        page.drawText(`Phone: ${clientPhone}`, { x: 50, y: currentY, size: 10, font: helveticaFont, color: darkGray });
        currentY -= 15;
        page.drawText(`Location: ${clientCity}`, { x: 50, y: currentY, size: 10, font: helveticaFont, color: darkGray });

        // TABLE HEADER
        currentY = height - 220;
        page.drawRectangle({ x: 50, y: currentY - 10, width: width - 100, height: 25, color: rgb(0.95, 0.95, 0.95) });
        page.drawText('Description', { x: 60, y: currentY - 3, size: 10, font: helveticaBold });
        page.drawText('SAC', { x: 300, y: currentY - 3, size: 10, font: helveticaBold });
        page.drawText('Amount (INR)', { x: width - 130, y: currentY - 3, size: 10, font: helveticaBold });

        // LINE ITEM
        currentY -= 35;
        page.drawText(`Advance Deposit for ${service}`, { x: 60, y: currentY, size: 10, font: helveticaFont });
        if (displayServicePeriod && displayServicePeriod !== 'As agreed') {
            currentY -= 15;
            page.drawText(`Period: ${displayServicePeriod}`, { x: 60, y: currentY, size: 9, font: helveticaFont, color: lightGray });
        }
        page.drawText('-', { x: 300, y: currentY, size: 10, font: helveticaFont });
        page.drawText(`Rs. ${Number(amount).toLocaleString('en-IN')}`, { x: width - 130, y: currentY, size: 10, font: helveticaFont });

        // TOTALS
        currentY -= 50;
        page.drawLine({ start: { x: width - 200, y: currentY + 10 }, end: { x: width - 50, y: currentY + 10 }, thickness: 1, color: lightGray });
        page.drawText('Total Amount:', { x: width - 200, y: currentY, size: 11, font: helveticaBold });
        page.drawText(`Rs. ${Number(amount).toLocaleString('en-IN')}`, { x: width - 130, y: currentY, size: 12, font: helveticaBold, color: primaryColor });

        // NOTES
        currentY -= 60;
        page.drawText('Notes:', { x: 50, y: currentY, size: 11, font: helveticaBold });
        currentY -= 15;
        page.drawText('1. This is an advance deposit for the care services.', { x: 50, y: currentY, size: 9, font: helveticaFont, color: darkGray });
        currentY -= 15;
        page.drawText('2. Deposit is adjustable in the final invoice.', { x: 50, y: currentY, size: 9, font: helveticaFont, color: darkGray });

        // BANK DETAILS
        currentY -= 40;
        page.drawText('Bank Details:', { x: 50, y: currentY, size: 11, font: helveticaBold });
        currentY -= 15;
        page.drawText('Account Name: 99 CARE', { x: 50, y: currentY, size: 10, font: helveticaFont });
        currentY -= 15;
        page.drawText('Account Number: 12345678901234', { x: 50, y: currentY, size: 10, font: helveticaFont });
        currentY -= 15;
        page.drawText('IFSC Code: HDFC0001234', { x: 50, y: currentY, size: 10, font: helveticaFont });
        currentY -= 15;
        page.drawText('Bank: HDFC Bank', { x: 50, y: currentY, size: 10, font: helveticaFont });

        // FOOTER
        page.drawLine({ start: { x: 50, y: 50 }, end: { x: width - 50, y: 50 }, thickness: 1, color: lightGray });
        page.drawText('Thank you for choosing 99 Care.', { x: width / 2 - 80, y: 35, size: 10, font: helveticaFont, color: lightGray });

        const pdfBytes = await pdfDoc.save();

        // 4. Upload to Supabase Storage
        const fileName = `${lead_id}/${invoiceNum}.pdf`;
        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('invoices')
            .upload(fileName, pdfBytes, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) {
            throw new Error(`Failed to upload invoice to storage: ${uploadError.message}`);
        }

        // 5. Get Public URL
        const { data: { publicUrl } } = supabaseClient
            .storage
            .from('invoices')
            .getPublicUrl(fileName);

        return new Response(
            JSON.stringify({ 
                success: true, 
                invoice_number: invoiceNum,
                public_url: publicUrl 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
