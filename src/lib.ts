import { createClient } from '@supabase/supabase-js';

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
function safeKey(key: string) {
  if (key.startsWith('sb_publishable_') && !key.includes('REPLACE')) return true;
  try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { return false; }
}
export const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl) && safeKey(publicKey);
export const supabase = configured ? createClient(projectUrl, publicKey, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.sessionStorage },
}) : null;

export async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('The school portal has not been connected to its database.');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(error.message);
  return data as T;
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
export function displayDate(value?: string | null, time = false) {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(value + 'T12:00:00+08:00') : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } as const : {}) }).format(date);
}
export function manilaInput(value = new Date().toISOString()) {
  const date = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}
export function fromManilaInput(value: string) { return new Date(value + ':00+08:00').toISOString(); }
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
