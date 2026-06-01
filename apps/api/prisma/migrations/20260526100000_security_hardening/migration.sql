-- Enable RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConnectedAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;

-- Create policy function
CREATE OR REPLACE FUNCTION current_org_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_org_id', TRUE), '');
$$ LANGUAGE sql STABLE;

-- Drop existing policies if any
DROP POLICY IF EXISTS tenant_isolation ON "User";
DROP POLICY IF EXISTS tenant_isolation ON "Project";
DROP POLICY IF EXISTS tenant_isolation ON "Task";
DROP POLICY IF EXISTS tenant_isolation ON "Notice";
DROP POLICY IF EXISTS tenant_isolation ON "CalendarEvent";
DROP POLICY IF EXISTS tenant_isolation ON "Document";
DROP POLICY IF EXISTS tenant_isolation ON "ConnectedAccount";
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
DROP POLICY IF EXISTS tenant_isolation ON "LeaveRequest";
DROP POLICY IF EXISTS tenant_isolation ON "Attendance";
DROP POLICY IF EXISTS tenant_isolation ON "Asset";

-- Create policies
CREATE POLICY tenant_isolation ON "User"
  USING ("organizationId" = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON "Project"
  USING ("organizationId" = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON "Task"
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Task"."projectId" AND (p."organizationId" = current_org_id() OR current_org_id() IS NULL)
  ));

CREATE POLICY tenant_isolation ON "Notice"
  USING ("organizationId" = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON "CalendarEvent"
  USING ("organizationId" = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON "Document"
  USING ("organizationId" = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON "ConnectedAccount"
  USING (EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = "ConnectedAccount"."userId" AND (u."organizationId" = current_org_id() OR current_org_id() IS NULL)
  ));

CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("actorId" IS NULL OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = "AuditLog"."actorId" AND (u."organizationId" = current_org_id() OR current_org_id() IS NULL)
  ));

CREATE POLICY tenant_isolation ON "LeaveRequest"
  USING (EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = "LeaveRequest"."userId" AND (u."organizationId" = current_org_id() OR current_org_id() IS NULL)
  ));

CREATE POLICY tenant_isolation ON "Attendance"
  USING (EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = "Attendance"."userId" AND (u."organizationId" = current_org_id() OR current_org_id() IS NULL)
  ));

CREATE POLICY tenant_isolation ON "Asset"
  USING ("organizationId" = current_org_id() OR current_org_id() IS NULL);

-- Prevent AuditLog modifications
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON "AuditLog";
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
