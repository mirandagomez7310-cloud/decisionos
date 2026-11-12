// generado a mano hasta el primer `db:types`
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
export type OrgRole = 'owner' | 'admin' | 'analyst' | 'viewer'
type Organization = {
  id: string
  name: string
  slug: string
  country: string
  currency: string
  timezone: string
  settings: Json
  created_at: string
  updated_at: string
}
type Membership = {
  organization_id: string
  user_id: string
  role: OrgRole
  created_at: string
}
type Invitation = {
  id: string
  organization_id: string
  email: string
  role: OrgRole
  token_hash: string
  expires_at: string
  accepted_at: string | null
  created_by: string
  created_at: string
}
type AuditLog = {
  id: number
  organization_id: string
  actor_user_id: string | null
  actor_kind: string
  action: string
  entity: string
  entity_id: string
  data: Json
  created_at: string
}
export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Pick<Organization, 'name' | 'slug'> & Partial<Organization>
        Update: Partial<
          Pick<
            Organization,
            'name' | 'slug' | 'country' | 'currency' | 'timezone' | 'settings'
          >
        >
        Relationships: []
      }
      memberships: {
        Row: Membership
        Insert: Omit<Membership, 'created_at'> & { created_at?: string }
        Update: { role?: OrgRole }
        Relationships: []
      }
      invitations: {
        Row: Invitation
        Insert: Pick<
          Invitation,
          'organization_id' | 'email' | 'role' | 'token_hash' | 'created_by'
        > &
          Partial<Invitation>
        Update: { role?: OrgRole }
        Relationships: []
      }
      audit_log: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at' | 'data'> & {
          id?: never
          created_at?: string
          data?: Json
        }
        Update: never
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_organization: {
        Args: { name: string; slug: string }
        Returns: Organization
      }
      accept_invitation: { Args: { token: string }; Returns: string }
      my_org_ids: { Args: Record<string, never>; Returns: string[] }
      my_org_ids_with_role: { Args: { roles: OrgRole[] }; Returns: string[] }
    }
    Enums: { org_role: OrgRole }
    CompositeTypes: { [_ in never]: never }
  }
}
