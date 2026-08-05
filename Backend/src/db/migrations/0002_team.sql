CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'collaborator', 'analyst')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_members_company_id ON company_members(company_id);
