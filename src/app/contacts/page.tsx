"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCrm,
  useTeamMembers,
  useAllOpenTasks,
  createContact,
  updateContact,
  setTaskStatus,
} from "@/hooks/use-contacts";
import { useToast } from "@/components/layout/toast-provider";
import { generateId, formatDate } from "@/lib/calculations";
import type { Contact, ContactTask, TeamMember } from "@/lib/types";

export default function ContactsPage() {
  const { contacts, links, mutate, isLoading } = useCrm();
  const { team } = useTeamMembers();
  const { tasks: openTasks, mutate: mutateTasks } = useAllOpenTasks();
  const { toast } = useToast();
  const router = useRouter();

  const [view, setView] = useState<"contacts" | "tasks">("contacts");
  const [search, setSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState("");

  // Contact modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [fFirst, setFFirst] = useState("");
  const [fLast, setFLast] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fNotes, setFNotes] = useState("");

  const ownerName = useMemo(() => {
    const m = new Map(team.map((t) => [t.id, t.full_name || "—"]));
    return (id: string | null) => (id ? m.get(id) || "—" : "—");
  }, [team]);

  // How many projects we have done for each contact.
  const projectCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.contact_id, (m.get(l.contact_id) || 0) + 1);
    return m;
  }, [links]);

  const filtered = contacts.filter((c) => {
    if (filterOwner) {
      if (filterOwner === "__unassigned") {
        if (c.owner_id) return false;
      } else if (c.owner_id !== filterOwner) return false;
    }
    if (search) {
      const hay = `${c.first_name} ${c.last_name || ""} ${c.email || ""} ${
        c.phone || ""
      }`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  function openModal(c?: Contact) {
    if (c) {
      setEditing(c);
      setFFirst(c.first_name);
      setFLast(c.last_name || "");
      setFEmail(c.email || "");
      setFPhone(c.phone || "");
      setFOwner(c.owner_id || "");
      setFNotes(c.notes || "");
    } else {
      setEditing(null);
      setFFirst(""); setFLast(""); setFEmail(""); setFPhone("");
      setFOwner(""); setFNotes("");
    }
    setModalOpen(true);
  }

  async function handleSave() {
    if (!fFirst.trim()) { toast("First name is required", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        id: editing?.id || generateId(),
        first_name: fFirst.trim(),
        last_name: fLast.trim() || null,
        email: fEmail.trim() || null,
        phone: fPhone.trim() || null,
        owner_id: fOwner || null,
        notes: fNotes.trim() || null,
      };
      if (editing) await updateContact(payload);
      else await createContact(payload);
      await mutate();
      setModalOpen(false);
      toast(editing ? "Contact updated" : "Contact added");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save contact", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold">Contacts</h2>
          <p className="text-xs text-muted mt-0.5">{contacts.length} total</p>
        </div>
        <button
          onClick={() => openModal()}
          className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer"
        >
          + Contact
        </button>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        {([
          { key: "contacts" as const, label: `Contacts (${contacts.length})` },
          { key: "tasks" as const, label: `Tasks Due (${openTasks.length})` },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`py-2 px-4 text-sm font-semibold cursor-pointer -mb-[2px] bg-transparent border-none whitespace-nowrap ${
              view === t.key
                ? "text-accent border-b-2 border-b-accent"
                : "text-muted hover:text-foreground border-b-2 border-b-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "contacts" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone…"
              className="flex-1 min-w-[200px] py-2 px-3 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent"
            />
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="py-2 px-3 border border-border rounded-lg text-sm bg-card"
            >
              <option value="">All owners</option>
              <option value="__unassigned">Unassigned</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || "(no name)"}</option>
              ))}
            </select>
          </div>

          {/* Contact list */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-6 text-sm text-muted">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-muted">
                {contacts.length === 0
                  ? "No contacts yet. Add your first agent to get started."
                  : "No contacts match that search."}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <table className="w-full border-collapse text-sm hidden md:table">
                  <thead>
                    <tr className="text-left text-muted text-xs uppercase tracking-wider">
                      <th className="py-2.5 px-3 border-b border-border">Name</th>
                      <th className="py-2.5 px-3 border-b border-border">Email</th>
                      <th className="py-2.5 px-3 border-b border-border">Phone</th>
                      <th className="py-2.5 px-3 border-b border-border">Owner</th>
                      <th className="py-2.5 px-3 border-b border-border">Projects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/contacts/${c.id}`)}
                        className="cursor-pointer hover:bg-background"
                      >
                        <td className="py-2.5 px-3 border-b border-border font-semibold">
                          {c.first_name} {c.last_name || ""}
                        </td>
                        <td className="py-2.5 px-3 border-b border-border">{c.email || "—"}</td>
                        <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{c.phone || "—"}</td>
                        <td className="py-2.5 px-3 border-b border-border">{ownerName(c.owner_id)}</td>
                        <td className="py-2.5 px-3 border-b border-border font-semibold">
                          {projectCount.get(c.id) || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {filtered.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => router.push(`/contacts/${c.id}`)}
                      className="p-3.5 cursor-pointer active:bg-background"
                    >
                      <div className="font-semibold text-sm">
                        {c.first_name} {c.last_name || ""}
                      </div>
                      <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {c.phone && <span>{c.phone}</span>}
                        {c.email && <span className="truncate">{c.email}</span>}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {ownerName(c.owner_id)} · {projectCount.get(c.id) || 0} project
                        {(projectCount.get(c.id) || 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Tasks Due — every open follow-up you can see, soonest first. */}
      {view === "tasks" && (
        <TasksDue
          tasks={openTasks}
          contacts={contacts}
          team={team}
          onToggle={async (taskId) => {
            await setTaskStatus(taskId, "Done");
            await mutateTasks();
          }}
          onOpenContact={(cid) => router.push(`/contacts/${cid}`)}
        />
      )}

      {/* Contact modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
            <h3 className="text-lg font-bold mb-3">
              {editing ? "Edit Contact" : "New Contact"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="First Name *">
                <input value={fFirst} onChange={(e) => setFFirst(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Last Name">
                <input value={fLast} onChange={(e) => setFLast(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Phone">
                <input type="tel" value={fPhone} onChange={(e) => setFPhone(e.target.value)} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Contact Owner">
                  <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} className={inputCls}>
                    <option value="">Unassigned</option>
                    {team.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name || "(no name)"}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={3} className={inputCls} />
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModalOpen(false)} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-background border border-border cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="py-2 px-3.5 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}

/** Open follow-ups. Two ways to work: a grouped list for an overview, and a
 *  focus mode that serves one task at a time so a run of follow-ups can be
 *  worked end to end without going back to a contact page between each. */
function TasksDue({
  tasks,
  contacts,
  team,
  onToggle,
  onOpenContact,
}: {
  tasks: ContactTask[];
  contacts: Contact[];
  team: TeamMember[];
  onToggle: (taskId: string) => void | Promise<void>;
  onOpenContact: (contactId: string) => void;
}) {
  type Filter = "all" | "overdue" | "today" | "upcoming" | "nodate";
  const [filter, setFilter] = useState<Filter>("all");
  const [focusMode, setFocusMode] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [working, setWorking] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const contactName = (cid: string) => {
    const c = contacts.find((x) => x.id === cid);
    return c ? `${c.first_name} ${c.last_name || ""}`.trim() : "Unknown contact";
  };
  const memberName = (uid: string | null) =>
    uid ? team.find((t) => t.id === uid)?.full_name || "—" : "Unassigned";

  const sorted = [...tasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const matches = (t: ContactTask, f: Filter) => {
    if (f === "all") return true;
    if (f === "overdue") return Boolean(t.due_date && t.due_date < today);
    if (f === "today") return t.due_date === today;
    if (f === "upcoming") return Boolean(t.due_date && t.due_date > today);
    return !t.due_date;
  };

  const counts = {
    all: sorted.length,
    overdue: sorted.filter((t) => matches(t, "overdue")).length,
    today: sorted.filter((t) => matches(t, "today")).length,
    upcoming: sorted.filter((t) => matches(t, "upcoming")).length,
    nodate: sorted.filter((t) => matches(t, "nodate")).length,
  };

  const queue = sorted.filter((t) => matches(t, filter));

  const filters: { key: Filter; label: string; count: number; tone?: string }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "overdue", label: "Overdue", count: counts.overdue, tone: "text-red" },
    { key: "today", label: "Due today", count: counts.today },
    { key: "upcoming", label: "Upcoming", count: counts.upcoming },
    { key: "nodate", label: "No date", count: counts.nodate },
  ];

  function changeFilter(f: Filter) {
    setFilter(f);
    setFocusIdx(0);
  }

  const filterBar = (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => changeFilter(f.key)}
          disabled={f.count === 0 && f.key !== "all"}
          className={`py-1.5 px-3 text-xs font-semibold rounded-full border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            filter === f.key
              ? "bg-accent text-white border-accent"
              : `bg-card border-border hover:bg-background ${f.tone || ""}`
          }`}
        >
          {f.label} ({f.count})
        </button>
      ))}
      {queue.length > 0 && (
        <button
          onClick={() => { setFocusIdx(0); setFocusMode(!focusMode); }}
          className="ml-auto py-1.5 px-3 text-xs font-semibold rounded-full border border-border bg-card cursor-pointer hover:bg-background"
        >
          {focusMode ? "Show list" : "Work through these →"}
        </button>
      )}
    </div>
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted">
        Nothing outstanding. Follow-ups you add on a contact show up here.
      </div>
    );
  }

  // --- Focus mode: one task at a time -------------------------------------
  if (focusMode) {
    // Completing a task removes it from the queue, so the same index already
    // points at the next one. Clamp in case it was the last.
    const idx = Math.min(focusIdx, Math.max(0, queue.length - 1));
    const t = queue[idx];

    if (!t) {
      return (
        <div>
          {filterBar}
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="text-3xl">✓</div>
            <p className="mt-2 text-sm font-semibold">All clear.</p>
            <p className="mt-1 text-xs text-muted">
              Nothing left in {filters.find((f) => f.key === filter)?.label.toLowerCase()}.
            </p>
            <button
              onClick={() => setFocusMode(false)}
              className="mt-4 py-2 px-3.5 text-sm font-semibold rounded-lg bg-card border border-border cursor-pointer"
            >
              Back to list
            </button>
          </div>
        </div>
      );
    }

    const overdue = Boolean(t.due_date && t.due_date < today);

    return (
      <div>
        {filterBar}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex justify-between items-center text-xs text-muted mb-3">
            <span>{idx + 1} of {queue.length}</span>
            <button
              onClick={() => onOpenContact(t.contact_id)}
              className="text-accent bg-transparent border-none cursor-pointer p-0 font-semibold"
            >
              {contactName(t.contact_id)} →
            </button>
          </div>

          <h3 className="text-lg font-bold">{t.title}</h3>
          <div className="text-xs text-muted mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {t.due_date && (
              <span className={overdue ? "text-red font-semibold" : ""}>
                Due {formatDate(t.due_date)}{overdue ? " · overdue" : ""}
              </span>
            )}
            <span>{memberName(t.assigned_to)}</span>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={async () => {
                setWorking(true);
                try { await onToggle(t.id); } finally { setWorking(false); }
              }}
              disabled={working}
              className="py-2.5 px-4 text-sm font-semibold rounded-lg bg-green text-white border-none cursor-pointer disabled:opacity-60"
            >
              {working ? "Saving…" : "✓ Done — next"}
            </button>
            <button
              onClick={() => setFocusIdx(Math.min(idx + 1, queue.length - 1))}
              disabled={idx >= queue.length - 1}
              className="py-2.5 px-4 text-sm font-semibold rounded-lg bg-card border border-border cursor-pointer disabled:opacity-40"
            >
              Skip →
            </button>
            <button
              onClick={() => setFocusIdx(Math.max(0, idx - 1))}
              disabled={idx === 0}
              className="py-2.5 px-3 text-sm font-semibold rounded-lg bg-card border border-border cursor-pointer disabled:opacity-40"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- List mode ----------------------------------------------------------
  const groups: { label: string; items: ContactTask[]; tone?: string }[] =
    filter === "all"
      ? [
          { label: "Overdue", items: sorted.filter((t) => matches(t, "overdue")), tone: "text-red" },
          { label: "Due today", items: sorted.filter((t) => matches(t, "today")), tone: "text-accent" },
          { label: "Upcoming", items: sorted.filter((t) => matches(t, "upcoming")) },
          { label: "No date", items: sorted.filter((t) => matches(t, "nodate")) },
        ].filter((g) => g.items.length > 0)
      : [{ label: filters.find((f) => f.key === filter)!.label, items: queue }];

  return (
    <div>
      {filterBar}
      {queue.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted">
          Nothing in this group.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.label}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${g.tone || "text-muted"}`}>
                {g.label} ({g.items.length})
              </h3>
              <div className="bg-card border border-border rounded-xl divide-y divide-border">
                {g.items.map((t) => {
                  const overdue = Boolean(t.due_date && t.due_date < today);
                  return (
                    <div key={t.id} className="p-3.5 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => onToggle(t.id)}
                        title="Mark done"
                        className="mt-0.5 w-5 h-5 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{t.title}</div>
                        <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          <button
                            onClick={() => onOpenContact(t.contact_id)}
                            className="text-accent bg-transparent border-none cursor-pointer p-0 font-semibold"
                          >
                            {contactName(t.contact_id)}
                          </button>
                          {t.due_date && (
                            <span className={overdue ? "text-red font-semibold" : ""}>
                              Due {formatDate(t.due_date)}
                            </span>
                          )}
                          <span>{memberName(t.assigned_to)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
