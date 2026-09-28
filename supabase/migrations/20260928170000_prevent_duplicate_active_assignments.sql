-- 20260928170000_prevent_duplicate_active_assignments.sql
-- Hard database constraints and triggers to prevent double active assignments

-- 1. Ensure no duplicate active assignments exist before creating unique index
UPDATE worker_assignments
SET assignment_status = 'cancelled',
    notes = COALESCE(notes || ' - ', '') || 'Auto-cleaned duplicate active assignment'
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY client_id, employee_id ORDER BY assigned_at DESC NULLS LAST, id DESC) as rn
        FROM worker_assignments
        WHERE assignment_status = 'active'
    ) sub
    WHERE sub.rn > 1
);

-- 2. Partial unique index on worker_assignments (client_id, employee_id) where assignment_status = 'active'
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_assignments_unique_active_client_employee
ON worker_assignments (client_id, employee_id)
WHERE (assignment_status = 'active');

-- 3. Ensure no duplicate open-ended assignments exist on service_worker_assignments before creating unique index
UPDATE service_worker_assignments
SET end_date = start_date
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY service_id, employee_id ORDER BY created_at DESC NULLS LAST, id DESC) as rn
        FROM service_worker_assignments
        WHERE end_date IS NULL
    ) sub
    WHERE sub.rn > 1
);

-- 4. Partial unique index on service_worker_assignments (service_id, employee_id) where end_date IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_worker_assignments_unique_active
ON service_worker_assignments (service_id, employee_id)
WHERE (end_date IS NULL);

-- 5. Trigger to automatically supersede older active assignments in worker_assignments
CREATE OR REPLACE FUNCTION supersede_previous_active_worker_assignments()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assignment_status = 'active' THEN
        UPDATE worker_assignments
        SET assignment_status = 'cancelled',
            notes = COALESCE(notes || ' - ', '') || 'Superseded by new assignment'
        WHERE client_id = NEW.client_id
          AND employee_id = NEW.employee_id
          AND id != NEW.id
          AND assignment_status = 'active';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supersede_previous_active_worker_assignments ON worker_assignments;
CREATE TRIGGER trg_supersede_previous_active_worker_assignments
BEFORE INSERT ON worker_assignments
FOR EACH ROW
EXECUTE FUNCTION supersede_previous_active_worker_assignments();

-- 6. Trigger to automatically close previous active service_worker_assignments
CREATE OR REPLACE FUNCTION supersede_previous_active_service_worker_assignments()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_date IS NULL THEN
        UPDATE service_worker_assignments
        SET end_date = NEW.start_date
        WHERE service_id = NEW.service_id
          AND employee_id = NEW.employee_id
          AND id != NEW.id
          AND end_date IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supersede_previous_active_service_worker_assignments ON service_worker_assignments;
CREATE TRIGGER trg_supersede_previous_active_service_worker_assignments
BEFORE INSERT ON service_worker_assignments
FOR EACH ROW
EXECUTE FUNCTION supersede_previous_active_service_worker_assignments();
