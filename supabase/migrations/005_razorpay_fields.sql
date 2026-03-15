-- ============================================================
-- 99 Care CRM — Migration 005
-- Razorpay integration fields
-- Run after 004_rate_snapshot_autoclose.sql
-- ============================================================

-- Store Razorpay order ID on invoices so the webhook can look up
-- which invoice a payment belongs to
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS razorpay_order_id   TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- Also on leads for deposit payments where invoice may not exist yet
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;

-- Also on payments table (already has razorpay columns from schema 001,
-- but add payment_id in case it was missed)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- Indexes for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_order ON invoices(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_razorpay_order    ON leads(razorpay_order_id)    WHERE razorpay_order_id IS NOT NULL;

-- ── How to create a Razorpay order for deposit ────────────────
-- Call this from your React app or status-engine when generating deposit invoice.
-- Store the returned order_id in invoices.razorpay_order_id.
--
-- Example (in status-engine deposit_pending handler):
--
--   const order = await fetch("https://api.razorpay.com/v1/orders", {
--     method: "POST",
--     headers: {
--       Authorization: "Basic " + btoa(KEY_ID + ":" + KEY_SECRET),
--       "Content-Type": "application/json",
--     },
--     body: JSON.stringify({
--       amount: 1500000,   // ₹15,000 in paise
--       currency: "INR",
--       receipt: invoice.invoice_number,
--       notes: { client_id: clientId, invoice_id: invoiceId }
--     })
--   }).then(r => r.json());
--
--   await supabase.from("invoices")
--     .update({ razorpay_order_id: order.id })
--     .eq("id", invoiceId);
--
-- Then send the payment link to the client:
--   https://rzp.io/l/{order.id}   (short link, works on WhatsApp)
