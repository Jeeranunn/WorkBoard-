// Hand-written to mirror supabase/migrations/0001_foundation.sql and
// 0002_foundation_corrections.sql.
// Once a live Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type AppRole = "ADMIN" | "HEAD" | "MEMBER" | "EXECUTIVE";
export type TeamType = "WORKING" | "PROJECT";

export interface Database {
  public: {
    Tables: {
      networks: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["networks"]["Insert"]>;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          network_id: string;
          name: string;
          is_active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          network_id: string;
          name: string;
          is_active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["organizations"]["Insert"]
        >;
        Relationships: [];
      };
      organization_units: {
        Row: {
          id: string;
          organization_id: string;
          parent_unit_id: string | null;
          name: string;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          parent_unit_id?: string | null;
          name: string;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["organization_units"]["Insert"]
        >;
        Relationships: [];
      };
      positions: {
        Row: {
          id: string;
          unit_id: string;
          title: string;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          title: string;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["positions"]["Insert"]>;
        Relationships: [];
      };
      people: {
        Row: {
          id: string;
          auth_user_id: string | null;
          full_name: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          full_name: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["people"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          person_id: string;
          position_id: string;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          position_id: string;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["appointments"]["Insert"]
        >;
        Relationships: [];
      };
      person_roles: {
        Row: {
          id: string;
          person_id: string;
          role: AppRole;
          organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          role: AppRole;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["person_roles"]["Insert"]
        >;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          network_id: string;
          owner_organization_id: string | null;
          team_type: TeamType;
          name: string;
          is_active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          network_id: string;
          owner_organization_id?: string | null;
          team_type: TeamType;
          name: string;
          is_active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
      team_memberships: {
        Row: {
          id: string;
          team_id: string;
          person_id: string;
          role_in_team: string | null;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          person_id: string;
          role_in_team?: string | null;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["team_memberships"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_person_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      has_role: {
        Args: { check_role: AppRole };
        Returns: boolean;
      };
      has_role_in_organization: {
        Args: { check_role: AppRole; org_id: string };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_executive: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      app_role: AppRole;
      team_type_enum: TeamType;
    };
  };
}
