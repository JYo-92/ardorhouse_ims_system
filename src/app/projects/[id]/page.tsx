"use client";

import { useState, use } from "react";
import { useProjects, saveProject } from "@/hooks/use-projects";
import { useInventory } from "@/hooks/use-inventory";
import { useToast } from "@/components/layout/toast-provider";
import { LABOR_ROLES } from "@/lib/constants";
import { formatMoney, formatPercent, projCalc, getAvail, getLaborHours, getLaborCost } from "@/lib/calculations";
import type { Project, LaborEntry, MiscLine } from "@/lib/types";
import Link from "next/link";

type Tab = "rooms" | "labor" | "misc" | "pnl";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { projects, mutate } = useProjects();
  const { inventory } = useInventory();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("rooms");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignRoom, setAssignRoom] = useState("");
  const [assignSelections, setAssignSelections] = useState<Record<string, number>>({});
  const [assignSearch, setAssignSearch] = useState("");
  const [newRoomName, setNewRoomName] = useState("");

  const project = projects.find((p) => p.id === id);
  if (!project) {
    return (
      <div className="py-12 text-center text-muted">
        <p>Project not found.</p>
        <Link href="/projects" className="text-accent mt-2 inline-block">← Back to Projects</Link>
      </div>
    );
  }

  const calc = projCalc(project, inventory);
  const roomKeys = Object.keys(project.rooms || {});

  async function save(updated: Partial<Project>) {
    const p = { ...project!, ...updated };
    await saveProject(p);
    await mutate();
  }

  // Room management
  async function addRoom(roomName: string) {
    const name = roomName.trim();
    if (!name) return;
    if (roomKeys.includes(name)) { toast(`Room "${name}" already exists`, "error"); return; }
    await save({ rooms: { ...project!.rooms, [name]: [] } });
    setNewRoomName("");
    toast(`Room "${name}" added`);
  }

  async function deleteRoom(roomName: string) {
    if (!confirm(`Remove room "${roomName}" and all furniture?`)) return;
    const rooms = { ...project!.rooms };
    delete rooms[roomName];
    await save({ rooms });
    toast(`Room "${roomName}" removed`);
  }

  function openAssign(roomName: string) {
    setAssignRoom(roomName);
    setAssignSelections({});
    setAssignSearch("");
    setAssignModalOpen(true);
  }

  function toggleSelection(itemId: string) {
    setAssignSelections((prev) => {
      const next = { ...prev };
      if (next[itemId]) delete next[itemId];
      else next[itemId] = 1;
      return next;
    });
  }

  function setSelectionQty(itemId: string, qty: number) {
    setAssignSelections((prev) => ({ ...prev, [itemId]: Math.max(1, qty) }));
  }

  async function confirmAssign() {
    const ids = Object.keys(assignSelections);
    if (ids.length === 0) { toast("Select at least one item", "error"); return; }
    const rooms = { ...project!.rooms };
    const rm = [...(rooms[assignRoom] || [])];
    ids.forEach((itemId) => rm.push({ itemId, qty: assignSelections[itemId] }));
    rooms[assignRoom] = rm;
    await save({ rooms });
    setAssignModalOpen(false);
    toast(`${ids.length} item${ids.length > 1 ? "s" : ""} assigned`);
  }

  async function unassign(roomName: string, idx: number) {
    const rooms = { ...project!.rooms };
    const rm = [...(rooms[roomName] || [])];
    rm.splice(idx, 1);
    rooms[roomName] = rm;
    await save({ rooms });
  }

  // Labor management
  async function addLabor() {
    const labor = [...(project!.labor || []), { name: "", role: "Stager", start_time: "09:00", end_time: "17:00", rate: 0 }];
    await save({ labor });
  }

  async function updateLabor(idx: number, field: keyof LaborEntry, value: string | number) {
    const labor = [...(project!.labor || [])];
    labor[idx] = { ...labor[idx], [field]: typeof value === "string" ? value : Number(value) };
    await save({ labor });
  }

  async function removeLabor(idx: number) {
    const labor = [...(project!.labor || [])];
    labor.splice(idx, 1);
    await save({ labor });
  }

  // Misc management
  async function addMisc() {
    const misc_lines = [...(project!.misc_lines || []), { desc: "", amount: 0 }];
    await save({ misc_lines });
  }

  async function updateMisc(idx: number, field: keyof MiscLine, value: string | number) {
    const misc_lines = [...(project!.misc_lines || [])];
    misc_lines[idx] = { ...misc_lines[idx], [field]: field === "amount" ? Number(value) : value };
    await save({ misc_lines });
  }

  async function removeMisc(idx: number) {
    const misc_lines = [...(project!.misc_lines || [])];
    misc_lines.splice(idx, 1);
    await save({ misc_lines });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "rooms", label: "Rooms & Furniture" },
    { key: "labor", label: "Labor" },
    { key: "misc", label: "Miscellaneous" },
    { key: "pnl", label: "P&L Summary" },
  ];

  const statusCls = project.status === "Active" ? "bg-[#dcfce7] text-[#16a34a]" : project.status === "Scheduled" ? "bg-[#e0e7ff] text-[#4338ca]" : project.status === "De-stage Scheduled" ? "bg-[#fef9c3] text-[#ca8a04]" : "bg-[#f3e8ff] text-[#7c3aed]";

  return (
    <div>
      <Link href="/projects" className="text-sm text-muted hover:text-accent no-underline">← Back to Projects</Link>

      <div className="flex items-center gap-3 mt-3 mb-5">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${statusCls}`}>{project.status}</span>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-4 max-sm:grid-cols-2">
        <div><div className="text-[.68rem] text-muted uppercase tracking-wider">Business Unit</div><div className="text-sm font-semibold mt-0.5">{project.bu}</div></div>
        <div><div className="text-[.68rem] text-muted uppercase tracking-wider">Address</div><div className="text-sm font-semibold mt-0.5">{project.address || "—"}</div></div>
        <div><div className="text-[.68rem] text-muted uppercase tracking-wider">Agent</div><div className="text-sm font-semibold mt-0.5">{project.agent || "—"}</div></div>
        <div><div className="text-[.68rem] text-muted uppercase tracking-wider">Start Date</div><div className="text-sm font-semibold mt-0.5">{project.start_date || "—"}</div></div>
        <div><div className="text-[.68rem] text-muted uppercase tracking-wider">End Date</div><div className="text-sm font-semibold mt-0.5">{project.end_date || "—"}</div></div>
        <div><div className="text-[.68rem] text-muted uppercase tracking-wider">Invoice</div><div className="text-sm font-semibold mt-0.5">{formatMoney(project.invoice)}</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b-2 border-border mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`py-2 px-4 text-sm font-semibold cursor-pointer border-b-2 -mb-[2px] transition-colors bg-transparent border-none ${activeTab === t.key ? "text-accent border-b-accent border-b-2" : "text-muted hover:text-foreground border-b-transparent"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Rooms Tab */}
      {activeTab === "rooms" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRoom(newRoomName); }}
              placeholder="Room name (e.g. Living Room)"
              className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent"
            />
            <button onClick={() => addRoom(newRoomName)} className="py-1.5 px-3 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer hover:bg-accent2">+ Add Room</button>
          </div>

          {roomKeys.length === 0 ? (
            <div className="py-8 text-center text-muted text-sm">No rooms added yet. Add a room to start assigning furniture.</div>
          ) : (
            roomKeys.map((rm) => (
              <div key={rm} className="bg-background rounded-lg p-3.5 px-4 mb-2.5">
                <h5 className="text-sm font-semibold mb-2 flex justify-between items-center">
                  {rm}
                  <span className="flex gap-1.5">
                    <button onClick={() => openAssign(rm)} className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-accent text-white border-none cursor-pointer">+ Furniture</button>
                    <button onClick={() => deleteRoom(rm)} className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-red text-white border-none cursor-pointer">Remove</button>
                  </span>
                </h5>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {(project.rooms[rm] || []).length === 0 ? (
                    <span className="text-muted text-xs">No furniture assigned</span>
                  ) : (
                    (project.rooms[rm] || []).map((a, ai) => {
                      const it = inventory.find((i) => i.id === a.itemId);
                      const thumb = it?.images?.[0];
                      return (
                        <div key={ai} className="relative bg-card border border-border rounded-lg w-28 overflow-hidden group">
                          <button
                            onClick={() => unassign(rm, ai)}
                            className="absolute top-1 right-1 z-10 bg-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold cursor-pointer border-none opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove"
                          >
                            ✕
                          </button>
                          <div className="w-full aspect-square bg-background flex items-center justify-center">
                            {thumb ? (
                              <img src={thumb} alt={it?.name || ""} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-3xl text-muted">🛋️</span>
                            )}
                          </div>
                          <div className="p-1.5">
                            <div className="text-xs font-semibold truncate">{it ? it.name : "Unknown"}</div>
                            <div className="text-[.65rem] text-muted flex justify-between">
                              <span className="truncate">{it?.size || ""}</span>
                              {a.qty > 1 && <span className="font-semibold text-foreground">x{a.qty}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Labor Tab */}
      {activeTab === "labor" && (
        <div>
          <button onClick={addLabor} className="py-1.5 px-3 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer hover:bg-accent2 mb-3">+ Add Labor</button>
          {(project.labor || []).length === 0 ? (
            <div className="py-8 text-center text-muted text-sm">No labor entries yet.</div>
          ) : (
            <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Name", "Role", "Start", "End", "Hours", "Rate ($/hr)", "Cost", ""].map((h, i) => (
                      <th key={i} className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(project.labor || []).map((l, i) => {
                    const hrs = getLaborHours(l);
                    return (
                      <tr key={i}>
                        <td className="py-2 px-3 border-b border-border"><input value={l.name || ""} onChange={(e) => updateLabor(i, "name", e.target.value)} placeholder="Name" className="w-32 py-1.5 px-2 border border-border rounded text-sm" /></td>
                        <td className="py-2 px-3 border-b border-border"><select value={l.role} onChange={(e) => updateLabor(i, "role", e.target.value)} className="py-1.5 px-2 border border-border rounded text-sm">{LABOR_ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
                        <td className="py-2 px-3 border-b border-border"><input type="time" value={l.start_time || ""} onChange={(e) => updateLabor(i, "start_time", e.target.value)} className="py-1.5 px-2 border border-border rounded text-sm" /></td>
                        <td className="py-2 px-3 border-b border-border"><input type="time" value={l.end_time || ""} onChange={(e) => updateLabor(i, "end_time", e.target.value)} className="py-1.5 px-2 border border-border rounded text-sm" /></td>
                        <td className="py-2 px-3 border-b border-border text-muted">{hrs.toFixed(2)}</td>
                        <td className="py-2 px-3 border-b border-border"><input type="number" min={0} step={0.01} value={l.rate} onChange={(e) => updateLabor(i, "rate", parseFloat(e.target.value) || 0)} className="w-24 py-1.5 px-2 border border-border rounded text-sm" /></td>
                        <td className="py-2 px-3 border-b border-border font-semibold">{formatMoney(getLaborCost(l))}</td>
                        <td className="py-2 px-3 border-b border-border"><button onClick={() => removeLabor(i)} className="py-1 px-2 text-xs font-semibold rounded bg-red text-white border-none cursor-pointer">Del</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Misc Tab */}
      {activeTab === "misc" && (
        <div>
          <button onClick={addMisc} className="py-1.5 px-3 text-sm font-semibold rounded-lg bg-accent text-white border-none cursor-pointer hover:bg-accent2 mb-3">+ Add Line Item</button>
          {(project.misc_lines || []).length === 0 ? (
            <div className="py-8 text-center text-muted text-sm">No miscellaneous items.</div>
          ) : (
            <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Description", "Amount", ""].map((h, i) => (
                      <th key={i} className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(project.misc_lines || []).map((m, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 border-b border-border"><input value={m.desc} onChange={(e) => updateMisc(i, "desc", e.target.value)} placeholder="Description" className="w-full py-1.5 px-2 border border-border rounded text-sm" /></td>
                      <td className="py-2 px-3 border-b border-border"><input type="number" min={0} step={0.01} value={m.amount} onChange={(e) => updateMisc(i, "amount", parseFloat(e.target.value) || 0)} className="w-28 py-1.5 px-2 border border-border rounded text-sm" /></td>
                      <td className="py-2 px-3 border-b border-border"><button onClick={() => removeMisc(i)} className="py-1 px-2 text-xs font-semibold rounded bg-red text-white border-none cursor-pointer">Del</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* P&L Tab */}
      {activeTab === "pnl" && (
        <div className="bg-[#f8f7ff] border border-[#e0dcfc] rounded-lg p-4">
          <div className="flex justify-between py-1 text-sm"><span>Invoice</span><span className="font-semibold">{formatMoney(calc.invoice)}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>Deposit</span><span className="font-semibold">{formatMoney(project.deposit)}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>Balance Due</span><span className="font-semibold">{formatMoney(calc.balance)}</span></div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between py-1 text-sm"><span>Labor</span><span className="font-semibold">{formatMoney(calc.totalLabor)}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>Miscellaneous</span><span className="font-semibold">{formatMoney(calc.totalMisc)}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>Inventory Cost</span><span className="font-semibold">{formatMoney(calc.totalInvCost)}</span></div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between py-2 text-base font-bold border-t-2 border-accent mt-1.5 pt-2"><span>Total Cost</span><span>{formatMoney(calc.totalCost)}</span></div>
          <div className={`flex justify-between py-1 text-base font-bold ${calc.profit >= 0 ? "text-green" : "text-red"}`}><span>Profit</span><span>{formatMoney(calc.profit)}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>Margin</span><span className="font-semibold">{formatPercent(calc.margin)}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>Labor %</span><span className="font-semibold">{formatPercent(calc.laborPct)}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>Pieces</span><span className="font-semibold">{calc.pieces}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>Cost/Piece</span><span className="font-semibold">{formatMoney(calc.cpp)}</span></div>
        </div>
      )}

      {/* Assign Furniture Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/45 z-[300] flex justify-center items-start p-7 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setAssignModalOpen(false); }}>
          <div className="bg-card rounded-xl w-full max-w-[860px] shadow-2xl animate-[slideUp_0.25s_ease]">
            <div className="flex justify-between items-center py-4 px-6 border-b border-border">
              <h3 className="text-lg font-semibold">Assign Furniture to {assignRoom}</h3>
              <button onClick={() => setAssignModalOpen(false)} className="bg-transparent border-none text-xl cursor-pointer text-muted">&times;</button>
            </div>
            <div className="p-5 px-6">
              <input
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="Search inventory by name or category..."
                className="w-full py-2 px-2.5 border border-border rounded-lg text-sm mb-3 focus:outline-none focus:border-accent"
              />
              <div className="grid grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {(() => {
                  const q = assignSearch.trim().toLowerCase();
                  const list = inventory.filter((i) =>
                    !q || i.name.toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q)
                  );
                  if (list.length === 0) {
                    return <div className="col-span-full py-8 text-center text-muted text-sm">No items match.</div>;
                  }
                  return list.map((i) => {
                    const avail = getAvail(i.id, inventory, projects);
                    const selected = i.id in assignSelections;
                    const qty = assignSelections[i.id] || 1;
                    const thumb = i.images?.[0];
                    return (
                      <div
                        key={i.id}
                        onClick={() => toggleSelection(i.id)}
                        className={`relative text-left rounded-lg border p-2 cursor-pointer transition-all bg-card ${selected ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/50"}`}
                      >
                        {selected && (
                          <div className="absolute top-1 right-1 z-10 bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</div>
                        )}
                        <div className="w-full aspect-square rounded bg-background overflow-hidden flex items-center justify-center mb-1.5">
                          {thumb ? (
                            <img src={thumb} alt={i.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl text-muted">🛋️</span>
                          )}
                        </div>
                        <div className="text-xs font-semibold truncate">{i.name}</div>
                        <div className="text-[.65rem] text-muted flex justify-between mt-0.5">
                          <span className="truncate">{i.size || i.category}</span>
                          <span className={avail > 0 ? "" : "text-red"}>Avail: {avail}</span>
                        </div>
                        {selected && (
                          <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <label className="text-[.65rem] text-muted">Qty</label>
                            <input
                              type="number"
                              min={1}
                              value={qty}
                              onChange={(e) => setSelectionQty(i.id, parseInt(e.target.value) || 1)}
                              className="w-full py-1 px-1.5 border border-border rounded text-xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex items-center justify-between gap-3 mt-4">
                <span className="text-xs text-muted">
                  {Object.keys(assignSelections).length === 0
                    ? "Click items to select. Click again to deselect."
                    : <><strong className="text-foreground">{Object.keys(assignSelections).length}</strong> item{Object.keys(assignSelections).length > 1 ? "s" : ""} selected</>}
                </span>
                {Object.keys(assignSelections).length > 0 && (
                  <button onClick={() => setAssignSelections({})} className="text-xs text-muted hover:text-accent underline bg-transparent border-none cursor-pointer">Clear</button>
                )}
              </div>
            </div>
            <div className="py-3.5 px-6 border-t border-border flex justify-end gap-2">
              <button onClick={() => setAssignModalOpen(false)} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-card text-foreground border border-border hover:bg-background">Cancel</button>
              <button onClick={confirmAssign} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-accent text-white border-none hover:bg-accent2">Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
