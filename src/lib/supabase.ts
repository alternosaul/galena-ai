import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Cliente de Supabase para el navegador (publishable key: respeta RLS).
 * Las variables VITE_SUPABASE_* se inyectan al compilar; la secret key nunca llega aquí.
 */

const REMEMBER_KEY = "galena.remember-session";

/** Guarda la sesión en localStorage ("mantener sesión") o solo en sessionStorage. */
const sessionStorageAdapter = {
  getItem(key: string) {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    const keep = localStorage.getItem(REMEMBER_KEY) !== "0";
    (keep ? localStorage : sessionStorage).setItem(key, value);
    (keep ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export function setRememberSession(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    // almacenamiento no disponible
  }
}

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (typeof window === "undefined") {
    throw new Error("getSupabase() solo se usa en el navegador");
  }
  if (!client) {
    const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
    if (!url || !key) {
      throw new Error("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY");
    }
    client = createClient<Database>(url, key, {
      auth: { storage: sessionStorageAdapter, persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/** Header Authorization con el token de la sesión actual (para /api/public/*). */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
