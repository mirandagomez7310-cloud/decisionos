
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_kind": string,"actor_user_id": string | null,"created_at": string,"data": NonNullable<Json>,"entity": string,"entity_id": string,"id": number,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_kind": string,"actor_user_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entity": string,"entity_id": string,"id"?: never,"organization_id": string
                  }
                  Update: {
                    "action"?: string,"actor_kind"?: string,"actor_user_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string,"id"?: never,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"credit_limit": number | null,"id": string,"name": string,"organization_id": string,"payment_terms_days": number | null,"segment": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"credit_limit"?: number | null,"id"?: string,"name": string,"organization_id": string,"payment_terms_days"?: number | null,"segment"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"credit_limit"?: number | null,"id"?: string,"name"?: string,"organization_id"?: string,"payment_terms_days"?: number | null,"segment"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"import_rows": {
                  Row: {
                    "error": string | null,"id": number,"import_id": string,"organization_id": string,"raw": NonNullable<Json>,"row_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"id"?: never,"import_id": string,"organization_id": string,"raw": NonNullable<Json>,"row_number": number
                  }
                  Update: {
                    "error"?: string | null,"id"?: never,"import_id"?: string,"organization_id"?: string,"raw"?: NonNullable<Json>,"row_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_rows_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_rows_organization_id_import_id_fkey"
      columns: ["organization_id","import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"imports": {
                  Row: {
                    "column_mapping": NonNullable<Json>,"created_at": string,"created_by": string,"error_count": number,"finished_at": string | null,"id": string,"kind": string,"ok_count": number,"organization_id": string,"original_filename": string,"preview": NonNullable<Json>,"row_count": number,"status": string,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "column_mapping"?: NonNullable<Json>,"created_at"?: string,"created_by": string,"error_count"?: number,"finished_at"?: string | null,"id"?: string,"kind": string,"ok_count"?: number,"organization_id": string,"original_filename": string,"preview"?: NonNullable<Json>,"row_count"?: number,"status"?: string,"storage_path": string
                  }
                  Update: {
                    "column_mapping"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"error_count"?: number,"finished_at"?: string | null,"id"?: string,"kind"?: string,"ok_count"?: number,"organization_id"?: string,"original_filename"?: string,"preview"?: NonNullable<Json>,"row_count"?: number,"status"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "imports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_snapshots": {
                  Row: {
                    "organization_id": string,"product_id": string,"quantity": number,"snapshot_on": string,"source_import_id": string | null,"unit_cost": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "organization_id": string,"product_id": string,"quantity": number,"snapshot_on": string,"source_import_id"?: string | null,"unit_cost"?: number | null
                  }
                  Update: {
                    "organization_id"?: string,"product_id"?: string,"quantity"?: number,"snapshot_on"?: string,"source_import_id"?: string | null,"unit_cost"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_snapshots_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_snapshots_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_snapshots_source_import_fkey"
      columns: ["organization_id","source_import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"created_by": string,"email": string,"expires_at": string,"id": string,"organization_id": string,"role": Database["public"]['Enums']["org_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by": string,"email": string,"expires_at"?: string,"id"?: string,"organization_id": string,"role": Database["public"]['Enums']["org_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"finished_at": string | null,"id": string,"kind": string,"last_error": string | null,"locked_at": string | null,"locked_by": string | null,"max_attempts": number,"organization_id": string | null,"payload": NonNullable<Json>,"progress": NonNullable<Json>,"run_after": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"finished_at"?: string | null,"id"?: string,"kind": string,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"organization_id"?: string | null,"payload"?: NonNullable<Json>,"progress"?: NonNullable<Json>,"run_after"?: string,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"finished_at"?: string | null,"id"?: string,"kind"?: string,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"organization_id"?: string | null,"payload"?: NonNullable<Json>,"progress"?: NonNullable<Json>,"run_after"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"organization_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"organization_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "country": string,"created_at": string,"currency": string,"id": string,"name": string,"settings": NonNullable<Json>,"slug": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"name": string,"settings"?: NonNullable<Json>,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"name"?: string,"settings"?: NonNullable<Json>,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"category": string | null,"created_at": string,"id": string,"list_price": number | null,"name": string,"organization_id": string,"sku": string,"standard_cost": number | null,"unit": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category"?: string | null,"created_at"?: string,"id"?: string,"list_price"?: number | null,"name": string,"organization_id": string,"sku": string,"standard_cost"?: number | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"category"?: string | null,"created_at"?: string,"id"?: string,"list_price"?: number | null,"name"?: string,"organization_id"?: string,"sku"?: string,"standard_cost"?: number | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"receivables": {
                  Row: {
                    "amount": number,"created_at": string,"customer_id": string,"due_on": string,"external_ref": string,"id": string,"issued_on": string,"organization_id": string,"paid_amount": number,"sale_id": string | null,"source_import_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"customer_id": string,"due_on": string,"external_ref": string,"id"?: string,"issued_on": string,"organization_id": string,"paid_amount"?: number,"sale_id"?: string | null,"source_import_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"customer_id"?: string,"due_on"?: string,"external_ref"?: string,"id"?: string,"issued_on"?: string,"organization_id"?: string,"paid_amount"?: number,"sale_id"?: string | null,"source_import_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receivables_organization_id_customer_id_fkey"
      columns: ["organization_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "receivables_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receivables_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "receivables_source_import_fkey"
      columns: ["organization_id","source_import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"sale_lines": {
                  Row: {
                    "discount": number,"id": string,"line_total": number,"organization_id": string,"product_id": string,"quantity": number,"sale_id": string,"unit_cost": number | null,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "discount"?: number,"id"?: string,"line_total": number,"organization_id": string,"product_id": string,"quantity": number,"sale_id": string,"unit_cost"?: number | null,"unit_price": number
                  }
                  Update: {
                    "discount"?: number,"id"?: string,"line_total"?: number,"organization_id"?: string,"product_id"?: string,"quantity"?: number,"sale_id"?: string,"unit_cost"?: number | null,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_lines_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_lines_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "sale_lines_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "created_at": string,"currency": string,"customer_id": string,"external_ref": string,"id": string,"organization_id": string,"sold_on": string,"source_import_id": string | null,"status": string,"subtotal": number,"tax": number,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"customer_id": string,"external_ref": string,"id"?: string,"organization_id": string,"sold_on": string,"source_import_id"?: string | null,"status": string,"subtotal": number,"tax": number,"total": number
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"customer_id"?: string,"external_ref"?: string,"id"?: string,"organization_id"?: string,"sold_on"?: string,"source_import_id"?: string | null,"status"?: string,"subtotal"?: number,"tax"?: number,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_organization_id_customer_id_fkey"
      columns: ["organization_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "sales_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_source_import_fkey"
      columns: ["organization_id","source_import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "token": string }; Returns: string
                           },
"apply_import_customers":
{ Args: { "p_import_id": string,"p_organization_id": string,"p_rows": Json }; Returns: {
              "inserted_customers": number,"rejected": Json
            }[]
                           },
"apply_import_inventory":
{ Args: { "p_import_id": string,"p_organization_id": string,"p_rows": Json }; Returns: {
              "inserted_inventory": number,"rejected": Json
            }[]
                           },
"apply_import_products":
{ Args: { "p_import_id": string,"p_organization_id": string,"p_rows": Json }; Returns: {
              "inserted_products": number,"rejected": Json
            }[]
                           },
"apply_import_receivables":
{ Args: { "p_import_id": string,"p_organization_id": string,"p_rows": Json }; Returns: {
              "inserted_receivables": number,"rejected": Json
            }[]
                           },
"apply_import_sales":
{ Args: { "p_import_id": string,"p_organization_id": string,"p_rows": Json }; Returns: {
              "inserted_lines": number,"inserted_sales": number,"rejected": Json
            }[]
                           },
"claim_job":
{ Args: { "kinds": (string)[],"worker": string }; Returns: {
              "attempts": number,
"created_at": string,
"finished_at": string | null,
"id": string,
"kind": string,
"last_error": string | null,
"locked_at": string | null,
"locked_by": string | null,
"max_attempts": number,
"organization_id": string | null,
"payload": NonNullable<Json>,
"progress": NonNullable<Json>,
"run_after": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "jobs"
        isOneToOne: true
        isSetofReturn: false
      } },
"complete_job":
{ Args: { "id": string,"last_error": string,"status": string }; Returns: {
              "attempts": number,
"created_at": string,
"finished_at": string | null,
"id": string,
"kind": string,
"last_error": string | null,
"locked_at": string | null,
"locked_by": string | null,
"max_attempts": number,
"organization_id": string | null,
"payload": NonNullable<Json>,
"progress": NonNullable<Json>,
"run_after": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "jobs"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_organization":
{ Args: { "name": string,"slug": string }; Returns: {
              "country": string,
"created_at": string,
"currency": string,
"id": string,
"name": string,
"settings": NonNullable<Json>,
"slug": string,
"timezone": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "organizations"
        isOneToOne: true
        isSetofReturn: false
      } },
"my_org_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_org_ids_with_role":
{ Args: { "roles": (Database["public"]['Enums']["org_role"])[] }; Returns: string[]
                           },
"revert_import":
{ Args: { "p_import_id": string,"p_organization_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "org_role": "owner"|"admin"|"analyst"|"viewer"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "org_role": ["owner", "admin", "analyst", "viewer"]
          }
        }
} as const
