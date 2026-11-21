BEGIN;
CREATE TABLE staff_library_items (
  tenant_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  id uuid NOT NULL,
  kind varchar(8) NOT NULL CHECK (kind IN ('RESOURCE', 'GUIDE')),
  title varchar(120) NOT NULL CHECK (length(trim(title)) > 0),
  summary varchar(500) NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  category varchar(80) NOT NULL,
  grade varchar(80) NOT NULL,
  subject varchar(80) NOT NULL,
  tags text[] NOT NULL CHECK (cardinality(tags) <= 12),
  scope varchar(6) NOT NULL CHECK (scope IN ('CAMPUS', 'CLASS')),
  class_ref varchar(80),
  expires_on date NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'REVOKED')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  PRIMARY KEY (tenant_id, campus_id, id),
  CHECK ((scope = 'CAMPUS' AND class_ref IS NULL) OR
         (scope = 'CLASS' AND class_ref IS NOT NULL AND length(trim(class_ref)) > 0)),
  CONSTRAINT staff_library_item_campus_fk FOREIGN KEY (tenant_id, campus_id)
    REFERENCES campuses(tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX staff_library_item_list_idx ON staff_library_items(tenant_id, campus_id, kind, status, expires_on);
CREATE TABLE staff_library_activity (
  tenant_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  item_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  favorite boolean NOT NULL DEFAULT false,
  last_used_at timestamptz(6),
  PRIMARY KEY (tenant_id, campus_id, item_id, membership_id),
  CONSTRAINT staff_library_activity_item_fk FOREIGN KEY (tenant_id, campus_id, item_id)
    REFERENCES staff_library_items(tenant_id, campus_id, id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT staff_library_activity_member_fk FOREIGN KEY (tenant_id, membership_id, campus_id)
    REFERENCES membership_campuses(tenant_id, membership_id, campus_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX staff_library_activity_member_idx ON staff_library_activity(tenant_id, campus_id, membership_id);
COMMIT;
