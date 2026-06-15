export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance_config: {
        Row: {
          full_day_hours: number
          grace_minutes: number
          half_day_hours: number
          id: boolean
          ip_allowlist: string[]
          office_lat: number
          office_lng: number
          overtime_after_hours: number
          quarter_day_hours: number
          radius_meters: number
          timezone: string
          updated_at: string
          work_end: string
          work_start: string
        }
        Insert: {
          full_day_hours?: number
          grace_minutes?: number
          half_day_hours?: number
          id?: boolean
          ip_allowlist?: string[]
          office_lat?: number
          office_lng?: number
          overtime_after_hours?: number
          quarter_day_hours?: number
          radius_meters?: number
          timezone?: string
          updated_at?: string
          work_end?: string
          work_start?: string
        }
        Update: {
          full_day_hours?: number
          grace_minutes?: number
          half_day_hours?: number
          id?: boolean
          ip_allowlist?: string[]
          office_lat?: number
          office_lng?: number
          overtime_after_hours?: number
          quarter_day_hours?: number
          radius_meters?: number
          timezone?: string
          updated_at?: string
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      attendance_days: {
        Row: {
          first_in_at: string | null
          id: string
          is_late: boolean
          last_out_at: string | null
          overtime_minutes: number
          punch_count: number
          status: string
          updated_at: string
          user_id: string
          work_date: string
          worked_minutes: number
        }
        Insert: {
          first_in_at?: string | null
          id?: string
          is_late?: boolean
          last_out_at?: string | null
          overtime_minutes?: number
          punch_count?: number
          status?: string
          updated_at?: string
          user_id: string
          work_date: string
          worked_minutes?: number
        }
        Update: {
          first_in_at?: string | null
          id?: string
          is_late?: boolean
          last_out_at?: string | null
          overtime_minutes?: number
          punch_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          work_date?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_punches: {
        Row: {
          created_at: string
          distance_meters: number | null
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          punch_type: string
          punched_at: string
          selfie_path: string | null
          user_id: string
          within_radius: boolean
          work_date: string
        }
        Insert: {
          created_at?: string
          distance_meters?: number | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          punch_type: string
          punched_at?: string
          selfie_path?: string | null
          user_id: string
          within_radius?: boolean
          work_date: string
        }
        Update: {
          created_at?: string
          distance_meters?: number | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          punch_type?: string
          punched_at?: string
          selfie_path?: string | null
          user_id?: string
          within_radius?: boolean
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_punches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          allocated: number
          id: string
          leave_type_id: string
          updated_at: string
          used: number
          user_id: string
          year: number
        }
        Insert: {
          allocated?: number
          id?: string
          leave_type_id: string
          updated_at?: string
          used?: number
          user_id: string
          year: number
        }
        Update: {
          allocated?: number
          id?: string
          leave_type_id?: string
          updated_at?: string
          used?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          decided_at: string | null
          decided_by: string | null
          decision_remarks: string | null
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: number
          decided_at?: string | null
          decided_by?: string | null
          decision_remarks?: string | null
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          decided_at?: string | null
          decided_by?: string | null
          decision_remarks?: string | null
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          created_at: string
          default_annual_quota: number
          id: string
          is_paid: boolean
          is_system: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_annual_quota?: number
          id?: string
          is_paid?: boolean
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_annual_quota?: number
          id?: string
          is_paid?: boolean
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      planning_compliance: {
        Row: {
          created_at: string
          day_end_submitted: boolean
          id: string
          next_day_submitted: boolean
          unlocked: boolean
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          day_end_submitted?: boolean
          id?: string
          next_day_submitted?: boolean
          unlocked?: boolean
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          day_end_submitted?: boolean
          id?: string
          next_day_submitted?: boolean
          unlocked?: boolean
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_compliance_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_compliance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_config: {
        Row: {
          day_end: string
          day_start: string
          id: boolean
          policy: string
          require_day_end: boolean
          require_next_day: boolean
          slot_interval_hours: number
          updated_at: string
        }
        Insert: {
          day_end?: string
          day_start?: string
          id?: boolean
          policy?: string
          require_day_end?: boolean
          require_next_day?: boolean
          slot_interval_hours?: number
          updated_at?: string
        }
        Update: {
          day_end?: string
          day_start?: string
          id?: boolean
          policy?: string
          require_day_end?: boolean
          require_next_day?: boolean
          slot_interval_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      planning_history: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          changed_by: string | null
          created_at: string
          id: string
          slot_id: string
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          created_at?: string
          id?: string
          slot_id: string
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          created_at?: string
          id?: string
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_history_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "planning_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_slots: {
        Row: {
          challenges: string | null
          created_at: string
          id: string
          kind: string
          plan_date: string
          progress: number
          remarks: string | null
          slot_index: number
          slot_label: string
          task_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenges?: string | null
          created_at?: string
          id?: string
          kind?: string
          plan_date: string
          progress?: number
          remarks?: string | null
          slot_index: number
          slot_label: string
          task_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenges?: string | null
          created_at?: string
          id?: string
          kind?: string
          plan_date?: string
          progress?: number
          remarks?: string | null
          slot_index?: number
          slot_label?: string
          task_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          employee_code: string | null
          full_name: string
          id: string
          phone: string | null
          reporting_manager_id: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          employee_code?: string | null
          full_name?: string
          id: string
          phone?: string | null
          reporting_manager_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          employee_code?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          reporting_manager_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          period_month: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          note?: string | null
          period_month: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          period_month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_policy: {
        Row: {
          half_day_factor: number
          id: boolean
          late_penalty_per_day: number
          overtime_rate_per_hour: number
          paid_leave_paid: boolean
          planning_penalty_per_day: number
          quarter_day_factor: number
          updated_at: string
          working_days_per_month: number
        }
        Insert: {
          half_day_factor?: number
          id?: boolean
          late_penalty_per_day?: number
          overtime_rate_per_hour?: number
          paid_leave_paid?: boolean
          planning_penalty_per_day?: number
          quarter_day_factor?: number
          updated_at?: string
          working_days_per_month?: number
        }
        Update: {
          half_day_factor?: number
          id?: boolean
          late_penalty_per_day?: number
          overtime_rate_per_hour?: number
          paid_leave_paid?: boolean
          planning_penalty_per_day?: number
          quarter_day_factor?: number
          updated_at?: string
          working_days_per_month?: number
        }
        Relationships: []
      }
      salary_profiles: {
        Row: {
          id: string
          monthly_ctc: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          monthly_ctc?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          monthly_ctc?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_runs: {
        Row: {
          absent_days: number
          base_earned: number
          breakdown: Json | null
          computed_at: string
          computed_by: string | null
          gross: number
          half_days: number
          id: string
          incentives: number
          increments: number
          late_count: number
          net: number
          overtime_minutes: number
          overtime_pay: number
          paid_leave_days: number
          penalties: number
          period_month: string
          planning_noncompliant_days: number
          present_days: number
          quarter_days: number
          status: string
          user_id: string
        }
        Insert: {
          absent_days?: number
          base_earned?: number
          breakdown?: Json | null
          computed_at?: string
          computed_by?: string | null
          gross?: number
          half_days?: number
          id?: string
          incentives?: number
          increments?: number
          late_count?: number
          net?: number
          overtime_minutes?: number
          overtime_pay?: number
          paid_leave_days?: number
          penalties?: number
          period_month: string
          planning_noncompliant_days?: number
          present_days?: number
          quarter_days?: number
          status?: string
          user_id: string
        }
        Update: {
          absent_days?: number
          base_earned?: number
          breakdown?: Json | null
          computed_at?: string
          computed_by?: string | null
          gross?: number
          half_days?: number
          id?: string
          incentives?: number
          increments?: number
          late_count?: number
          net?: number
          overtime_minutes?: number
          overtime_pay?: number
          paid_leave_days?: number
          penalties?: number
          period_month?: string
          planning_noncompliant_days?: number
          present_days?: number
          quarter_days?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_runs_computed_by_fkey"
            columns: ["computed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status_id: string | null
          id: string
          remarks: string | null
          task_id: string
          to_status_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status_id?: string | null
          id?: string
          remarks?: string | null
          task_id: string
          to_status_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status_id?: string | null
          id?: string
          remarks?: string | null
          task_id?: string
          to_status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      task_statuses: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          is_terminal: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          is_terminal?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          is_terminal?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status_id: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status_id: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status_id?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: string
          reporting_manager_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          name: string
          reporting_manager_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: string
          reporting_manager_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attendance_punch: {
        Args: {
          p_ip?: string
          p_lat: number
          p_lng: number
          p_selfie_path?: string
          p_type: string
        }
        Returns: Json
      }
      decide_leave: {
        Args: { p_decision: string; p_remarks?: string; p_request: string }
        Returns: Json
      }
      has_permission: { Args: { perm: string }; Returns: boolean }
      haversine_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      health_check: { Args: never; Returns: string }
      my_permissions: { Args: never; Returns: string[] }
      my_roles: { Args: never; Returns: string[] }
      recompute_attendance_day: {
        Args: { p_date: string; p_user: string }
        Returns: undefined
      }
      submit_planning_compliance: {
        Args: { p_date: string; p_part: string }
        Returns: Json
      }
      unlock_planning: {
        Args: { p_date: string; p_user: string }
        Returns: Json
      }
      update_task_status: {
        Args: { p_remarks?: string; p_status: string; p_task: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

