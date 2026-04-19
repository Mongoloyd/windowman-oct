export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          analysis_status: string
          anonymized_lead_id: string | null
          confidence_score: number | null
          contractor_brief: string | null
          contractor_brief_generated_at: string | null
          contractor_brief_json: Json | null
          created_at: string
          document_is_window_door_related: boolean | null
          document_type: string | null
          dollar_delta: number | null
          flags: Json | null
          full_json: Json | null
          grade: string | null
          id: string
          lead_id: string | null
          markup_estimate: string | null
          negotiation_leverage: string | null
          negotiation_script: Json | null
          negotiation_script_generated_at: string | null
          preview_json: Json | null
          price_fairness: string | null
          proof_of_read: Json | null
          rubric_version: string | null
          scan_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          analysis_status?: string
          anonymized_lead_id?: string | null
          confidence_score?: number | null
          contractor_brief?: string | null
          contractor_brief_generated_at?: string | null
          contractor_brief_json?: Json | null
          created_at?: string
          document_is_window_door_related?: boolean | null
          document_type?: string | null
          dollar_delta?: number | null
          flags?: Json | null
          full_json?: Json | null
          grade?: string | null
          id?: string
          lead_id?: string | null
          markup_estimate?: string | null
          negotiation_leverage?: string | null
          negotiation_script?: Json | null
          negotiation_script_generated_at?: string | null
          preview_json?: Json | null
          price_fairness?: string | null
          proof_of_read?: Json | null
          rubric_version?: string | null
          scan_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          analysis_status?: string
          anonymized_lead_id?: string | null
          confidence_score?: number | null
          contractor_brief?: string | null
          contractor_brief_generated_at?: string | null
          contractor_brief_json?: Json | null
          created_at?: string
          document_is_window_door_related?: boolean | null
          document_type?: string | null
          dollar_delta?: number | null
          flags?: Json | null
          full_json?: Json | null
          grade?: string | null
          id?: string
          lead_id?: string | null
          markup_estimate?: string | null
          negotiation_leverage?: string | null
          negotiation_script?: Json | null
          negotiation_script_generated_at?: string | null
          preview_json?: Json | null
          price_fairness?: string | null
          proof_of_read?: Json | null
          rubric_version?: string | null
          scan_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_scan_session_id_fkey"
            columns: ["scan_session_id"]
            isOneToOne: false
            referencedRelation: "scan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      billable_intros: {
        Row: {
          analysis_id: string | null
          billing_model: string | null
          billing_status: string
          contact_released_at: string | null
          contractor_id: string
          created_at: string
          currency: string
          disputed_at: string | null
          fee_amount: number | null
          id: string
          invoice_reference: string | null
          lead_id: string
          notes: string | null
          opportunity_id: string
          paid_at: string | null
          refunded_at: string | null
          release_approved_at: string | null
          released_by: string | null
          route_id: string
          updated_at: string
          waived_at: string | null
        }
        Insert: {
          analysis_id?: string | null
          billing_model?: string | null
          billing_status?: string
          contact_released_at?: string | null
          contractor_id: string
          created_at?: string
          currency?: string
          disputed_at?: string | null
          fee_amount?: number | null
          id?: string
          invoice_reference?: string | null
          lead_id: string
          notes?: string | null
          opportunity_id: string
          paid_at?: string | null
          refunded_at?: string | null
          release_approved_at?: string | null
          released_by?: string | null
          route_id: string
          updated_at?: string
          waived_at?: string | null
        }
        Update: {
          analysis_id?: string | null
          billing_model?: string | null
          billing_status?: string
          contact_released_at?: string | null
          contractor_id?: string
          created_at?: string
          currency?: string
          disputed_at?: string | null
          fee_amount?: number | null
          id?: string
          invoice_reference?: string | null
          lead_id?: string
          notes?: string | null
          opportunity_id?: string
          paid_at?: string | null
          refunded_at?: string | null
          release_approved_at?: string | null
          released_by?: string | null
          route_id?: string
          updated_at?: string
          waived_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billable_intros_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billable_intros_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billable_intros_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billable_intros_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "contractor_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billable_intros_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: true
            referencedRelation: "contractor_opportunity_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      capi_signal_logs: {
        Row: {
          client_slug: string | null
          event_name: string | null
          fired_at: string
          id: string
          payload: Json | null
          pixel_id: string | null
          response: Json | null
          status_code: number | null
        }
        Insert: {
          client_slug?: string | null
          event_name?: string | null
          fired_at?: string
          id?: string
          payload?: Json | null
          pixel_id?: string | null
          response?: Json | null
          status_code?: number | null
        }
        Update: {
          client_slug?: string | null
          event_name?: string | null
          fired_at?: string
          id?: string
          payload?: Json | null
          pixel_id?: string | null
          response?: Json | null
          status_code?: number | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      contractor_activity_log: {
        Row: {
          activity_data: Json
          activity_type: Database["public"]["Enums"]["contractor_activity_type"]
          contractor_lead_id: string
          created_at: string
          id: string
        }
        Insert: {
          activity_data?: Json
          activity_type: Database["public"]["Enums"]["contractor_activity_type"]
          contractor_lead_id: string
          created_at?: string
          id?: string
        }
        Update: {
          activity_data?: Json
          activity_type?: Database["public"]["Enums"]["contractor_activity_type"]
          contractor_lead_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_activity_log_contractor_lead_id_fkey"
            columns: ["contractor_lead_id"]
            isOneToOne: false
            referencedRelation: "contractor_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_credit_ledger: {
        Row: {
          balance_after: number
          contractor_id: string
          created_at: string
          created_by: string | null
          delta: number
          entry_type: string
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          balance_after: number
          contractor_id: string
          created_at?: string
          created_by?: string | null
          delta: number
          entry_type: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          balance_after?: number
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          delta?: number
          entry_type?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_credit_ledger_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_credit_purchases: {
        Row: {
          amount_total_cents: number
          contractor_id: string
          created_at: string
          credit_pack_code: string
          credits_purchased: number
          currency: string
          fulfilled_at: string | null
          id: string
          status: string
          stripe_checkout_session_id: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_total_cents: number
          contractor_id: string
          created_at?: string
          credit_pack_code: string
          credits_purchased: number
          currency?: string
          fulfilled_at?: string | null
          id?: string
          status?: string
          stripe_checkout_session_id: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_total_cents?: number
          contractor_id?: string
          created_at?: string
          credit_pack_code?: string
          credits_purchased?: number
          currency?: string
          fulfilled_at?: string | null
          id?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_credit_purchases_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_credits: {
        Row: {
          balance: number
          contractor_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          contractor_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          contractor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_credits_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: true
            referencedRelation: "contractor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_followups: {
        Row: {
          contractor_lead_id: string
          created_at: string
          followup_type: Database["public"]["Enums"]["contractor_followup_type"]
          id: string
          payload: Json
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["contractor_followup_status"]
        }
        Insert: {
          contractor_lead_id: string
          created_at?: string
          followup_type: Database["public"]["Enums"]["contractor_followup_type"]
          id?: string
          payload?: Json
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["contractor_followup_status"]
        }
        Update: {
          contractor_lead_id?: string
          created_at?: string
          followup_type?: Database["public"]["Enums"]["contractor_followup_type"]
          id?: string
          payload?: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["contractor_followup_status"]
        }
        Relationships: [
          {
            foreignKeyName: "contractor_followups_contractor_lead_id_fkey"
            columns: ["contractor_lead_id"]
            isOneToOne: false
            referencedRelation: "contractor_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          contractor_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          initial_credits: number
          invite_token: string
          invited_email: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          contractor_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          initial_credits?: number
          invite_token?: string
          invited_email: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          initial_credits?: number
          invite_token?: string
          invited_email?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contractor_leads: {
        Row: {
          average_job_size_band: string | null
          booking_status: Database["public"]["Enums"]["contractor_booking_status"]
          calendly_event_end: string | null
          calendly_event_start: string | null
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          close_rate_band: string | null
          company_name: string | null
          created_at: string
          email: string
          first_name: string | null
          follow_up_consistency: string | null
          id: string
          installs_regularly: string | null
          last_name: string | null
          monthly_lead_volume_band: string | null
          notes: string | null
          owner_name: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["contractor_pipeline_stage"]
          qualification_score: number
          qualification_status: Database["public"]["Enums"]["contractor_qualification_status"]
          response_speed: string | null
          service_area: string | null
          source: string | null
          territory_requested: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          wants_quality_over_volume: string | null
        }
        Insert: {
          average_job_size_band?: string | null
          booking_status?: Database["public"]["Enums"]["contractor_booking_status"]
          calendly_event_end?: string | null
          calendly_event_start?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          close_rate_band?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          follow_up_consistency?: string | null
          id?: string
          installs_regularly?: string | null
          last_name?: string | null
          monthly_lead_volume_band?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["contractor_pipeline_stage"]
          qualification_score?: number
          qualification_status?: Database["public"]["Enums"]["contractor_qualification_status"]
          response_speed?: string | null
          service_area?: string | null
          source?: string | null
          territory_requested?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wants_quality_over_volume?: string | null
        }
        Update: {
          average_job_size_band?: string | null
          booking_status?: Database["public"]["Enums"]["contractor_booking_status"]
          calendly_event_end?: string | null
          calendly_event_start?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          close_rate_band?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          follow_up_consistency?: string | null
          id?: string
          installs_regularly?: string | null
          last_name?: string | null
          monthly_lead_volume_band?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["contractor_pipeline_stage"]
          qualification_score?: number
          qualification_status?: Database["public"]["Enums"]["contractor_qualification_status"]
          response_speed?: string | null
          service_area?: string | null
          source?: string | null
          territory_requested?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wants_quality_over_volume?: string | null
        }
        Relationships: []
      }
      contractor_opportunities: {
        Row: {
          amber_flag_count: number
          analysis_id: string
          assigned_operator: string | null
          brief_generated_at: string | null
          brief_json: Json | null
          brief_text: string | null
          brief_version: string | null
          county: string | null
          created_at: string
          cta_source: string | null
          flag_count: number
          grade: string | null
          homeowner_contact_released_at: string | null
          id: string
          internal_notes: string | null
          intro_requested_at: string
          last_call_intent: string | null
          last_call_requested_at: string | null
          last_call_webhook_error: string | null
          last_call_webhook_status: string | null
          last_interest_at: string | null
          last_release_at: string | null
          lead_id: string
          priority_score: number
          project_type: string | null
          quote_range: string | null
          red_flag_count: number
          release_ready: boolean
          routed_at: string | null
          scan_session_id: string
          sent_at: string | null
          status: string
          suggested_contractor_id: string | null
          suggested_match_confidence: string | null
          suggested_match_generated_at: string | null
          suggested_match_overridden: boolean | null
          suggested_match_overridden_at: string | null
          suggested_match_override_reason: string | null
          suggested_match_reasons: Json | null
          suggested_match_snapshot: Json | null
          suggested_match_top_candidates: Json | null
          updated_at: string
          window_count: number | null
        }
        Insert: {
          amber_flag_count?: number
          analysis_id: string
          assigned_operator?: string | null
          brief_generated_at?: string | null
          brief_json?: Json | null
          brief_text?: string | null
          brief_version?: string | null
          county?: string | null
          created_at?: string
          cta_source?: string | null
          flag_count?: number
          grade?: string | null
          homeowner_contact_released_at?: string | null
          id?: string
          internal_notes?: string | null
          intro_requested_at?: string
          last_call_intent?: string | null
          last_call_requested_at?: string | null
          last_call_webhook_error?: string | null
          last_call_webhook_status?: string | null
          last_interest_at?: string | null
          last_release_at?: string | null
          lead_id: string
          priority_score?: number
          project_type?: string | null
          quote_range?: string | null
          red_flag_count?: number
          release_ready?: boolean
          routed_at?: string | null
          scan_session_id: string
          sent_at?: string | null
          status?: string
          suggested_contractor_id?: string | null
          suggested_match_confidence?: string | null
          suggested_match_generated_at?: string | null
          suggested_match_overridden?: boolean | null
          suggested_match_overridden_at?: string | null
          suggested_match_override_reason?: string | null
          suggested_match_reasons?: Json | null
          suggested_match_snapshot?: Json | null
          suggested_match_top_candidates?: Json | null
          updated_at?: string
          window_count?: number | null
        }
        Update: {
          amber_flag_count?: number
          analysis_id?: string
          assigned_operator?: string | null
          brief_generated_at?: string | null
          brief_json?: Json | null
          brief_text?: string | null
          brief_version?: string | null
          county?: string | null
          created_at?: string
          cta_source?: string | null
          flag_count?: number
          grade?: string | null
          homeowner_contact_released_at?: string | null
          id?: string
          internal_notes?: string | null
          intro_requested_at?: string
          last_call_intent?: string | null
          last_call_requested_at?: string | null
          last_call_webhook_error?: string | null
          last_call_webhook_status?: string | null
          last_interest_at?: string | null
          last_release_at?: string | null
          lead_id?: string
          priority_score?: number
          project_type?: string | null
          quote_range?: string | null
          red_flag_count?: number
          release_ready?: boolean
          routed_at?: string | null
          scan_session_id?: string
          sent_at?: string | null
          status?: string
          suggested_contractor_id?: string | null
          suggested_match_confidence?: string | null
          suggested_match_generated_at?: string | null
          suggested_match_overridden?: boolean | null
          suggested_match_overridden_at?: string | null
          suggested_match_override_reason?: string | null
          suggested_match_reasons?: Json | null
          suggested_match_snapshot?: Json | null
          suggested_match_top_candidates?: Json | null
          updated_at?: string
          window_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_opportunities_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_opportunities_scan_session_id_fkey"
            columns: ["scan_session_id"]
            isOneToOne: true
            referencedRelation: "scan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_opportunities_suggested_contractor_id_fkey"
            columns: ["suggested_contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_opportunity_routes: {
        Row: {
          assigned_by: string | null
          contact_released: boolean
          contact_released_at: string | null
          contractor_id: string
          created_at: string
          id: string
          interest_notes: string | null
          interested_at: string | null
          opportunity_id: string
          release_denial_reason: string | null
          release_requested_at: string | null
          release_reviewed_at: string | null
          release_reviewed_by: string | null
          release_status: string
          responded_at: string | null
          response_notes: string | null
          route_status: string
          routing_reason: string | null
          sent_at: string | null
          viewed_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          contact_released?: boolean
          contact_released_at?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          interest_notes?: string | null
          interested_at?: string | null
          opportunity_id: string
          release_denial_reason?: string | null
          release_requested_at?: string | null
          release_reviewed_at?: string | null
          release_reviewed_by?: string | null
          release_status?: string
          responded_at?: string | null
          response_notes?: string | null
          route_status?: string
          routing_reason?: string | null
          sent_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          contact_released?: boolean
          contact_released_at?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          interest_notes?: string | null
          interested_at?: string | null
          opportunity_id?: string
          release_denial_reason?: string | null
          release_requested_at?: string | null
          release_reviewed_at?: string | null
          release_reviewed_by?: string | null
          release_status?: string
          responded_at?: string | null
          response_notes?: string | null
          route_status?: string
          routing_reason?: string | null
          sent_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_opportunity_routes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_opportunity_routes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "contractor_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_outcomes: {
        Row: {
          appointment_booked_at: string | null
          appointment_status: string | null
          billable_intro_id: string
          closed_at: string | null
          contractor_id: string | null
          created_at: string
          deal_status: string | null
          deal_value: number | null
          did_beat_price: boolean | null
          did_fix_scope_gaps: boolean | null
          did_improve_warranty: boolean | null
          id: string
          opportunity_id: string
          outcome_notes: string | null
          quote_status: string | null
          replacement_quote_range: string | null
          route_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_booked_at?: string | null
          appointment_status?: string | null
          billable_intro_id: string
          closed_at?: string | null
          contractor_id?: string | null
          created_at?: string
          deal_status?: string | null
          deal_value?: number | null
          did_beat_price?: boolean | null
          did_fix_scope_gaps?: boolean | null
          did_improve_warranty?: boolean | null
          id?: string
          opportunity_id: string
          outcome_notes?: string | null
          quote_status?: string | null
          replacement_quote_range?: string | null
          route_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_booked_at?: string | null
          appointment_status?: string | null
          billable_intro_id?: string
          closed_at?: string | null
          contractor_id?: string | null
          created_at?: string
          deal_status?: string | null
          deal_value?: number | null
          did_beat_price?: boolean | null
          did_fix_scope_gaps?: boolean | null
          did_improve_warranty?: boolean | null
          id?: string
          opportunity_id?: string
          outcome_notes?: string | null
          quote_status?: string | null
          replacement_quote_range?: string | null
          route_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_outcomes_billable_intro_id_fkey"
            columns: ["billable_intro_id"]
            isOneToOne: true
            referencedRelation: "billable_intros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_outcomes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_outcomes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "contractor_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_outcomes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "contractor_opportunity_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_profiles: {
        Row: {
          company_name: string
          contact_email: string
          created_at: string
          id: string
          status: string
        }
        Insert: {
          company_name: string
          contact_email: string
          created_at?: string
          id: string
          status?: string
        }
        Update: {
          company_name?: string
          contact_email?: string
          created_at?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      contractor_unlocked_leads: {
        Row: {
          contractor_id: string
          id: string
          lead_id: string
          unlocked_at: string
        }
        Insert: {
          contractor_id: string
          id?: string
          lead_id: string
          unlocked_at?: string
        }
        Update: {
          contractor_id?: string
          id?: string
          lead_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_unlocked_leads_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_unlocked_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          accepts_low_grade_leads: boolean
          auth_user_id: string | null
          budget_bands: string[]
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_vetted: boolean
          max_leads_per_week: number | null
          max_window_count: number | null
          min_window_count: number | null
          notes: string | null
          phone_e164: string | null
          preferred_contact_method: string | null
          pricing_model: string | null
          project_types: string[]
          routing_setup_completed_at: string | null
          schedule_notes: string | null
          service_counties: string[]
          service_regions: string[]
          status: string
          updated_at: string
          vetted_at: string | null
        }
        Insert: {
          accepts_low_grade_leads?: boolean
          auth_user_id?: string | null
          budget_bands?: string[]
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_vetted?: boolean
          max_leads_per_week?: number | null
          max_window_count?: number | null
          min_window_count?: number | null
          notes?: string | null
          phone_e164?: string | null
          preferred_contact_method?: string | null
          pricing_model?: string | null
          project_types?: string[]
          routing_setup_completed_at?: string | null
          schedule_notes?: string | null
          service_counties?: string[]
          service_regions?: string[]
          status?: string
          updated_at?: string
          vetted_at?: string | null
        }
        Update: {
          accepts_low_grade_leads?: boolean
          auth_user_id?: string | null
          budget_bands?: string[]
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_vetted?: boolean
          max_leads_per_week?: number | null
          max_window_count?: number | null
          min_window_count?: number | null
          notes?: string | null
          phone_e164?: string | null
          preferred_contact_method?: string | null
          pricing_model?: string | null
          project_types?: string[]
          routing_setup_completed_at?: string | null
          schedule_notes?: string | null
          service_counties?: string[]
          service_regions?: string[]
          status?: string
          updated_at?: string
          vetted_at?: string | null
        }
        Relationships: []
      }
      conversion_events: {
        Row: {
          created_at: string
          event_id: string | null
          event_name: string
          fbc: string | null
          fbp: string | null
          id: number
          lead_id: string | null
          sent_to_facebook: boolean
          user_data: Json | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_name: string
          fbc?: string | null
          fbp?: string | null
          id?: number
          lead_id?: string | null
          sent_to_facebook?: boolean
          user_data?: Json | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_name?: string
          fbc?: string | null
          fbp?: string | null
          id?: number
          lead_id?: string | null
          sent_to_facebook?: boolean
          user_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      county_benchmarks: {
        Row: {
          computed_at: string
          county_key: string
          county_label: string
          created_at: string
          id: string
          installed_price_per_opening_avg: number | null
          installed_price_per_opening_median: number | null
          installed_price_per_opening_p25: number | null
          installed_price_per_opening_p75: number | null
          project_type: string
          sample_count: number
          source_label: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          computed_at?: string
          county_key: string
          county_label: string
          created_at?: string
          id?: string
          installed_price_per_opening_avg?: number | null
          installed_price_per_opening_median?: number | null
          installed_price_per_opening_p25?: number | null
          installed_price_per_opening_p75?: number | null
          project_type?: string
          sample_count?: number
          source_label?: string | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          computed_at?: string
          county_key?: string
          county_label?: string
          created_at?: string
          id?: string
          installed_price_per_opening_avg?: number | null
          installed_price_per_opening_median?: number | null
          installed_price_per_opening_p25?: number | null
          installed_price_per_opening_p75?: number | null
          project_type?: string
          sample_count?: number
          source_label?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      diagnosis_intakes: {
        Row: {
          analysis_id: string | null
          attribution_snapshot: Json
          confidence: string | null
          counter_offer: Json
          created_at: string
          id: string
          lead_id: string
          other_text: string | null
          prescription_path: string | null
          primary_diagnosis: string
          report_grade: string
          scan_session_id: string
          secondary_clarifiers: Json
          source: string
          status: string
          top_insights_snapshot: Json
          updated_at: string
          window_intelligence: Json
        }
        Insert: {
          analysis_id?: string | null
          attribution_snapshot?: Json
          confidence?: string | null
          counter_offer?: Json
          created_at?: string
          id?: string
          lead_id: string
          other_text?: string | null
          prescription_path?: string | null
          primary_diagnosis: string
          report_grade: string
          scan_session_id: string
          secondary_clarifiers?: Json
          source?: string
          status?: string
          top_insights_snapshot?: Json
          updated_at?: string
          window_intelligence?: Json
        }
        Update: {
          analysis_id?: string | null
          attribution_snapshot?: Json
          confidence?: string | null
          counter_offer?: Json
          created_at?: string
          id?: string
          lead_id?: string
          other_text?: string | null
          prescription_path?: string | null
          primary_diagnosis?: string
          report_grade?: string
          scan_session_id?: string
          secondary_clarifiers?: Json
          source?: string
          status?: string
          top_insights_snapshot?: Json
          updated_at?: string
          window_intelligence?: Json
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_intakes_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosis_intakes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosis_intakes_scan_session_id_fkey"
            columns: ["scan_session_id"]
            isOneToOne: false
            referencedRelation: "scan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_logs: {
        Row: {
          created_at: string
          event_name: string
          flow_type: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          route: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          flow_type?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          route?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          flow_type?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          route?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          analysis_id: string | null
          created_at: string
          event_id: string | null
          event_name: string
          event_source: string | null
          id: string
          lead_id: string
          metadata: Json
          opportunity_id: string | null
          scan_session_id: string | null
          status: string | null
          voice_followup_id: string | null
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          event_id?: string | null
          event_name: string
          event_source?: string | null
          id?: string
          lead_id: string
          metadata?: Json
          opportunity_id?: string | null
          scan_session_id?: string | null
          status?: string | null
          voice_followup_id?: string | null
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          event_id?: string | null
          event_name?: string
          event_source?: string | null
          id?: string
          lead_id?: string
          metadata?: Json
          opportunity_id?: string | null
          scan_session_id?: string | null
          status?: string | null
          voice_followup_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          amber_flag_count: number
          appointment_booked_at: string | null
          audit_completed_at: string | null
          audit_started_at: string | null
          billable_intro_created_at: string | null
          billable_status: string | null
          city: string | null
          client_slug: string | null
          closed_at: string | null
          confidence_score: number | null
          contact_release_status: string | null
          contractor_id: string | null
          county: string | null
          created_at: string
          critical_flag_count: number
          deal_status: string | null
          deal_value: number | null
          diagnosis_completed_at: string | null
          diagnosis_started_at: string | null
          email: string | null
          enriched_at: string | null
          enrichment_source: string | null
          estimated_savings_high: number | null
          estimated_savings_low: number | null
          estimated_savings_midpoint: number | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          first_name: string | null
          first_page_path: string | null
          flag_count: number
          forensic_flags: string[] | null
          funnel_stage: string | null
          gbraid: string | null
          gclid: string | null
          grade: string | null
          grade_score: number | null
          has_estimate: boolean | null
          homeowner: boolean | null
          id: string
          initial_referrer: string | null
          intent: string | null
          intro_requested_at: string | null
          landing_page_url: string | null
          last_call_answered_at: string | null
          last_call_booking_intent: boolean | null
          last_call_completed_at: string | null
          last_call_duration_seconds: number | null
          last_call_failure_reason: string | null
          last_call_intent: string | null
          last_call_outcome: string | null
          last_call_queued_at: string | null
          last_call_recording_url: string | null
          last_call_status: string | null
          last_call_summary: string | null
          last_call_transcript_id: string | null
          last_name: string | null
          last_otp_sent_at: string | null
          last_otp_verified_at: string | null
          last_page_path: string | null
          latest_analysis_id: string | null
          latest_opportunity_id: string | null
          latest_scan_session_id: string | null
          lead_score: number | null
          lead_source: string | null
          lead_type: string | null
          li_fat_id: string | null
          manual_entry_data: Json | null
          manually_reviewed: boolean
          metro_area: string | null
          msclkid: string | null
          otp_failure_count: number
          otp_locked_until: string | null
          otp_state: string | null
          persona_bucket: string | null
          phone_carrier_name: string | null
          phone_e164: string | null
          phone_line_type: string | null
          phone_lookup_checked_at: string | null
          phone_lookup_valid: boolean | null
          phone_risk_tier: string | null
          phone_verification_channel: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          pricing_posture: string | null
          project_type: string | null
          property_type: string | null
          property_value_high: number | null
          property_value_low: number | null
          qualification_answers_json: Json
          qualification_status: string | null
          quote_amount: number | null
          quote_range: string | null
          reactivation_email_sent_at: string | null
          red_flag_count: number
          referring_domain: string | null
          replacement_quote_submitted_at: string | null
          report_email_sent_at: string | null
          report_email_type: string | null
          report_help_call_requested_at: string | null
          report_unlocked_at: string | null
          revenue_amount: number | null
          routed_to_contractor_at: string | null
          scan_count: number
          service_area_valid: boolean | null
          session_id: string
          snapshot_email_last_error: string | null
          snapshot_email_sent_at: string | null
          snapshot_email_status: string
          source: string | null
          state: string | null
          status: string | null
          suggested_contractor_id: string | null
          suggested_match_confidence: string | null
          suggested_match_generated_at: string | null
          timeline_bucket: string | null
          truth_gate_abandoned: boolean | null
          truth_gate_hit_at: string | null
          ttclid: string | null
          twclid: string | null
          updated_at: string
          urgency_score: number | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          voice_fallback_used: boolean
          wbraid: string | null
          window_count: number | null
          year_built: number | null
          zip: string | null
        }
        Insert: {
          amber_flag_count?: number
          appointment_booked_at?: string | null
          audit_completed_at?: string | null
          audit_started_at?: string | null
          billable_intro_created_at?: string | null
          billable_status?: string | null
          city?: string | null
          client_slug?: string | null
          closed_at?: string | null
          confidence_score?: number | null
          contact_release_status?: string | null
          contractor_id?: string | null
          county?: string | null
          created_at?: string
          critical_flag_count?: number
          deal_status?: string | null
          deal_value?: number | null
          diagnosis_completed_at?: string | null
          diagnosis_started_at?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_source?: string | null
          estimated_savings_high?: number | null
          estimated_savings_low?: number | null
          estimated_savings_midpoint?: number | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_name?: string | null
          first_page_path?: string | null
          flag_count?: number
          forensic_flags?: string[] | null
          funnel_stage?: string | null
          gbraid?: string | null
          gclid?: string | null
          grade?: string | null
          grade_score?: number | null
          has_estimate?: boolean | null
          homeowner?: boolean | null
          id?: string
          initial_referrer?: string | null
          intent?: string | null
          intro_requested_at?: string | null
          landing_page_url?: string | null
          last_call_answered_at?: string | null
          last_call_booking_intent?: boolean | null
          last_call_completed_at?: string | null
          last_call_duration_seconds?: number | null
          last_call_failure_reason?: string | null
          last_call_intent?: string | null
          last_call_outcome?: string | null
          last_call_queued_at?: string | null
          last_call_recording_url?: string | null
          last_call_status?: string | null
          last_call_summary?: string | null
          last_call_transcript_id?: string | null
          last_name?: string | null
          last_otp_sent_at?: string | null
          last_otp_verified_at?: string | null
          last_page_path?: string | null
          latest_analysis_id?: string | null
          latest_opportunity_id?: string | null
          latest_scan_session_id?: string | null
          lead_score?: number | null
          lead_source?: string | null
          lead_type?: string | null
          li_fat_id?: string | null
          manual_entry_data?: Json | null
          manually_reviewed?: boolean
          metro_area?: string | null
          msclkid?: string | null
          otp_failure_count?: number
          otp_locked_until?: string | null
          otp_state?: string | null
          persona_bucket?: string | null
          phone_carrier_name?: string | null
          phone_e164?: string | null
          phone_line_type?: string | null
          phone_lookup_checked_at?: string | null
          phone_lookup_valid?: boolean | null
          phone_risk_tier?: string | null
          phone_verification_channel?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          pricing_posture?: string | null
          project_type?: string | null
          property_type?: string | null
          property_value_high?: number | null
          property_value_low?: number | null
          qualification_answers_json?: Json
          qualification_status?: string | null
          quote_amount?: number | null
          quote_range?: string | null
          reactivation_email_sent_at?: string | null
          red_flag_count?: number
          referring_domain?: string | null
          replacement_quote_submitted_at?: string | null
          report_email_sent_at?: string | null
          report_email_type?: string | null
          report_help_call_requested_at?: string | null
          report_unlocked_at?: string | null
          revenue_amount?: number | null
          routed_to_contractor_at?: string | null
          scan_count?: number
          service_area_valid?: boolean | null
          session_id: string
          snapshot_email_last_error?: string | null
          snapshot_email_sent_at?: string | null
          snapshot_email_status?: string
          source?: string | null
          state?: string | null
          status?: string | null
          suggested_contractor_id?: string | null
          suggested_match_confidence?: string | null
          suggested_match_generated_at?: string | null
          timeline_bucket?: string | null
          truth_gate_abandoned?: boolean | null
          truth_gate_hit_at?: string | null
          ttclid?: string | null
          twclid?: string | null
          updated_at?: string
          urgency_score?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          voice_fallback_used?: boolean
          wbraid?: string | null
          window_count?: number | null
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          amber_flag_count?: number
          appointment_booked_at?: string | null
          audit_completed_at?: string | null
          audit_started_at?: string | null
          billable_intro_created_at?: string | null
          billable_status?: string | null
          city?: string | null
          client_slug?: string | null
          closed_at?: string | null
          confidence_score?: number | null
          contact_release_status?: string | null
          contractor_id?: string | null
          county?: string | null
          created_at?: string
          critical_flag_count?: number
          deal_status?: string | null
          deal_value?: number | null
          diagnosis_completed_at?: string | null
          diagnosis_started_at?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_source?: string | null
          estimated_savings_high?: number | null
          estimated_savings_low?: number | null
          estimated_savings_midpoint?: number | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_name?: string | null
          first_page_path?: string | null
          flag_count?: number
          forensic_flags?: string[] | null
          funnel_stage?: string | null
          gbraid?: string | null
          gclid?: string | null
          grade?: string | null
          grade_score?: number | null
          has_estimate?: boolean | null
          homeowner?: boolean | null
          id?: string
          initial_referrer?: string | null
          intent?: string | null
          intro_requested_at?: string | null
          landing_page_url?: string | null
          last_call_answered_at?: string | null
          last_call_booking_intent?: boolean | null
          last_call_completed_at?: string | null
          last_call_duration_seconds?: number | null
          last_call_failure_reason?: string | null
          last_call_intent?: string | null
          last_call_outcome?: string | null
          last_call_queued_at?: string | null
          last_call_recording_url?: string | null
          last_call_status?: string | null
          last_call_summary?: string | null
          last_call_transcript_id?: string | null
          last_name?: string | null
          last_otp_sent_at?: string | null
          last_otp_verified_at?: string | null
          last_page_path?: string | null
          latest_analysis_id?: string | null
          latest_opportunity_id?: string | null
          latest_scan_session_id?: string | null
          lead_score?: number | null
          lead_source?: string | null
          lead_type?: string | null
          li_fat_id?: string | null
          manual_entry_data?: Json | null
          manually_reviewed?: boolean
          metro_area?: string | null
          msclkid?: string | null
          otp_failure_count?: number
          otp_locked_until?: string | null
          otp_state?: string | null
          persona_bucket?: string | null
          phone_carrier_name?: string | null
          phone_e164?: string | null
          phone_line_type?: string | null
          phone_lookup_checked_at?: string | null
          phone_lookup_valid?: boolean | null
          phone_risk_tier?: string | null
          phone_verification_channel?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          pricing_posture?: string | null
          project_type?: string | null
          property_type?: string | null
          property_value_high?: number | null
          property_value_low?: number | null
          qualification_answers_json?: Json
          qualification_status?: string | null
          quote_amount?: number | null
          quote_range?: string | null
          reactivation_email_sent_at?: string | null
          red_flag_count?: number
          referring_domain?: string | null
          replacement_quote_submitted_at?: string | null
          report_email_sent_at?: string | null
          report_email_type?: string | null
          report_help_call_requested_at?: string | null
          report_unlocked_at?: string | null
          revenue_amount?: number | null
          routed_to_contractor_at?: string | null
          scan_count?: number
          service_area_valid?: boolean | null
          session_id?: string
          snapshot_email_last_error?: string | null
          snapshot_email_sent_at?: string | null
          snapshot_email_status?: string
          source?: string | null
          state?: string | null
          status?: string | null
          suggested_contractor_id?: string | null
          suggested_match_confidence?: string | null
          suggested_match_generated_at?: string | null
          timeline_bucket?: string | null
          truth_gate_abandoned?: boolean | null
          truth_gate_hit_at?: string | null
          ttclid?: string | null
          twclid?: string | null
          updated_at?: string
          urgency_score?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          voice_fallback_used?: boolean
          wbraid?: string | null
          window_count?: number | null
          year_built?: number | null
          zip?: string | null
        }
        Relationships: []
      }
      meta_configurations: {
        Row: {
          access_token: string | null
          client_id: string | null
          id: string
          is_default: boolean
          pixel_id: string | null
          test_event_code: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          client_id?: string | null
          id?: string
          is_default?: boolean
          pixel_id?: string | null
          test_event_code?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          client_id?: string | null
          id?: string
          is_default?: boolean
          pixel_id?: string | null
          test_event_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_configurations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_failures: {
        Row: {
          failure_count: number
          first_failure_at: string
          ip_address: string | null
          last_failure_at: string
          last_user_agent_hash: string | null
          locked_until: string | null
          phone_e164: string
          scan_session_id: string | null
          updated_at: string
        }
        Insert: {
          failure_count?: number
          first_failure_at?: string
          ip_address?: string | null
          last_failure_at?: string
          last_user_agent_hash?: string | null
          locked_until?: string | null
          phone_e164: string
          scan_session_id?: string | null
          updated_at?: string
        }
        Update: {
          failure_count?: number
          first_failure_at?: string
          ip_address?: string | null
          last_failure_at?: string
          last_user_agent_hash?: string | null
          locked_until?: string | null
          phone_e164?: string
          scan_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          lead_id: string | null
          phone_e164: string
          status: string
          updated_at: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          phone_e164: string
          status?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          phone_e164?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_verifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_analyses: {
        Row: {
          created_at: string
          dollar_delta: number | null
          flags: Json | null
          grade: string | null
          id: string
          lead_id: string | null
        }
        Insert: {
          created_at?: string
          dollar_delta?: number | null
          flags?: Json | null
          grade?: string | null
          id?: string
          lead_id?: string | null
        }
        Update: {
          created_at?: string
          dollar_delta?: number | null
          flags?: Json | null
          grade?: string | null
          id?: string
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_comparisons: {
        Row: {
          analysis_count: number
          comparison_json: Json
          created_at: string
          generated_at: string
          id: string
          lead_id: string | null
          scan_session_ids: string[]
        }
        Insert: {
          analysis_count?: number
          comparison_json: Json
          created_at?: string
          generated_at?: string
          id?: string
          lead_id?: string | null
          scan_session_ids: string[]
        }
        Update: {
          analysis_count?: number
          comparison_json?: Json
          created_at?: string
          generated_at?: string
          id?: string
          lead_id?: string | null
          scan_session_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "quote_comparisons_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_files: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          status: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          status?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          status?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_sessions: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          quote_file_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          quote_file_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          quote_file_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_sessions_quote_file_id_fkey"
            columns: ["quote_file_id"]
            isOneToOne: true
            referencedRelation: "quote_files"
            referencedColumns: ["id"]
          },
        ]
      }
      service_tickets: {
        Row: {
          created_at: string
          customer_issue: string
          id: number
          technician_notes: string
        }
        Insert: {
          created_at?: string
          customer_issue: string
          id?: number
          technician_notes: string
        }
        Update: {
          created_at?: string
          customer_issue?: string
          id?: number
          technician_notes?: string
        }
        Relationships: []
      }
      user_role_audit_log: {
        Row: {
          action: string
          changed_by_user_id: string | null
          created_at: string
          id: string
          new_role: string
          old_role: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_role: string
          old_role?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_role?: string
          old_role?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          id: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      voice_followups: {
        Row: {
          answered_at: string | null
          appointment_booked: boolean
          appointment_time_requested: string | null
          booking_intent_detected: boolean
          call_intent: string
          call_outcome: string | null
          completed_at: string | null
          created_at: string
          cta_source: string | null
          duration_seconds: number | null
          failure_reason: string | null
          id: string
          lead_id: string
          opportunity_id: string | null
          payload_json: Json
          phone_e164: string
          provider: string
          provider_call_id: string | null
          queued_at: string
          recording_url: string | null
          result_json: Json
          scan_session_id: string | null
          started_at: string | null
          status: string
          summary: string | null
          transcript_text: string | null
          transcript_url: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          appointment_booked?: boolean
          appointment_time_requested?: string | null
          booking_intent_detected?: boolean
          call_intent: string
          call_outcome?: string | null
          completed_at?: string | null
          created_at?: string
          cta_source?: string | null
          duration_seconds?: number | null
          failure_reason?: string | null
          id?: string
          lead_id: string
          opportunity_id?: string | null
          payload_json?: Json
          phone_e164: string
          provider?: string
          provider_call_id?: string | null
          queued_at?: string
          recording_url?: string | null
          result_json?: Json
          scan_session_id?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          transcript_text?: string | null
          transcript_url?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          appointment_booked?: boolean
          appointment_time_requested?: string | null
          booking_intent_detected?: boolean
          call_intent?: string
          call_outcome?: string | null
          completed_at?: string | null
          created_at?: string
          cta_source?: string | null
          duration_seconds?: number | null
          failure_reason?: string | null
          id?: string
          lead_id?: string
          opportunity_id?: string | null
          payload_json?: Json
          phone_e164?: string
          provider?: string
          provider_call_id?: string | null
          queued_at?: string
          recording_url?: string | null
          result_json?: Json
          scan_session_id?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          transcript_text?: string | null
          transcript_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_http_status: number | null
          lead_id: string
          max_attempts: number
          next_retry_at: string | null
          payload_json: Json | null
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_type: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_http_status?: number | null
          lead_id: string
          max_attempts?: number
          next_retry_at?: string | null
          payload_json?: Json | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_http_status?: number | null
          lead_id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload_json?: Json | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_contractor_credits: {
        Args: {
          p_admin_user_id?: string
          p_contractor_id: string
          p_delta: number
          p_entry_type: string
          p_notes?: string
        }
        Returns: Json
      }
      fulfill_contractor_credit_purchase: {
        Args: { p_payment_intent_id?: string; p_session_id: string }
        Returns: Json
      }
      get_analysis_full: {
        Args: { p_phone_e164: string; p_scan_session_id: string }
        Returns: {
          confidence_score: number
          document_type: string
          flags: Json
          full_json: Json
          grade: string
          preview_json: Json
          proof_of_read: Json
          rubric_version: string
        }[]
      }
      get_analysis_preview: {
        Args: { p_scan_session_id: string }
        Returns: {
          confidence_score: number
          document_type: string
          flag_amber_count: number
          flag_count: number
          flag_red_count: number
          grade: string
          preview_json: Json
          proof_of_read: Json
          rubric_version: string
        }[]
      }
      get_county_by_scan_session: {
        Args: { p_scan_session_id: string }
        Returns: {
          county: string
        }[]
      }
      get_lead_by_email: {
        Args: { p_email: string }
        Returns: {
          county: string
          created_at: string
          email: string
          first_name: string
          id: string
          lead_score: number
          phone_e164: string
          quote_amount: number
          session_id: string
          status: string
          window_count: number
        }[]
      }
      get_lead_by_session: {
        Args: { p_session_id: string }
        Returns: {
          id: string
        }[]
      }
      get_lead_phone_by_scan_session: {
        Args: { p_scan_session_id: string }
        Returns: {
          phone_e164: string
        }[]
      }
      get_rubric_stats: {
        Args: { p_days?: number }
        Returns: {
          avg_confidence: number
          avg_fine_print: number
          avg_grade_score: number
          avg_install: number
          avg_price: number
          avg_safety: number
          avg_warranty: number
          grade_a: number
          grade_b: number
          grade_c: number
          grade_d: number
          grade_f: number
          hard_cap_critical_safety: number
          hard_cap_no_impact: number
          hard_cap_no_warranty: number
          hard_cap_zero_items: number
          invalid_count: number
          max_confidence: number
          min_confidence: number
          rubric_version: string
          total_count: number
        }[]
      }
      get_scan_status: {
        Args: { p_scan_session_id: string }
        Returns: {
          id: string
          status: string
        }[]
      }
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_internal_operator: { Args: never; Returns: boolean }
      unlock_contractor_lead: {
        Args: { p_contractor_id: string; p_lead_id: string }
        Returns: Json
      }
    }
    Enums: {
      contractor_activity_type:
        | "qualification_completed"
        | "calendly_opened"
        | "booking_created"
        | "booking_completed"
        | "no_show"
        | "reminder_sent"
        | "followup_sent"
        | "stage_changed"
        | "note_added"
      contractor_booking_status:
        | "not_started"
        | "calendly_started"
        | "booked"
        | "completed"
        | "no_show"
        | "canceled"
      contractor_followup_status: "pending" | "sent" | "failed" | "canceled"
      contractor_followup_type:
        | "confirmation_email"
        | "reminder_24h"
        | "reminder_1h"
        | "no_show_followup"
        | "post_call_followup"
      contractor_pipeline_stage:
        | "new"
        | "booked"
        | "showed"
        | "qualified_call"
        | "proposal_sent"
        | "won"
        | "lost"
      contractor_qualification_status:
        | "new"
        | "qualified"
        | "soft_reject"
        | "hard_reject"
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
  public: {
    Enums: {
      contractor_activity_type: [
        "qualification_completed",
        "calendly_opened",
        "booking_created",
        "booking_completed",
        "no_show",
        "reminder_sent",
        "followup_sent",
        "stage_changed",
        "note_added",
      ],
      contractor_booking_status: [
        "not_started",
        "calendly_started",
        "booked",
        "completed",
        "no_show",
        "canceled",
      ],
      contractor_followup_status: ["pending", "sent", "failed", "canceled"],
      contractor_followup_type: [
        "confirmation_email",
        "reminder_24h",
        "reminder_1h",
        "no_show_followup",
        "post_call_followup",
      ],
      contractor_pipeline_stage: [
        "new",
        "booked",
        "showed",
        "qualified_call",
        "proposal_sent",
        "won",
        "lost",
      ],
      contractor_qualification_status: [
        "new",
        "qualified",
        "soft_reject",
        "hard_reject",
      ],
    },
  },
} as const
