import { useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Image as ImageIcon, Music, Loader2, Trash2, Pencil, X, Check, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AudioTrimmer } from "@/components/AudioTrimmer";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Magic Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const [tab, setTab] = useState<"reels" | "photoshop">("reels");
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Admin</h1>
          <div className="flex gap-2 text-sm">
            <Link to="/feed" className="text-brand">Reels feed →</Link>
            <Link to="/photoshop_/feed" className="text-brand">Photoshop feed →</Link>
          </div>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-card border border-border mb-6">
          {(["reels", "photoshop"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize ${
                tab === t ? "bg-brand text-white" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "reels" ? <ReelsAdmin /> : <PhotoshopAdmin />}
      </div>
    </div>
  );
}

/* =========================================================================
   REELS ADMIN (original functionality)
   ========================================================================= */

function ReelsAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [song, setSong] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [audioStart, setAudioStart] = useState(0);
  const [audioEnd, setAudioEnd] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [editSong, setEditSong] = useState("");
  const [editImages, setEditImages] = useState<File[]>([]);
  const [editAudio, setEditAudio] = useState<File | null>(null);
  const [editAudioStart, setEditAudioStart] = useState(0);
  const [editAudioEnd, setEditAudioEnd] = useState<number | null>(null);
  const [editKeepAudio, setEditKeepAudio] = useState<{ url: string; start: number; end: number | null } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const audRef = useRef<HTMLInputElement>(null);

  const reels = useQuery({
    queryKey: ["admin-reels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reels").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reels"] });
      qc.invalidateQueries({ queryKey: ["feed-reels"] });
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (images.length === 0 || !title.trim()) {
      setMsg("Title and at least one photo are required.");
      return;
    }
    setBusy(true);
    try {
      const image_urls = await Promise.all(images.map((f) => uploadFile("reel-images", f)));
      const image_url = image_urls[0];
      const audio_url = audio ? await uploadFile("reel-audio", audio) : null;
      const tags = parseTags(hashtags);
      const { error } = await supabase.from("reels").insert({
        title: title.trim(),
        hashtags: tags,
        song: song.trim() || null,
        image_url,
        image_urls,
        audio_url,
        audio_start_sec: audio ? audioStart : 0,
        audio_end_sec: audio ? audioEnd : null,
      });
      if (error) throw error;
      setTitle(""); setHashtags(""); setSong(""); setImages([]); setAudio(null);
      setAudioStart(0); setAudioEnd(null);
      if (imgRef.current) imgRef.current.value = "";
      if (audRef.current) audRef.current.value = "";
      setMsg("Reel published.");
      qc.invalidateQueries({ queryKey: ["admin-reels"] });
      qc.invalidateQueries({ queryKey: ["feed-reels"] });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setMsg(`Error: ${e.message ?? "upload failed"}`);
    } finally {
      setBusy(false);
    }
  }

  type ReelRow = {
    id: string; title: string; hashtags: string[]; song: string | null;
    image_url: string; image_urls: string[]; audio_url: string | null;
    audio_start_sec: number | null; audio_end_sec: number | null;
  };

  function startEdit(r: ReelRow) {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditHashtags(r.hashtags.join(" "));
    setEditSong(r.song ?? "");
    setEditImages([]); setEditAudio(null);
    setEditAudioStart(Number(r.audio_start_sec ?? 0));
    setEditAudioEnd(r.audio_end_sec != null ? Number(r.audio_end_sec) : null);
    setEditKeepAudio(r.audio_url ? { url: r.audio_url, start: Number(r.audio_start_sec ?? 0), end: r.audio_end_sec != null ? Number(r.audio_end_sec) : null } : null);
  }
  function cancelEdit() { setEditingId(null); setEditImages([]); setEditAudio(null); setEditKeepAudio(null); }

  async function saveEdit(id: string) {
    setEditBusy(true);
    try {
      const tags = parseTags(editHashtags);
      const update: {
        title: string;
        hashtags: string[];
        song: string | null;
        audio_start_sec: number;
        audio_end_sec: number | null;
        image_urls?: string[];
        image_url?: string;
        audio_url?: string;
      } = {
        title: editTitle.trim(), hashtags: tags, song: editSong.trim() || null,
        audio_start_sec: editAudioStart, audio_end_sec: editAudioEnd,
      };
      if (editImages.length > 0) {
        const image_urls = await Promise.all(editImages.map((f) => uploadFile("reel-images", f)));
        update.image_urls = image_urls;
        update.image_url = image_urls[0];
      }
      if (editAudio) update.audio_url = await uploadFile("reel-audio", editAudio);
      const { error } = await supabase.from("reels").update(update).eq("id", id);
      if (error) throw error;
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["admin-reels"] });
      qc.invalidateQueries({ queryKey: ["feed-reels"] });
    } catch (err: unknown) {
      const e = err as { message?: string };
      alert(`Error: ${e.message ?? "update failed"}`);
    } finally { setEditBusy(false); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-2xl p-5 h-fit">
        <h2 className="text-lg font-semibold">Add reel</h2>
        <Field label="Title">
          <Input value={title} onChange={(v) => setTitle(v)} placeholder="Neon city nights" />
        </Field>
        <Field label="Hashtags (comma or space separated)">
          <Input value={hashtags} onChange={(v) => setHashtags(v)} placeholder="cinematic, neon, aiart" />
        </Field>
        <Field label="Song name (label shown on reel)">
          <Input value={song} onChange={(v) => setSong(v)} placeholder="Stardust — Luna" />
        </Field>
        <Field label="Photos (one or more — swipeable)">
          <FilePicker icon={<ImageIcon className="size-4" />} multiple inputRef={imgRef}
            placeholder={images.length === 0 ? "Choose photos…" : `${images.length} photo${images.length === 1 ? "" : "s"} selected`}
            accept="image/*" onChange={(files) => setImages(files)} />
          {images.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto">
              {images.map((f, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={URL.createObjectURL(f)} alt="" className="size-16 rounded-lg object-cover border border-border" />
                  <span className="absolute -top-1 -left-1 bg-brand text-white text-[10px] font-bold rounded-full size-4 flex items-center justify-center">{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </Field>
        <Field label="Music (audio or video file)">
          <FilePicker icon={<Music className="size-4" />} inputRef={audRef}
            placeholder={audio ? audio.name : "Choose file…"} accept="audio/*,video/*"
            onChange={(files) => setAudio(files[0] ?? null)} />
        </Field>
        {audio && (
          <AudioTrimmer file={audio} start={audioStart} end={audioEnd}
            onChange={(s, e) => { setAudioStart(s); setAudioEnd(e); }} />
        )}
        <button type="submit" disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-brand text-white font-semibold rounded-lg py-2.5 disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Uploading…" : "Publish reel"}
        </button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </form>

      <div>
        <h2 className="text-lg font-semibold mb-3">Existing reels</h2>
        <div className="space-y-2">
          {reels.data?.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-2">
              {editingId === r.id ? (
                <div className="space-y-2 p-2">
                  <Field label="Title"><Input value={editTitle} onChange={setEditTitle} /></Field>
                  <Field label="Hashtags"><Input value={editHashtags} onChange={setEditHashtags} /></Field>
                  <Field label="Song"><Input value={editSong} onChange={setEditSong} /></Field>
                  <Field label="Replace photos (optional)">
                    <FilePicker icon={<ImageIcon className="size-4" />} multiple accept="image/*"
                      placeholder={editImages.length === 0 ? "Keep current photos" : `${editImages.length} new photo${editImages.length === 1 ? "" : "s"}`}
                      onChange={setEditImages} />
                  </Field>
                  <Field label="Replace music (optional)">
                    <FilePicker icon={<Music className="size-4" />} accept="audio/*,video/*"
                      placeholder={editAudio ? editAudio.name : "Keep current music"}
                      onChange={(files) => setEditAudio(files[0] ?? null)} />
                  </Field>
                  {editAudio ? (
                    <AudioTrimmer file={editAudio} start={editAudioStart} end={editAudioEnd}
                      onChange={(s, e) => { setEditAudioStart(s); setEditAudioEnd(e); }} />
                  ) : editKeepAudio ? (
                    <AudioTrimmer url={editKeepAudio.url} start={editAudioStart} end={editAudioEnd}
                      onChange={(s, e) => { setEditAudioStart(s); setEditAudioEnd(e); }} />
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => saveEdit(r.id)} disabled={editBusy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-brand text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-60">
                      {editBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save
                    </button>
                    <button onClick={cancelEdit} disabled={editBusy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-muted text-foreground text-sm font-semibold rounded-lg py-2">
                      <X className="size-4" />Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <img src={r.image_url} alt={r.title} className="size-14 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.hashtags.join(" ")} {r.song && `· ${r.song}`}</p>
                  </div>
                  <button onClick={() => startEdit(r as ReelRow)} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Edit reel">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => del.mutate(r.id)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Delete reel">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {reels.data?.length === 0 && <p className="text-sm text-muted-foreground">No reels yet.</p>}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   PHOTOSHOP ADMIN — sections + items
   ========================================================================= */

type PhotoshopSection = {
  id: string;
  title: string;
  position: number;
  created_at: string;
};
type PhotoshopItem = {
  id: string;
  section_id: string;
  title: string;
  hashtags: string[];
  song: string | null;
  image_url: string;
  image_urls: string[];
  audio_url: string | null;
  audio_start_sec: number | null;
  audio_end_sec: number | null;
  position: number;
  created_at: string;
};

function PhotoshopAdmin() {
  const qc = useQueryClient();
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const sectionsQ = useQuery({
    queryKey: ["admin-photoshop-sections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("photoshop_sections").select("*").order("position").order("created_at");
      if (error) throw error;
      return data as PhotoshopSection[];
    },
  });
  const itemsQ = useQuery({
    queryKey: ["admin-photoshop-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("photoshop_items").select("*").order("position").order("created_at");
      if (error) throw error;
      return data as PhotoshopItem[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-photoshop-sections"] });
    qc.invalidateQueries({ queryKey: ["admin-photoshop-items"] });
    qc.invalidateQueries({ queryKey: ["photoshop-sections"] });
    qc.invalidateQueries({ queryKey: ["photoshop-feed"] });
  };

  const addSection = async () => {
    const title = newSectionTitle.trim();
    if (!title) return;
    const pos = (sectionsQ.data?.length ?? 0);
    const { error } = await supabase.from("photoshop_sections").insert({ title, position: pos });
    if (error) { alert(error.message); return; }
    setNewSectionTitle("");
    invalidateAll();
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">New section title</span>
          <Input value={newSectionTitle} onChange={setNewSectionTitle} placeholder="e.g. Wedding portraits" />
        </div>
        <button onClick={addSection}
          className="inline-flex items-center justify-center gap-2 bg-brand text-white font-semibold rounded-lg px-4 py-2.5 text-sm">
          <Plus className="size-4" />Add section
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {sectionsQ.data?.map((s) => (
          <SectionCard
            key={s.id}
            section={s}
            items={(itemsQ.data ?? []).filter((i) => i.section_id === s.id)}
            onChange={invalidateAll}
          />
        ))}
      </div>
      {sectionsQ.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No sections yet. Add your first one above.</p>
      )}
    </div>
  );
}

function SectionCard({ section, items, onChange }: {
  section: PhotoshopSection;
  items: PhotoshopItem[];
  onChange: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(section.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const saveTitle = async () => {
    const t = titleDraft.trim();
    if (!t || t === section.title) { setEditingTitle(false); return; }
    const { error } = await supabase.from("photoshop_sections").update({ title: t }).eq("id", section.id);
    if (error) { alert(error.message); return; }
    setEditingTitle(false);
    onChange();
  };

  const deleteSection = async () => {
    if (!confirm(`Delete section "${section.title}" and all its photos?`)) return;
    const { error } = await supabase.from("photoshop_sections").delete().eq("id", section.id);
    if (error) { alert(error.message); return; }
    onChange();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("photoshop_items").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    onChange();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        {editingTitle ? (
          <>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-semibold"
              autoFocus
            />
            <button onClick={saveTitle} className="p-1.5 text-brand"><Check className="size-4" /></button>
            <button onClick={() => { setEditingTitle(false); setTitleDraft(section.title); }} className="p-1.5 text-muted-foreground"><X className="size-4" /></button>
          </>
        ) : (
          <>
            <h3 className="flex-1 text-base font-bold truncate">{section.title}</h3>
            <button onClick={() => setEditingTitle(true)} className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Rename"><Pencil className="size-4" /></button>
            <button onClick={deleteSection} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete section"><Trash2 className="size-4" /></button>
          </>
        )}
      </div>

      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-background border border-border">
            <img src={it.image_url} alt={it.title} className="size-10 rounded object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{it.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{it.hashtags.join(" ")} {it.song && `· ${it.song}`}</p>
            </div>
            <button onClick={() => deleteItem(it.id)} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete photo">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground px-1">No photos in this section yet.</p>}
      </div>

      {showAdd ? (
        <AddItemForm
          section={section}
          existingCount={items.length}
          onDone={() => { setShowAdd(false); onChange(); }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30">
          <Plus className="size-3.5" />Add photo
        </button>
      )}
    </div>
  );
}

function AddItemForm({ section, existingCount, onDone, onCancel }: {
  section: PhotoshopSection; existingCount: number; onDone: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [song, setSong] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [audioStart, setAudioStart] = useState(0);
  const [audioEnd, setAudioEnd] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || images.length === 0) {
      alert("Title and at least one photo required.");
      return;
    }
    setBusy(true);
    try {
      const image_urls = await Promise.all(images.map((f) => uploadFile("reel-images", f)));
      const audio_url = audio ? await uploadFile("photoshop-audio", audio) : null;
      const { error } = await supabase.from("photoshop_items").insert({
        section_id: section.id,
        title: title.trim(),
        hashtags: parseTags(hashtags),
        song: song.trim() || null,
        image_url: image_urls[0],
        image_urls,
        audio_url,
        audio_start_sec: audio ? audioStart : 0,
        audio_end_sec: audio ? audioEnd : null,
        position: existingCount,
      });
      if (error) throw error;
      onDone();
    } catch (err: unknown) {
      const e = err as { message?: string };
      alert(`Error: ${e.message ?? "upload failed"}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 p-3 rounded-lg bg-background border border-border">
      <Field label="Title"><Input value={title} onChange={setTitle} placeholder="Pure focus" /></Field>
      <Field label="Hashtags"><Input value={hashtags} onChange={setHashtags} placeholder="business, studio" /></Field>
      <Field label="Song name"><Input value={song} onChange={setSong} placeholder="Track — Artist" /></Field>
      <Field label="Photos (1+)">
        <FilePicker icon={<ImageIcon className="size-4" />} multiple accept="image/*"
          placeholder={images.length === 0 ? "Choose photos…" : `${images.length} photo${images.length === 1 ? "" : "s"}`}
          onChange={setImages} />
      </Field>
      <Field label="Audio (optional)">
        <FilePicker icon={<Music className="size-4" />} accept="audio/*,video/*"
          placeholder={audio ? audio.name : "Choose file…"}
          onChange={(files) => setAudio(files[0] ?? null)} />
      </Field>
      {audio && (
        <AudioTrimmer file={audio} start={audioStart} end={audioEnd}
          onChange={(s, e) => { setAudioStart(s); setAudioEnd(e); }} />
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-brand text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Uploading…" : "Add photo"}
        </button>
        <button onClick={onCancel} disabled={busy}
          className="px-4 inline-flex items-center justify-center gap-1.5 bg-muted text-foreground text-sm font-semibold rounded-lg py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   Shared helpers / inputs
   ========================================================================= */

async function uploadFile(bucket: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function parseTags(raw: string) {
  return raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
  );
}

function FilePicker({ icon, placeholder, accept, multiple, onChange, inputRef }: {
  icon: React.ReactNode; placeholder: string; accept: string; multiple?: boolean;
  onChange: (files: File[]) => void; inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="flex items-center gap-2 bg-background border border-dashed border-border rounded-lg px-3 py-2.5 text-sm cursor-pointer">
      {icon}
      <span className="truncate flex-1">{placeholder}</span>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
    </label>
  );
}