export type Role = 'principal' | 'jhs_prefect' | 'shs_prefect' | 'jhs_coordinator' | 'shs_coordinator' | 'developer';
export const ROLE_NAMES: Record<Role, string> = {
  principal: 'School Principal', jhs_prefect: 'JHS Prefect of Discipline',
  shs_prefect: 'SHS Prefect of Discipline', jhs_coordinator: 'JHS Coordinator',
  shs_coordinator: 'SHS Coordinator', developer: 'System Developer',
};
export const STATUS_NAMES: Record<string, string> = {
  draft: 'Draft', reported: 'Reported', under_review: 'Under review', monitoring: 'Monitoring',
  resolved: 'Resolved', closed: 'Closed', reopened: 'Reopened',
};
export const FINDING_NAMES: Record<string, string> = { pending: 'Pending review', substantiated: 'Substantiated', not_substantiated: 'Not substantiated' };
export interface Member { user_id: string; email: string; full_name: string; role: Role; active: boolean }
export interface SchoolYear { id: string; label: string; starts_on: string; ends_on: string; active: boolean }
export interface Behavior { id: string; name: string; policy_reference: string; active: boolean }
export interface Student { id: string; school_id: string; full_name: string; case_count?: number }
export interface Participant {
  id?: string; student_id?: string; school_id: string; full_name: string; role: 'respondent' | 'affected' | 'witness';
  age: number; grade: number; section: string; strand: string; statement: string;
  statement_status: 'recorded' | 'not_yet_taken' | 'not_applicable' | 'declined'; statement_at: string | null;
  finding?: string; finding_reason?: string; prior_confirmed?: number;
}
export interface CaseSummary {
  id: string; case_no: string; school_year_id: string; year_label: string; behavior_id: string;
  behavior_name: string; happened_at: string; location: string; summary: string; status: string;
  created_at: string; created_by: string; version: number; participant_names: string;
}
export interface CaseEvent { id: string; kind: string; title: string; body: string; happened_at: string; attendees: string; follow_up_on: string | null; created_at: string; author: string }
export interface Action { id: string; participant_id: string; student_name: string; kind: string; description: string; status: string; starts_on: string | null; ends_on: string | null; approved_at: string | null; approved_by_name: string | null; completion_note: string | null; version: number }
export interface CaseDetail extends CaseSummary { participants: Participant[]; events: CaseEvent[]; actions: Action[]; created_by_name: string; updated_at: string }
export interface Bootstrap { member: Member; years: SchoolYear[]; behaviors: Behavior[]; counts: { total: number; open: number; active_actions: number; students: number }; followups: { case_id: string; case_no: string; title: string; follow_up_on: string }[] }
export interface AuditRow { id: number; actor_name: string; action: string; entity_id: string | null; details: Record<string, unknown>; occurred_at: string }
export const canRecord = (role: Role) => role !== 'developer';
export const canReview = (role: Role) => ['principal', 'jhs_prefect', 'shs_prefect'].includes(role);
export const canAdmin = (role: Role) => ['principal', 'developer'].includes(role);
