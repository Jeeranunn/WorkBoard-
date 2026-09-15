// Hand-written to mirror supabase/migrations/0001_foundation.sql,
// 0002_foundation_corrections.sql, and 0003_work_core.sql.
// Once a live Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type AppRole = "ADMIN" | "HEAD" | "MEMBER" | "EXECUTIVE";
export type TeamType = "WORKING" | "PROJECT";
export type ProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";
export type ProjectHealth = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
export type MilestoneStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "ACHIEVED"
  | "MISSED"
  | "CANCELLED";
export type WorkOrigin = "PLANNED" | "ADDED" | "SCOPE_CHANGE";
export type TaskStatus =
  | "ASSIGNED"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "REVISION_REQUIRED"
  | "RESUBMITTED"
  | "APPROVED"
  | "COMPLETED"
  | "CANCELLED";
export type PriorityLevel = "P1" | "P2" | "P3" | "P4";

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
      projects: {
        Row: {
          id: string;
          organization_id: string;
          owner_person_id: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          health: ProjectHealth;
          start_date: string | null;
          target_date: string | null;
          is_active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          owner_person_id: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          health?: ProjectHealth;
          start_date?: string | null;
          target_date?: string | null;
          is_active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      workstreams: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          owner_person_id: string | null;
          sort_order: number;
          work_origin: WorkOrigin;
          is_active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          owner_person_id?: string | null;
          sort_order?: number;
          work_origin?: WorkOrigin;
          is_active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["workstreams"]["Insert"]
        >;
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          project_id: string;
          workstream_id: string | null;
          name: string;
          target_date: string | null;
          status: MilestoneStatus;
          work_origin: WorkOrigin;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          workstream_id?: string | null;
          name: string;
          target_date?: string | null;
          status?: MilestoneStatus;
          work_origin?: WorkOrigin;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["milestones"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          workstream_id: string | null;
          milestone_id: string | null;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          deliverable: string | null;
          completion_criteria: string | null;
          source: string | null;
          work_origin: WorkOrigin;
          status: TaskStatus;
          assignee_person_id: string;
          reviewer_person_id: string | null;
          approver_person_id: string | null;
          current_holder_person_id: string;
          deadline: string | null;
          estimated_hours: number | null;
          is_important: boolean;
          is_urgent: boolean;
          priority: PriorityLevel;
          is_blocked: boolean;
          blocked_reason: string | null;
          is_waiting: boolean;
          waiting_reason: string | null;
          is_on_hold: boolean;
          on_hold_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          workstream_id?: string | null;
          milestone_id?: string | null;
          parent_task_id?: string | null;
          title: string;
          description?: string | null;
          deliverable?: string | null;
          completion_criteria?: string | null;
          source?: string | null;
          work_origin?: WorkOrigin;
          status?: TaskStatus;
          assignee_person_id: string;
          reviewer_person_id?: string | null;
          approver_person_id?: string | null;
          // Ignored in practice — compute_task_current_holder() overwrites
          // this on every insert/update. Still required at the type level
          // because the column is NOT NULL with no database default.
          current_holder_person_id?: string;
          deadline?: string | null;
          estimated_hours?: number | null;
          is_important?: boolean;
          is_urgent?: boolean;
          is_blocked?: boolean;
          blocked_reason?: string | null;
          is_waiting?: boolean;
          waiting_reason?: string | null;
          is_on_hold?: boolean;
          on_hold_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      task_collaborators: {
        Row: {
          task_id: string;
          person_id: string;
          created_at: string;
        };
        Insert: {
          task_id: string;
          person_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["task_collaborators"]["Insert"]
        >;
        Relationships: [];
      };
      task_dependencies: {
        Row: {
          predecessor_task_id: string;
          successor_task_id: string;
          created_at: string;
        };
        Insert: {
          predecessor_task_id: string;
          successor_task_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["task_dependencies"]["Insert"]
        >;
        Relationships: [];
      };
      team_projects: {
        Row: {
          id: string;
          team_id: string;
          project_id: string;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          project_id: string;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["team_projects"]["Insert"]
        >;
        Relationships: [];
      };
      task_history: {
        Row: {
          id: string;
          task_id: string;
          changed_by_person_id: string | null;
          field_name: string;
          old_value: string | null;
          new_value: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          changed_by_person_id?: string | null;
          field_name: string;
          old_value?: string | null;
          new_value?: string | null;
          changed_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["task_history"]["Insert"]
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
      project_organization_id: {
        Args: { check_project_id: string };
        Returns: string;
      };
      task_organization_id: {
        Args: { check_task_id: string };
        Returns: string;
      };
      can_view_project: {
        Args: { check_project_id: string };
        Returns: boolean;
      };
      can_view_task: {
        Args: { check_task_id: string };
        Returns: boolean;
      };
      is_task_overdue: {
        Args: { check_task_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: AppRole;
      team_type_enum: TeamType;
      project_status: ProjectStatus;
      project_health: ProjectHealth;
      milestone_status: MilestoneStatus;
      work_origin: WorkOrigin;
      task_status: TaskStatus;
      priority_level: PriorityLevel;
    };
  };
}
