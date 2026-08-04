"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type {
  Brokerage,
  Contact,
  ContactNote,
  ContactTask,
  TeamMember,
} from "@/lib/types";

/** Contacts + brokerages + the contact→project links, fetched together.
 *  RLS restricts all of this to super admins, managers and designers. */
async function fetchCrm(): Promise<{
  contacts: Contact[];
  brokerages: Brokerage[];
  links: { contact_id: string; project_id: string }[];
}> {
  const supabase = createClient();

  const [contactsRes, brokeragesRes, linksRes] = await Promise.all([
    supabase.from("contacts").select("*").order("first_name"),
    supabase.from("brokerages").select("*").order("name"),
    supabase.from("contact_projects").select("contact_id,project_id"),
  ]);

  if (contactsRes.error) throw contactsRes.error;
  if (brokeragesRes.error) throw brokeragesRes.error;
  if (linksRes.error) throw linksRes.error;

  return {
    contacts: (contactsRes.data || []) as Contact[],
    brokerages: (brokeragesRes.data || []) as Brokerage[],
    links: (linksRes.data || []) as { contact_id: string; project_id: string }[],
  };
}

export function useCrm() {
  const { data, error, isLoading, mutate } = useSWR("crm", fetchCrm);
  return {
    contacts: data?.contacts || [],
    brokerages: data?.brokerages || [],
    links: data?.links || [],
    error,
    isLoading,
    mutate,
  };
}

/** Teammates for the owner / assignee pickers. Comes from a SECURITY DEFINER
 *  function so designers can read names without seeing anyone's email. */
export function useTeamMembers() {
  const { data, error, isLoading } = useSWR("crm-team", async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("crm_team_members");
    if (error) throw error;
    return (data || []) as TeamMember[];
  });
  return { team: data || [], error, isLoading };
}

// --- Contacts --------------------------------------------------------------

/** Fields a user can edit. created_by is deliberately not among them. */
function contactFields(c: Contact) {
  return {
    first_name: c.first_name,
    last_name: c.last_name || null,
    email: c.email || null,
    phone: c.phone || null,
    title: c.title || null,
    brokerage_id: c.brokerage_id || null,
    owner_id: c.owner_id || null,
    status: c.status,
    notes: c.notes || null,
  };
}

/** New contact. Stamped as created by the signed-in user, which is what the
 *  insert policy requires and what scopes a designer's visibility. */
export async function createContact(c: Contact) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("contacts").insert({
    id: c.id,
    ...contactFields(c),
    created_by: auth.user?.id,
  });
  if (error) throw error;
}

/** Edit an existing contact. created_by is never rewritten — otherwise an
 *  admin editing a designer's contact would take it away from them. */
export async function updateContact(c: Contact) {
  const supabase = createClient();
  const { error } = await supabase
    .from("contacts")
    .update(contactFields(c))
    .eq("id", c.id);
  if (error) throw error;
}

export async function deleteContact(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

// --- Brokerages ------------------------------------------------------------

export async function saveBrokerage(b: Brokerage) {
  const supabase = createClient();
  const { error } = await supabase.from("brokerages").upsert({
    id: b.id,
    name: b.name,
    address: b.address || null,
    phone: b.phone || null,
    website: b.website || null,
    notes: b.notes || null,
  });
  if (error) throw error;
}

export async function deleteBrokerage(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("brokerages").delete().eq("id", id);
  if (error) throw error;
}

// --- Contact ↔ project links ----------------------------------------------
// These only ever write to contact_projects. The projects table is never
// modified by the CRM.

export async function linkProject(contactId: string, projectId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("contact_projects")
    .upsert({ contact_id: contactId, project_id: projectId });
  if (error) throw error;
}

export async function unlinkProject(contactId: string, projectId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("contact_projects")
    .delete()
    .eq("contact_id", contactId)
    .eq("project_id", projectId);
  if (error) throw error;
}

// --- Notes -----------------------------------------------------------------

export function useContactNotes(contactId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    contactId ? ["contact-notes", contactId] : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ContactNote[];
    }
  );
  return { notes: data || [], error, isLoading, mutate };
}

export async function addNote(contactId: string, body: string) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("contact_notes").insert({
    contact_id: contactId,
    // RLS requires this to be the signed-in user.
    author_id: auth.user?.id,
    body,
  });
  if (error) throw error;
}

export async function deleteNote(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("contact_notes").delete().eq("id", id);
  if (error) throw error;
}

// --- Tasks -----------------------------------------------------------------

export function useContactTasks(contactId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    contactId ? ["contact-tasks", contactId] : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contact_tasks")
        .select("*")
        .eq("contact_id", contactId!)
        .order("status")
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data || []) as ContactTask[];
    }
  );
  return { tasks: data || [], error, isLoading, mutate };
}

/** Every open task across all contacts — powers the "My follow-ups" view. */
export function useAllOpenTasks() {
  const { data, error, isLoading, mutate } = useSWR("crm-open-tasks", async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contact_tasks")
      .select("*")
      .eq("status", "Open")
      .order("due_date", { nullsFirst: false });
    if (error) throw error;
    return (data || []) as ContactTask[];
  });
  return { tasks: data || [], error, isLoading, mutate };
}

export async function addTask(t: {
  contact_id: string;
  title: string;
  due_date: string | null;
  assigned_to: string | null;
}) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("contact_tasks").insert({
    contact_id: t.contact_id,
    title: t.title,
    due_date: t.due_date || null,
    assigned_to: t.assigned_to || null,
    created_by: auth.user?.id,
  });
  if (error) throw error;
}

export async function setTaskStatus(id: string, status: "Open" | "Done") {
  const supabase = createClient();
  const { error } = await supabase
    .from("contact_tasks")
    .update({
      status,
      completed_at: status === "Done" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("contact_tasks").delete().eq("id", id);
  if (error) throw error;
}
