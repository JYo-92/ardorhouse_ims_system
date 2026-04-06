"use client";

import { useState } from "react";
import { useInventory, saveInventoryItem, deleteInventoryItem, uploadImage } from "@/hooks/use-inventory";
import { useProjects } from "@/hooks/use-projects";
import { useToast } from "@/components/layout/toast-provider";
import { CATEGORIES, SIZES } from "@/lib/constants";
import { formatMoney, generateId, getAvail, getItemStatus } from "@/lib/calculations";
import { downloadCSV } from "@/lib/csv";
import type { InventoryItem } from "@/lib/types";

export default function InventoryPage() {
  const { inventory, mutate: mutateInv } = useInventory();
  const { projects } = useProjects();
  const { toast } = useToast();

  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formCat, setFormCat] = useState("");
  const [formSize, setFormSize] = useState("");
  const [formQty, setFormQty] = useState(1);
  const [formCost, setFormCost] = useState(0);
  const [formStatus, setFormStatus] = useState("In Warehouse");
  const [formNotes, setFormNotes] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Lightbox
  const [lbImages, setLbImages] = useState<string[]>([]);
  const [lbIndex, setLbIndex] = useState(0);
  const [lbOpen, setLbOpen] = useState(false);

  const allSizes = [...new Set(Object.values(SIZES).flat())];

  const filtered = inventory.filter((i) => {
    if (filterCat && i.category !== filterCat) return false;
    const st = getItemStatus(i, projects);
    if (filterStatus && !st.includes(filterStatus)) return false;
    if (filterSize && i.size !== filterSize) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.name.toLowerCase().includes(q) && !i.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function openModal(item?: InventoryItem) {
    if (item) {
      setEditItem(item);
      setFormName(item.name);
      setFormCat(item.category);
      setFormSize(item.size || "");
      setFormQty(item.qty);
      setFormCost(item.cost);
      setFormStatus(item.status);
      setFormNotes(item.notes || "");
      setFormImages([...(item.images || [])]);
    } else {
      setEditItem(null);
      setFormName("");
      setFormCat("");
      setFormSize("");
      setFormQty(1);
      setFormCost(0);
      setFormStatus("In Warehouse");
      setFormNotes("");
      setFormImages([]);
    }
    setPendingFiles([]);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCat) {
      toast("Name and category required", "error");
      return;
    }
    setSaving(true);
    try {
      // Upload new files
      const uploadedUrls: string[] = [];
      for (const file of pendingFiles) {
        const url = await uploadImage(file);
        uploadedUrls.push(url);
      }

      const item: InventoryItem = {
        id: editItem?.id || generateId(),
        name: formName.trim(),
        category: formCat,
        size: formSize || null,
        qty: formQty,
        cost: formCost,
        status: formStatus,
        notes: formNotes.trim() || null,
        images: [...formImages, ...uploadedUrls],
      };

      await saveInventoryItem(item);
      await mutateInv();
      setModalOpen(false);
      toast(editItem ? "Item updated" : "Item added");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this inventory item?")) return;
    try {
      await deleteInventoryItem(id);
      await mutateInv();
      toast("Item deleted");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      if (!f.type.startsWith("image/")) return false;
      if (f.size > 5 * 1024 * 1024) {
        toast("Image too large (max 5MB)", "error");
        return false;
      }
      return true;
    });
    setPendingFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  }

  function removeImage(idx: number) {
    setFormImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function removePendingFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function exportCSV() {
    if (!inventory.length) {
      toast("No data", "error");
      return;
    }
    const headers = ["Name", "Category", "Size", "Total Qty", "Available", "Status", "Cost/Piece", "Notes"];
    const rows = inventory.map((i) => [
      i.name, i.category, i.size || "", i.qty,
      getAvail(i.id, inventory, projects),
      getItemStatus(i, projects), i.cost || 0, i.notes || "",
    ]);
    downloadCSV("ardor-inventory", headers, rows);
  }

  const statusBadgeClass = (st: string) => {
    if (st.includes("Out")) return "bg-[#e0e7ff] text-[#4338ca]";
    if (st === "Reserved") return "bg-[#f3e8ff] text-[#7c3aed]";
    if (st.includes("Partial")) return "bg-[#fef9c3] text-[#ca8a04]";
    return "bg-[#dcfce7] text-[#16a34a]";
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-5">Inventory</h1>

      {/* Toolbar */}
      <div className="flex justify-between items-center flex-wrap gap-2.5 mb-4">
        <h2 className="text-base font-semibold">All Items</h2>
        <div className="flex gap-2">
          <button onClick={() => openModal()} className="inline-flex items-center gap-1.5 py-2 px-4 border-none rounded-lg text-sm font-semibold cursor-pointer bg-accent text-white hover:bg-accent2 transition-colors">
            + Add Item
          </button>
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-card text-foreground border border-border hover:bg-background transition-colors">
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-3.5">
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card">
          <option value="">All Statuses</option>
          <option>In Warehouse</option>
          <option>Out for Staging</option>
          <option>Reserved</option>
          <option>Scheduled for De-staging</option>
        </select>
        <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)} className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card">
          <option value="">All Sizes</option>
          {allSizes.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-12 px-5 text-center text-muted">
            <div className="text-3xl">📦</div>
            <p className="mt-1.5 text-sm">No inventory items found.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Item</th>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Category</th>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Size</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Total</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Available</th>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Status</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Cost/Piece</th>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const avail = getAvail(item.id, inventory, projects);
                const st = getItemStatus(item, projects);
                const shortage = avail === 0 && item.qty > 0;
                return (
                  <tr key={item.id} className="hover:bg-[#f9fafb]">
                    <td className="py-2.5 px-3 border-b border-border">
                      <strong>{item.name}</strong>
                      {shortage && <span className="ml-1.5 inline-block py-0.5 px-2 rounded-full text-xs font-semibold bg-[#fee2e2] text-red">SHORTAGE</span>}
                      {item.images?.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {item.images.slice(0, 3).map((src, idx) => (
                            <img
                              key={idx}
                              src={src}
                              alt=""
                              className="w-10 h-10 object-cover rounded border border-border cursor-pointer"
                              onClick={() => { setLbImages(item.images); setLbIndex(idx); setLbOpen(true); }}
                            />
                          ))}
                          {item.images.length > 3 && <span className="text-xs text-muted self-center">+{item.images.length - 3}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{item.category}</td>
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{item.size || "—"}</td>
                    <td className="py-2.5 px-3 border-b border-border text-right whitespace-nowrap">{item.qty}</td>
                    <td className={`py-2.5 px-3 border-b border-border text-right font-semibold whitespace-nowrap ${shortage ? "text-red" : "text-green"}`}>{avail}</td>
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">
                      <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${statusBadgeClass(st)}`}>{st}</span>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border text-right whitespace-nowrap">{formatMoney(item.cost)}</td>
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">
                      <button onClick={() => openModal(item)} className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background mr-1">Edit</button>
                      <button onClick={() => handleDelete(item.id)} className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-red text-white border-none cursor-pointer hover:bg-[#b91c1c]">Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/45 z-[300] flex justify-center items-start p-7 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="bg-card rounded-xl w-full max-w-[820px] shadow-2xl animate-[slideUp_0.25s_ease]">
            <div className="flex justify-between items-center py-4 px-6 border-b border-border">
              <h3 className="text-lg font-semibold">{editItem ? "Edit Item" : "Add Inventory Item"}</h3>
              <button onClick={() => setModalOpen(false)} className="bg-transparent border-none text-xl cursor-pointer text-muted">&times;</button>
            </div>
            <div className="p-5 px-6 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted">Item Name *</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted">Category *</label>
                  <select value={formCat} onChange={(e) => { setFormCat(e.target.value); setFormSize(""); }} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent">
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {SIZES[formCat] && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted">Size</label>
                    <select value={formSize} onChange={(e) => setFormSize(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent">
                      <option value="">Select...</option>
                      {SIZES[formCat].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted">Quantity Total *</label>
                  <input type="number" min={1} value={formQty} onChange={(e) => setFormQty(parseInt(e.target.value) || 1)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted">Cost Per Piece ($)</label>
                  <input type="number" min={0} step={0.01} value={formCost} onChange={(e) => setFormCost(parseFloat(e.target.value) || 0)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted">Status</label>
                  <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent">
                    <option>In Warehouse</option>
                    <option>Reserved</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 col-span-2 max-sm:col-span-1">
                  <label className="text-xs font-semibold text-muted">Notes</label>
                  <textarea rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="py-2 px-2.5 border border-border rounded-lg text-sm resize-y min-h-[50px] focus:outline-none focus:border-accent" />
                </div>
                <div className="flex flex-col gap-1 col-span-2 max-sm:col-span-1">
                  <label className="text-xs font-semibold text-muted">Images</label>
                  <div className="flex flex-wrap gap-2 items-start mt-1">
                    {formImages.map((src, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border group">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 bg-black/60 text-white border-none rounded-full w-5 h-5 text-xs cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                      </div>
                    ))}
                    {pendingFiles.map((f, i) => (
                      <div key={`p-${i}`} className="relative w-20 h-20 rounded-md overflow-hidden border-2 border-dashed border-accent/40 group flex items-center justify-center bg-accent/5">
                        <span className="text-xs text-accent truncate px-1">{f.name}</span>
                        <button onClick={() => removePendingFile(i)} className="absolute top-0.5 right-0.5 bg-black/60 text-white border-none rounded-full w-5 h-5 text-xs cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                      </div>
                    ))}
                    <label className="w-20 h-20 border-2 border-dashed border-border rounded-md flex items-center justify-center cursor-pointer text-muted text-2xl transition-colors hover:border-accent hover:text-accent">
                      +
                      <input type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="py-3.5 px-6 border-t border-border flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-card text-foreground border border-border hover:bg-background">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-accent text-white border-none hover:bg-accent2 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lbOpen && lbImages.length > 0 && (
        <div className="fixed inset-0 bg-black/85 z-[400] flex justify-center items-center p-5" onClick={() => setLbOpen(false)}>
          <button className="absolute top-4 right-5 bg-transparent border-none text-white text-3xl cursor-pointer" onClick={() => setLbOpen(false)}>&times;</button>
          {lbImages.length > 1 && (
            <>
              <button className="absolute top-1/2 left-5 -translate-y-1/2 bg-white/20 text-white border-none text-3xl py-2 px-4 cursor-pointer rounded-lg hover:bg-white/40" onClick={(e) => { e.stopPropagation(); setLbIndex((lbIndex - 1 + lbImages.length) % lbImages.length); }}>&lsaquo;</button>
              <button className="absolute top-1/2 right-5 -translate-y-1/2 bg-white/20 text-white border-none text-3xl py-2 px-4 cursor-pointer rounded-lg hover:bg-white/40" onClick={(e) => { e.stopPropagation(); setLbIndex((lbIndex + 1) % lbImages.length); }}>&rsaquo;</button>
            </>
          )}
          <img src={lbImages[lbIndex]} alt="" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
