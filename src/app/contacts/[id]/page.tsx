"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useCrm,
  useTeamMembers,
  useContactNotes,
  useContactTasks,
  addNote,
  deleteNote,
  addTask,
  setTaskStatus,
  deleteTask,
  linkProject,
  unlinkProject,
  deleteContact,
  updateContact,
} from "@/hooks/use-contacts";
import { useProjects, saveProjectInfo, createFinancials } from "@/hooks/use-projects";
import { useProfile } from "@/hooks/use-profile";
import { useToast } from "@/components/layout/toast-provider";
import { BUSINESS_UNITS, PROJECT_STATUSES } from "@/lib/constants";
import { generateId } from "@/lib/calculations";
import type { ContactStatus } from "@/lib/types";

type Tab = "projects" | "notes" | "tasks";

export default function ContactDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const router = useRouter();
  const { toast } = useToast();

  const { contacts, brokerages, links, mutate } = useCrm();
  const { team } = useTeamMembers();
  const { projects, mutate: mutateProjects } = useProjects();
  const { isSuperAdmin, profile } = useProfile();
  const { notes, mutate: mutateNotes } = useContactNotes(id);
  const { tasks, mutate: mutateTasks } = useContactTasks(id);

  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);

  // New-project form
  const [projOpen, setProjOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pAddr, setPAddr] = useState("");
  const [pBU, setPBU] = useState<string>(BUSINESS_UNITS[0]);
  const [pStatus, setPStatus] = useState<string>("Scheduled");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [savingProj, setSavingProj] = useState(false);

  const contact = contacts.find((c) => c.id === id);
  const brokerage = brokerages.find((b) => b.id === contact?.brokerage_id);
  const teamName = (uid: string | null) =>
    uid ? team.find((t) => t.id === uid)?.full_name || "—" : "—";

  const linkedIds = useMemo(
    () => new Set(links.filter((l) => l.contact_id === id).map((l) => l.project_id)),
    [links, id]
  );
  const linkedProjects = projects.filter((p) => linkedIds.has(p.id));

  // Only sum what this user is allowed to see.
  const visibleRevenue = linkedProjects
    .filter((p) => p.canSeeFinancials)
    .reduce((s, p) => s + (p.contract_value || 0), 0);
  const canSeeAnyMoney = linkedProjects.some((p) => p.canSeeFinancials);

  if (!contact) {
    return (
      <div className="p-6 text-sm text-muted">
        Contact not found.{" "}
        <button onClick={() => router.push("/contacts")} className="text-accent underline bg-transparent border-none cursor-pointer">
          Back to contacts
        </button>
      </div>
    );
  }

  const fullName = `${contact.first_name} ${contact.last_name || ""}`.trim();

  /** Mirrors the Projects page: install date drives a 90-day end date. */
  function handleStartChange(val: string) {
    setPStart(val);
    if (val) {
      const d = new Date(val + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 90);
      setPEnd(d.toISOString().slice(0, 10));
    }
  }

  async function handleAddNote() {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      await addNote(id, noteBody.trim());
      setNoteBody("");
      await mutateNotes();
      toast("Note added");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add note", "error");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleAddTask() {
    if (!taskTitle.trim()) { toast("Task needs a title", "error"); return; }
    try {
      await addTask({
        contact_id: id,
        title: taskTitle.trim(),
        due_date: taskDue || null,
        assigned_to: taskAssignee || null,
      });
      setTaskTitle(""); setTaskDue(""); setTaskAssignee("");
      await mutateTasks();
      toast("Task added");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add task", "error");
    }
  }

  async function handleCreateProject() {
    if (!pName.trim()) { toast("Project name is required", "error"); return; }
    setSavingProj(true);
    try {
      const newId = generateId();
      await saveProjectInfo({
        id: newId,
        name: pName.trim(),
        address: pAddr.trim() || null,
        bu: pBU,
        // Record the agent's name on the project for continuity with older
        // projects; the authoritative link is the contact_projects row below.
        agent: fullName || null,
        start_date: pStart || null,
        end_date: pEnd || null,
        notes: null,
        status: pStatus,
        rooms: {},
        canSeeFinancials: false,
        invoice: 0,
        deposit: 0,
        contract_value: 0,
        contract_owner_id: null,
        labor: [],
        misc_lines: [],
      });
      if (isSuperAdmin) {
        await createFinancials({
          project_id: newId,
          invoice: 0,
          deposit: 0,
          contract_value: 0,
          contract_owner_id: contact!.owner_id || profile?.id || null,
          labor: [],
          misc_lines: [],
        });
      }
      await linkProject(id, newId);
      await Promise.all([mutateProjects(), mutate()]);
      setProjOpen(false);
      setPName(""); setPAddr(""); setPStart(""); setPEnd("");
      toast("Project created and linked");
      router.push(`/projects/${newId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create project", "error");
    } finally {
      setSavingProj(false);
    }
  }

  async function handleLink(projectId: string) {
    try {
      await linkProject(id, projectId);
      await mutate();
      toast("Project linked");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not link", "error");
    }
  }

  async function handleUnlink(projectId: string) {
    try {
      await unlinkProject(id, projectId);
      await mutate();
      toast("Project unlinked (the project itself is unchanged)");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not unlink", "error");
    }
  }

  async function handleDeleteContact() {
    if (!confirm(`Delete ${fullName}? Their notes and tasks go too. Projects are not affected.`)) return;
    try {
      await deleteContact(id);
      await mutate();
      toast("Contact deleted");
      router.push("/contacts");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete", "error");
    }
  }

  const unlinkedProjects = projects
    .filter((p) => !linkedIds.has(p.id))
    .filter((p) =>
      linkSearch
        ? `${p.name} ${p.address || ""}`.toLowerCase().includes(linkSearch.toLowerCase())
        : true
    );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "projects", label: "Projects", count: linkedProjects.length },
    { key: "notes", label: "Notes", count: notes.length },
    { key: "tasks", label: "Tasks", count: tasks.filter((t) => t.status === "Open").length },
  ];

  return (
    <div>
      <button
        onClick={() => router.push("/contacts")}
        className="text-xs text-muted mb-2 bg-transparent border-none cursor-pointer p-0"
      >
        ← Contacts
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h2 className="text-xl font-bold">{fullName}</h2>
            <p className="text-sm text-muted mt-0.5">
              {contact.title || "Agent"}
              {brokerage ? ` · ${brokerage.name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Status is changed right here — the most common edit by far. */}
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Status
              <select
                value={contact.status}
                disabled={savingStatus}
                onChange={async (e) => {
                  setSavingStatus(true);
                  try {
                    await updateContact({ ...contact!, status: e.target.value as ContactStatus });
                    await mutate();
                    toast(`Status set to ${e.target.value}`);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Could not update status", "error");
                  } finally {
                    setSavingStatus(false);
                  }
                }}
                className="py-1.5 px-2 border border-border rounded-lg text-sm font-semibold bg-card cursor-pointer disabled:opacity-60"
              >
                {(["Active", "Prospect", "Inactive"] as ContactStatus[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            {isSuperAdmin && (
              <button onClick={handleDeleteContact} className="py-2 px-3 text-sm font-semibold rounded-lg bg-red text-white border-none cursor-pointer">
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Stat label="Email" value={contact.email || "—"} href={contact.email ? `mailto:${contact.email}` : undefined} />
          <Stat label="Phone" value={contact.phone || "—"} href={contact.phone ? `tel:${contact.phone}` : undefined} />
          <div>
            <div className="text-[.68rem] text-muted uppercase tracking-wider">Owner</div>
            <select
              value={contact.owner_id || ""}
              disabled={savingOwner}
              onChange={async (e) => {
                setSavingOwner(true);
                try {
                  await updateContact({ ...contact!, owner_id: e.target.value || null });
                  await mutate();
                  toast("Owner updated");
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Could not update owner", "error");
                } finally {
                  setSavingOwner(false);
                }
              }}
              className="w-full mt-0.5 py-1 px-1.5 border border-border rounded-lg text-sm font-semibold bg-card cursor-pointer disabled:opacity-60"
            >
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || "(no name)"}</option>
              ))}
            </select>
          </div>
          <Stat label="Projects" value={String(linkedProjects.length)} />
        </div>

        {canSeeAnyMoney && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[.68rem] text-muted uppercase tracking-wider">Contract value (projects you can see)</div>
            <div className="text-lg font-bold mt-0.5">
              ${visibleRevenue.toLocaleString()}
            </div>
          </div>
        )}

        {contact.notes && (
          <div className="mt-3 pt-3 border-t border-border text-sm">
            <div className="text-[.68rem] text-muted uppercase tracking-wider mb-1">About</div>
            {contact.notes}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`py-2 px-4 text-sm font-semibold cursor-pointer -mb-[2px] transition-colors bg-transparent border-none whitespace-nowrap ${
              activeTab === t.key
                ? "text-accent border-b-2 border-b-accent"
                : "text-muted hover:text-foreground border-b-2 border-b-transparent"
            }`}
          >
            {t.label}{typeof t.count === "number" ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* Projects */}
      {activeTab === "projects" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setProjOpen(true)} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer">
              + New Project
            </button>
            <button onClick={() => setLinkOpen(true)} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-card border border-border cursor-pointer">
              Link Existing Project
            </button>
          </div>

          {linkedProjects.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted">
              No projects linked to {contact.first_name} yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {linkedProjects.map((p) => (
                <div key={p.id} className="p-3.5 flex flex-wrap justify-between items-center gap-2">
                  <div
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="cursor-pointer flex-1 min-w-[180px]"
                  >
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {p.address || "No address"} · {p.bu}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {p.start_date || "—"} → {p.end_date || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[.68rem] font-semibold py-0.5 px-2 rounded-full bg-background">
                      {p.status}
                    </span>
                    {p.canSeeFinancials && (
                      <span className="text-sm font-semibold">
                        ${(p.contract_value || 0).toLocaleString()}
                      </span>
                    )}
                    <button
                      onClick={() => handleUnlink(p.id)}
                      title="Unlink from this contact"
                      className="py-1 px-2 text-xs font-semibold rounded bg-background border border-border cursor-pointer"
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {activeTab === "notes" && (
        <div>
          <div className="bg-card border border-border rounded-xl p-3.5 mb-3">
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              placeholder={`Log a call, email or meeting with ${contact.first_name}…`}
              className="w-full py-2 px-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent"
            />
            <div className="flex justify-end mt-2">
              <button onClick={handleAddNote} disabled={savingNote || !noteBody.trim()} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer disabled:opacity-50">
                {savingNote ? "Saving…" : "Add Note"}
              </button>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted">
              No notes yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {notes.map((n) => (
                <div key={n.id} className="p-3.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-xs text-muted">
                      {teamName(n.author_id)} ·{" "}
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                    </div>
                    {(n.author_id === profile?.id || isSuperAdmin) && (
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this note?")) return;
                          await deleteNote(n.id);
                          await mutateNotes();
                        }}
                        className="text-xs text-muted bg-transparent border-none cursor-pointer p-0"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap">{n.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {activeTab === "tasks" && (
        <div>
          <div className="bg-card border border-border rounded-xl p-3.5 mb-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Follow up about…"
                className="flex-1 py-2 px-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="py-2 px-2.5 border border-border rounded-lg text-sm bg-card"
              />
              <select
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                className="py-2 px-2.5 border border-border rounded-lg text-sm bg-card"
              >
                <option value="">Anyone</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name || "(no name)"}</option>
                ))}
              </select>
              <button onClick={handleAddTask} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer">
                Add
              </button>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted">
              No tasks for {contact.first_name}.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {tasks.map((t) => {
                const overdue =
                  t.status === "Open" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <div key={t.id} className="p-3.5 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={t.status === "Done"}
                      onChange={async () => {
                        await setTaskStatus(t.id, t.status === "Done" ? "Open" : "Done");
                        await mutateTasks();
                      }}
                      className="mt-0.5 w-5 h-5 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${t.status === "Done" ? "line-through text-muted" : "font-semibold"}`}>
                        {t.title}
                      </div>
                      <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-x-3">
                        {t.due_date && (
                          <span className={overdue ? "text-red font-semibold" : ""}>
                            Due {t.due_date}{overdue ? " · overdue" : ""}
                          </span>
                        )}
                        <span>{t.assigned_to ? teamName(t.assigned_to) : "Anyone"}</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this task?")) return;
                        await deleteTask(t.id);
                        await mutateTasks();
                      }}
                      className="text-xs text-muted bg-transparent border-none cursor-pointer p-0 shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Link existing project modal */}
      {linkOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col p-5">
            <h3 className="text-lg font-bold mb-1">Link an Existing Project</h3>
            <p className="text-xs text-muted mb-3">
              This only records that the project belongs to {contact.first_name}. The project itself is not changed.
            </p>
            <input
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full py-2 px-2.5 border border-border rounded-lg text-sm mb-3 bg-card focus:outline-none focus:border-accent"
            />
            <div className="flex-1 overflow-y-auto divide-y divide-border border border-border rounded-lg">
              {unlinkedProjects.length === 0 ? (
                <div className="p-4 text-sm text-muted">No matching projects.</div>
              ) : (
                unlinkedProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={async () => { await handleLink(p.id); setLinkOpen(false); }}
                    className="w-full text-left p-3 bg-transparent border-none cursor-pointer hover:bg-background"
                  >
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted">
                      {p.address || "No address"} · {p.start_date || "—"} · {p.status}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => setLinkOpen(false)} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-background border border-border cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New project modal */}
      {projOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
            <h3 className="text-lg font-bold mb-1">New Project</h3>
            <p className="text-xs text-muted mb-3">Will be linked to {fullName}.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted">Project Name *</label>
                <input value={pName} onChange={(e) => setPName(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted">Address</label>
                <input value={pAddr} onChange={(e) => setPAddr(e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted">Business Unit</label>
                <select value={pBU} onChange={(e) => setPBU(e.target.value)} className={inputCls}>
                  {BUSINESS_UNITS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted">Status</label>
                <select value={pStatus} onChange={(e) => setPStatus(e.target.value)} className={inputCls}>
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted">Install Date</label>
                <input type="date" value={pStart} onChange={(e) => handleStartChange(e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted">End Date</label>
                <input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} className={inputCls} />
                <span className="text-[.65rem] text-muted">Auto-set to 90 days after install</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setProjOpen(false)} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-background border border-border cursor-pointer">
                Cancel
              </button>
              <button onClick={handleCreateProject} disabled={savingProj} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer disabled:opacity-60">
                {savingProj ? "Creating…" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full py-2 px-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent";

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <div className="text-[.68rem] text-muted uppercase tracking-wider">{label}</div>
      {href ? (
        <a href={href} className="text-sm font-semibold mt-0.5 block text-accent truncate">
          {value}
        </a>
      ) : (
        <div className="text-sm font-semibold mt-0.5 truncate">{value}</div>
      )}
    </div>
  );
}
