// Hand-written to mirror supabase/migrations/0001_foundation.sql through
// 0010_weekly_planner.sql.
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
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "CANCELLED";
export type PriorityLevel = "P1" | "P2" | "P3" | "P4";
export type TimeEntrySource = "SYSTEM_TRACKED" | "RECONSTRUCTED" | "SELF_DECLARED";

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
          valid_from: string;
          valid_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          role: AppRole;
          organization_id?: string | null;
          valid_from?: string;
          valid_to?: string | null;
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
          source_playbook_workstream_id: string | null;
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
          source_playbook_workstream_id?: string | null;
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
          source_playbook_task_id: string | null;
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
          // Null at APPROVED/COMPLETED/CANCELLED — there is no next action.
          current_holder_person_id: string | null;
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
          source_playbook_task_id?: string | null;
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
          // this on every insert/update.
          current_holder_person_id?: string | null;
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
      task_submissions: {
        Row: {
          id: string;
          task_id: string;
          version: number;
          message: string | null;
          link: string | null;
          file_path: string | null;
          submitted_by_person_id: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          version: number;
          message?: string | null;
          link?: string | null;
          file_path?: string | null;
          submitted_by_person_id: string;
          submitted_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["task_submissions"]["Insert"]
        >;
        Relationships: [];
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          author_person_id: string;
          body: string;
          is_question: boolean;
          mentioned_person_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          author_person_id: string;
          body: string;
          is_question?: boolean;
          mentioned_person_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["task_comments"]["Insert"]
        >;
        Relationships: [];
      };
      playbooks: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["playbooks"]["Insert"]>;
        Relationships: [];
      };
      playbook_workstreams: {
        Row: {
          id: string;
          playbook_id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["playbook_workstreams"]["Insert"]
        >;
        Relationships: [];
      };
      playbook_tasks: {
        Row: {
          id: string;
          playbook_id: string;
          playbook_workstream_id: string | null;
          title: string;
          description: string | null;
          deliverable: string | null;
          completion_criteria: string | null;
          requires_reviewer: boolean;
          tag: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          playbook_workstream_id?: string | null;
          title: string;
          description?: string | null;
          deliverable?: string | null;
          completion_criteria?: string | null;
          requires_reviewer?: boolean;
          tag?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["playbook_tasks"]["Insert"]
        >;
        Relationships: [];
      };
      playbook_conditional_rules: {
        Row: {
          id: string;
          playbook_id: string;
          if_tag: string;
          then_tag: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          if_tag: string;
          then_tag: string;
          message: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["playbook_conditional_rules"]["Insert"]
        >;
        Relationships: [];
      };
      attendance_sessions: {
        Row: {
          id: string;
          person_id: string;
          clock_in_at: string;
          clock_out_at: string | null;
          source: TimeEntrySource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          clock_in_at: string;
          clock_out_at?: string | null;
          source?: TimeEntrySource;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["attendance_sessions"]["Insert"]
        >;
        Relationships: [];
      };
      attendance_breaks: {
        Row: {
          id: string;
          attendance_session_id: string;
          break_start_at: string;
          break_end_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attendance_session_id: string;
          break_start_at: string;
          break_end_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["attendance_breaks"]["Insert"]
        >;
        Relationships: [];
      };
      task_time_entries: {
        Row: {
          id: string;
          task_id: string;
          person_id: string;
          started_at: string;
          ended_at: string | null;
          source: TimeEntrySource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          person_id: string;
          started_at: string;
          ended_at?: string | null;
          source?: TimeEntrySource;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["task_time_entries"]["Insert"]
        >;
        Relationships: [];
      };
      time_corrections: {
        Row: {
          id: string;
          target_table: string;
          target_id: string;
          field_name: string;
          old_value: string | null;
          new_value: string | null;
          reason: string | null;
          corrected_by_person_id: string;
          corrected_at: string;
        };
        Insert: {
          id?: string;
          target_table: string;
          target_id: string;
          field_name: string;
          old_value?: string | null;
          new_value?: string | null;
          reason?: string | null;
          corrected_by_person_id: string;
          corrected_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["time_corrections"]["Insert"]
        >;
        Relationships: [];
      };
      personal_planner_items: {
        Row: {
          id: string;
          person_id: string;
          title: string;
          notes: string | null;
          is_important: boolean;
          is_urgent: boolean;
          deadline: string | null;
          estimated_hours: number | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          title: string;
          notes?: string | null;
          is_important?: boolean;
          is_urgent?: boolean;
          deadline?: string | null;
          estimated_hours?: number | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["personal_planner_items"]["Insert"]
        >;
        Relationships: [];
      };
      availability: {
        Row: {
          id: string;
          person_id: string;
          date: string;
          start_time: string;
          end_time: string;
          status: "free" | "busy" | "maybe";
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          date: string;
          start_time: string;
          end_time: string;
          status: "free" | "busy" | "maybe";
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["availability"]["Insert"]>;
        Relationships: [];
      };
      planned_slots: {
        Row: {
          id: string;
          person_id: string;
          workboard_task_id: string | null;
          personal_planner_item_id: string | null;
          date: string;
          start_time: string;
          end_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          workboard_task_id?: string | null;
          personal_planner_item_id?: string | null;
          date: string;
          start_time: string;
          end_time: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["planned_slots"]["Insert"]>;
        Relationships: [];
      };
      suggestions: {
        Row: {
          id: string;
          task_id: string;
          suggested_by: string;
          suggested_is_important: boolean;
          suggested_is_urgent: boolean;
          reason: string | null;
          status: "pending" | "accepted" | "rejected";
          created_at: string;
          responded_at: string | null;
          applied_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          suggested_by: string;
          suggested_is_important: boolean;
          suggested_is_urgent: boolean;
          reason?: string | null;
          status?: "pending" | "accepted" | "rejected";
          created_at?: string;
          responded_at?: string | null;
          applied_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["suggestions"]["Insert"]>;
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
      is_task_assignee_side_actor: {
        Args: { check_task_id: string };
        Returns: boolean;
      };
      is_task_holder_side_actor: {
        Args: { check_task_id: string };
        Returns: boolean;
      };
      acknowledge_task: {
        Args: { p_task_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      start_task: {
        Args: { p_task_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      submit_task: {
        Args: { p_task_id: string; p_message?: string | null; p_link?: string | null };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      begin_review: {
        Args: { p_task_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      request_revision: {
        Args: { p_task_id: string; p_note?: string | null };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      resubmit_task: {
        Args: { p_task_id: string; p_message?: string | null; p_link?: string | null };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      approve_task: {
        Args: { p_task_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      complete_task: {
        Args: { p_task_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      submit_for_approval: {
        Args: { p_task_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      apply_playbook_to_project: {
        Args: { p_project_id: string; p_playbook_id: string };
        Returns: number;
      };
      clock_in: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["attendance_sessions"]["Row"];
      };
      start_break: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["attendance_breaks"]["Row"];
      };
      resume_from_break: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["attendance_breaks"]["Row"];
      };
      clock_out: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["attendance_sessions"]["Row"];
      };
      start_task_timer: {
        Args: { p_task_id: string };
        Returns: Database["public"]["Tables"]["task_time_entries"]["Row"];
      };
      pause_task_timer: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["task_time_entries"]["Row"];
      };
      switch_task_timer: {
        Args: { p_task_id: string };
        Returns: Database["public"]["Tables"]["task_time_entries"]["Row"];
      };
      correct_attendance_session: {
        Args: {
          p_session_id: string;
          p_clock_in_at: string;
          p_clock_out_at: string | null;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["attendance_sessions"]["Row"];
      };
      correct_task_time_entry: {
        Args: {
          p_entry_id: string;
          p_started_at: string;
          p_ended_at: string | null;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["task_time_entries"]["Row"];
      };
      person_organization_ids: {
        Args: { check_person_id: string };
        Returns: string[];
      };
      is_head_over_person: {
        Args: { check_person_id: string };
        Returns: boolean;
      };
      time_correction_target_person: {
        Args: { p_target_table: string; p_target_id: string };
        Returns: string;
      };
      is_chair: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      respond_to_suggestion: {
        Args: { p_suggestion_id: string; p_status: string };
        Returns: Database["public"]["Tables"]["suggestions"]["Row"];
      };
      create_manual_task: {
        Args: {
          p_project_id: string;
          p_title: string;
          p_description?: string | null;
          p_workstream_id?: string | null;
          p_assignee_person_id?: string | null;
          p_reviewer_person_id?: string | null;
          p_approver_person_id?: string | null;
          p_deadline?: string | null;
          p_estimated_hours?: number | null;
          p_is_important?: boolean;
          p_is_urgent?: boolean;
        };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      create_project_with_optional_playbook: {
        Args: {
          p_organization_id: string;
          p_name: string;
          p_description?: string | null;
          p_start_date?: string | null;
          p_target_date?: string | null;
          p_playbook_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["projects"]["Row"];
      };
      managed_people_in_organizations: {
        Args: { p_organization_ids: string[] };
        Returns: {
          person_id: string;
          full_name: string;
          organization_id: string;
        }[];
      };
      manage_task_people: {
        Args: {
          p_task_id: string;
          p_assignee_person_id: string;
          p_reviewer_person_id?: string | null;
          p_approver_person_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      apply_accepted_suggestion: {
        Args: { p_suggestion_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
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
      time_entry_source: TimeEntrySource;
    };
  };
}
