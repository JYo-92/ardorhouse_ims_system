"use client";

import { useState } from "react";
import { useProjects, saveProjectInfo, createFinancials, updateFinancials, deleteProject } from "@/hooks/use-projects";
import { useProfile, useProfiles } from "@/hooks/use-profile";
import { useInventory } from "@/hooks/use-inventory";
import { useToast } from "@/components/layout/toast-provider";
import { BUSINESS_UNITS, PROJECT_STATUSES } from "@/lib/constants";
import { formatMoney, formatPercent, generateId, projCalc } from "@/lib/calculations";
import type { Project } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const { projects, mutate } = useProjects();
  const { isSuperAdmin } = useProfile();
  const { profiles } = useProfiles(isSuperAdmin);
  const { inventory } = useInventory();
  const { toast } = useToast();
  const router = useRouter();

  // Money columns appear only when the viewer can see at least one project's
  // financials (super admin = all; user = projects they own).
  const showMoney = isSuperAdmin || projects.some((p) => p.canSeeFinancials);

  const activeCount = projects.filter((p) => p.status === "Active").length;

  const [filterBU, setFilterBU] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProj, setEditProj] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fName, setFName] = useState("");
  const [fAddr, setFAddr] = useState("");
  const [fBU, setFBU] = useState("");
  const [fAgent, setFAgent] = useState("");
  const [fStatus, setFStatus] = useState("Scheduled");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fInvoice, setFInvoice] = useState(0);
  const [fDeposit, setFDeposit] = useState(0);
  const [fContract, setFContract] = useState(0);
  const [fOwner, setFOwner] = useState("");

  const filtered = projects.filter((p) => {
    if (filterBU && p.bu !== filterBU) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.address || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function openModal(p?: Project) {
    if (p) {
      setEditProj(p);
      setFName(p.name);
      setFAddr(p.address || "");
      setFBU(p.bu);
      setFAgent(p.agent || "");
      setFStatus(p.status);
      setFStart(p.start_date || "");
      setFEnd(p.end_date || "");
      setFNotes(p.notes || "");
      setFInvoice(p.invoice);
      setFDeposit(p.deposit);
      setFContract(p.contract_value || 0);
      setFOwner(p.contract_owner_id || "");
    } else {
      setEditProj(null);
      setFName(""); setFAddr(""); setFBU(""); setFAgent("");
      setFStatus("Scheduled"); setFStart(""); setFEnd("");
      setFNotes(""); setFInvoice(0); setFDeposit(0);
      setFContract(0); setFOwner("");
    }
    setModalOpen(true);
  }

  function handleStartChange(val: string) {
    setFStart(val);
    if (val && !fEnd) {
      // Parse as UTC and do the arithmetic in UTC so DST and local
      // timezone shifts can't move the date by ±1 day.
      const d = new Date(val + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 90);
      setFEnd(d.toISOString().slice(0, 10));
    }
  }

  async function handleSave() {
    if (!fName.trim()) { toast("Project name is required", "error"); return; }
    if (!fBU) { toast("Business unit is required", "error"); return; }
    setSaving(true);
    try {
      const base = { name: fName.trim(), address: fAddr.trim() || null, bu: fBU, agent: fAgent.trim() || null, status: fStatus, start_date: fStart || null, end_date: fEnd || null, notes: fNotes.trim() || null };
      const p: Project = editProj
        ? { ...editProj, ...base }
        : { id: generateId(), ...base, rooms: {}, canSeeFinancials: false, invoice: 0, deposit: 0, contract_value: 0, contract_owner_id: null, labor: [], misc_lines: [] };
      // Operational data (any authenticated user).
      await saveProjectInfo(p);
      // Financials (super admins only here — assigns owner + revenue).
      if (isSuperAdmin) {
        const finPatch = { invoice: fInvoice, deposit: fDeposit, contract_value: fContract, contract_owner_id: fOwner || null };
        if (editProj?.canSeeFinancials) {
          await updateFinancials(p.id, finPatch);
        } else {
          await createFinancials({ project_id: p.id, ...finPatch, labor: editProj?.labor ?? [], misc_lines: editProj?.misc_lines ?? [] });
        }
      }
      await mutate();
      setModalOpen(false);
      toast(editProj ? "Project updated" : "Project created");
      if (!editProj) router.push(`/projects/${p.id}`);
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    try {
      await deleteProject(id);
      await mutate();
      toast("Project deleted");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  }

  const statusBadge = (s: string) => {
    const cls = s === "Active" ? "bg-[#dcfce7] text-[#16a34a]" : s === "Scheduled" ? "bg-[#e0e7ff] text-[#4338ca]" : s === "De-stage Scheduled" ? "bg-[#fef9c3] text-[#ca8a04]" : s === "Completed" ? "bg-[#f3e8ff] text-[#7c3aed]" : "bg-gray-100 text-gray-600";
    return <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${cls}`}>{s === "De-stage Scheduled" ? "De-stage" : s}</span>;
  };

  const marginBadge = (m: number) => {
    const cls = m >= 50 ? "bg-[#dcfce7] text-[#16a34a]" : m >= 30 ? "bg-[#fef9c3] text-[#ca8a04]" : "bg-[#fee2e2] text-[#dc2626]";
    return <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${cls}`}>{formatPercent(m)}</span>;
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-5">Projects</h1>

      {/* Active projects highlight — click to filter to active, click again to clear */}
      <button
        onClick={() => setFilterStatus(filterStatus === "Active" ? "" : "Active")}
        title="Click to show only active projects"
        className={`flex items-center gap-4 mb-5 py-3.5 px-5 rounded-xl border text-left cursor-pointer transition-colors ${filterStatus === "Active" ? "bg-green border-green text-white" : "bg-[#dcfce7] border-[#bbf7d0] hover:bg-[#c9f7d5]"}`}
      >
        <span className={`text-4xl font-bold leading-none ${filterStatus === "Active" ? "text-white" : "text-[#16a34a]"}`}>{activeCount}</span>
        <span className="leading-tight">
          <span className={`block text-sm font-semibold ${filterStatus === "Active" ? "text-white" : "text-[#166534]"}`}>Active Project{activeCount === 1 ? "" : "s"}</span>
          <span className={`block text-xs ${filterStatus === "Active" ? "text-white/80" : "text-[#166534]/70"}`}>{filterStatus === "Active" ? "Showing active — click to clear" : "Click to filter"}</span>
        </span>
      </button>

      <div className="flex justify-between items-center flex-wrap gap-2.5 mb-4">
        <h2 className="text-base font-semibold">All Projects</h2>
        <button onClick={() => openModal()} className="inline-flex items-center gap-1.5 py-2 px-4 border-none rounded-lg text-sm font-semibold cursor-pointer bg-accent text-white hover:bg-accent2 transition-colors">
          + New Project
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-3.5">
        <select value={filterBU} onChange={(e) => setFilterBU(e.target.value)} className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card">
          <option value="">All Business Units</option>
          {BUSINESS_UNITS.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card">
          <option value="">All Statuses</option>
          {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card" />
      </div>

      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-12 px-5 text-center text-muted">
            <div className="text-3xl">📋</div>
            <p className="mt-1.5 text-sm">No projects found.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Project", "Business Unit", "Start", "End", ...(showMoney ? ["Invoice", "Profit", "Margin"] : []), "Status", ""].map((h, i) => (
                  <th key={i} className={`bg-background py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted border-b border-border whitespace-nowrap ${["Invoice", "Profit", "Margin"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const c = projCalc(p, inventory);
                return (
                  <tr key={p.id} className="hover:bg-[#f9fafb] cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                    <td className="py-2.5 px-3 border-b border-border">
                      <strong>{p.name}</strong>
                      {p.address && <><br /><span className="text-muted text-xs">{p.address}</span></>}
                    </td>
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{p.bu}</td>
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{p.start_date || "—"}</td>
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{p.end_date || "—"}</td>
                    {showMoney && (() => {
                      const canSee = isSuperAdmin || p.canSeeFinancials;
                      return (
                        <>
                          <td className="py-2.5 px-3 border-b border-border text-right whitespace-nowrap">{canSee ? formatMoney(c.invoice) : "—"}</td>
                          <td className={`py-2.5 px-3 border-b border-border text-right font-semibold whitespace-nowrap ${canSee && c.profit < 0 ? "text-red" : canSee ? "text-green" : ""}`}>{canSee ? formatMoney(c.profit) : "—"}</td>
                          <td className="py-2.5 px-3 border-b border-border text-right whitespace-nowrap">{canSee ? marginBadge(c.margin) : "—"}</td>
                        </>
                      );
                    })()}
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{statusBadge(p.status)}</td>
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openModal(p)} className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background mr-1">Edit</button>
                      <button onClick={() => handleDelete(p.id)} className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-red text-white border-none cursor-pointer hover:bg-[#b91c1c]">Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/45 z-[300] flex justify-center items-start p-7 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="bg-card rounded-xl w-full max-w-[820px] shadow-2xl animate-[slideUp_0.25s_ease]">
            <div className="flex justify-between items-center py-4 px-6 border-b border-border">
              <h3 className="text-lg font-semibold">{editProj ? "Edit Project" : "New Project"}</h3>
              <button onClick={() => setModalOpen(false)} className="bg-transparent border-none text-xl cursor-pointer text-muted">&times;</button>
            </div>
            <div className="p-5 px-6 max-h-[72vh] overflow-y-auto">
              {/* Project Info */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-accent uppercase tracking-wider mb-2.5 pb-1 border-b-2 border-accent inline-block">Project Info</h4>
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Project Name *</label><input value={fName} onChange={(e) => setFName(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" /></div>
                  <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Property Address</label><input value={fAddr} onChange={(e) => setFAddr(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" /></div>
                  <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Business Unit *</label><select value={fBU} onChange={(e) => setFBU(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"><option value="">Select...</option>{BUSINESS_UNITS.map((b) => <option key={b}>{b}</option>)}</select></div>
                  <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Agent Contact</label><input value={fAgent} onChange={(e) => setFAgent(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" /></div>
                  <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Status</label><select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent">{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
                  <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Start Date</label><input type="date" value={fStart} onChange={(e) => handleStartChange(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" /></div>
                  <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">End Date</label><input type="date" value={fEnd} onChange={(e) => setFEnd(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" /></div>
                  <div className="flex flex-col gap-1 col-span-2 max-sm:col-span-1"><label className="text-xs font-semibold text-muted">Notes</label><textarea rows={2} value={fNotes} onChange={(e) => setFNotes(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm resize-y min-h-[50px] focus:outline-none focus:border-accent" /></div>
                </div>
              </div>
              {/* Revenue & Contract — super admins only */}
              {isSuperAdmin && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-wider mb-2.5 pb-1 border-b-2 border-accent inline-block">Revenue &amp; Contract</h4>
                  <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Contract Owner</label><select value={fOwner} onChange={(e) => setFOwner(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"><option value="">Ardor House (unassigned)</option>{profiles.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}</select></div>
                    <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Total Contract Value ($)</label><input type="number" min={0} step={0.01} value={fContract} onChange={(e) => setFContract(parseFloat(e.target.value) || 0)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" /></div>
                    <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Invoice Amount ($)</label><input type="number" min={0} step={0.01} value={fInvoice} onChange={(e) => setFInvoice(parseFloat(e.target.value) || 0)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" /></div>
                    <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-muted">Deposit Collected ($)</label><input type="number" min={0} step={0.01} value={fDeposit} onChange={(e) => setFDeposit(parseFloat(e.target.value) || 0)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" /></div>
                  </div>
                </div>
              )}
            </div>
            <div className="py-3.5 px-6 border-t border-border flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-card text-foreground border border-border hover:bg-background">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-accent text-white border-none hover:bg-accent2 disabled:opacity-50">{saving ? "Saving..." : "Save Project"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
