-- ============================================================
-- Migration: CRM Denormalization for Worker Assignments
-- Purpose: Add worker name and role directly to crm_leads to avoid join/RLS issues
-- Date: 2026-04-17
-- ============================================================

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS assigned_worker_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_worker_role TEXT;

COMMENT ON COLUMN public.crm_leads.assigned_worker_name IS 'Denormalized worker name for display in Kanban board.';
COMMENT ON COLUMN public.crm_leads.assigned_worker_role IS 'Denormalized worker job title for display in Kanban board.';
