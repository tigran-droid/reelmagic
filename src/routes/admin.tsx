import { useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Image as ImageIcon, Music, Loader2, Trash2, Pencil, X, Check, Plus, ArrowUp, ArrowDown, Video as VideoIcon, FileText, Search, Coins } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AudioTrimmer } from "@/components/AudioTrimmer";
import { useAuth } from "@/lib/auth-context";

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
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"reels" | "photoshop" | "videos" | "users">("reels");
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
          {(["reels", "photoshop", "videos", "users"] as const).map((t) => (
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

        {tab === "reels" && <ReelsAdmin />}
        {tab === "photoshop" && <PhotoshopAdmin />}
        {tab === "videos" && <VideosAdmin />}
        {tab === "users" && <UsersAdmin isAdmin={isAdmin} />}
      </div>
    </div>
  );
}

/* =========================================================================
   USERS ADMIN — list users, search, grant credits
   ========================================================================= */

type ProfileRow = {
  id: string;
  email: string | null;
  credits: number;
  is_admin: boolean;
  created_at: string;
};

function UsersAdmin({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, credits, is_admin, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProfileRow[];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">
          You need to be signed in as an admin to manage users.
        </p>
      </div>
    );
  }

  const users = usersQ.data ?? [];
  const filtered = search.trim()
    ? users.filter((u) => (u.email ?? "").toLowerCase().includes(search.trim().toLowerCase()))
    : users;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{users.length}</span> total account{users.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {usersQ.isPending && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {usersQ.error && (
        <p className="text-sm text-destructive">
          Could not load users. Make sure you ran SETUP_CREDITS.sql in Supabase.
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((u) => (
          <UserRow key={u.id} user={u} onGranted={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
        ))}
        {usersQ.data && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No users match “{search}”.</p>
        )}
      </div>
    </div>
  );
}

function UserRow({ user, onGranted }: { user: ProfileRow; onGranted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState(String(user.credits));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openEdit = () => {
    setNewValue(String(user.credits));
    setMsg(null);
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 30);
  };

  const cancel = () => { setEditing(false); setMsg(null); };

  const save = async () => {
    const target = parseInt(newValue, 10);
    if (!user.email || !Number.isFinite(target) || target < 0) return;
    const delta = target - user.credits;
    if (delta === 0) { setEditing(false); return; }
    setBusy(true);
    setMsg(null);
    setIsError(false);
    const { data, error } = await supabase.rpc("admin_add_credits", {
      p_email: user.email,
      p_amount: delta,
    });
    setBusy(false);
    if (error) { setMsg(error.message); setIsError(true); return; }
    setMsg(`Saved: ${data} credits`);
    setEditing(false);
    onGranted();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{user.email ?? "(no email)"}</p>
            {user.is_admin && (
              <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand/20 text-brand">
                Admin
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Joined {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Credits badge — click to edit */}
        {!editing ? (
          <button
            onClick={openEdit}
            title="Click to change credits"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border hover:border-amber-500/60 hover:bg-amber-500/5 transition-colors group"
          >
            <Coins className="size-3.5 text-amber-500" />
            <span className="text-sm font-bold tabular-nums">{user.credits}</span>
            <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <Coins className="size-3.5 text-amber-500 shrink-0" />
            <input
              ref={inputRef}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              className="w-20 bg-background border border-amber-500/60 rounded-lg px-2 py-1 text-sm text-center tabular-nums font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
              inputMode="numeric"
            />
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1 bg-brand text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Set
            </button>
            <button onClick={cancel} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {msg && (
        <p className={`text-[11px] mt-2 ${isError ? "text-red-400" : "text-green-400"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}

function PhotoRow({
  it, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onDelete, onChange,
}: {
  it: PhotoshopItem;
  canMoveUp: boolean; canMoveDown: boolean;
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(it.prompt ?? DEFAULT_PHOTOSHOP_PROMPT);
  const [keepOutfit, setKeepOutfit] = useState(it.keep_template_outfit ?? false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("photoshop_items")
      .update({ prompt: draft.trim() || null, keep_template_outfit: keepOutfit })
      .eq("id", it.id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setEditing(false);
    onChange();
  };

  const isCustom = !!(it.prompt && it.prompt.trim());

  return (
    <div className="rounded-lg bg-background border border-border">
      <div className="flex items-center gap-2 p-1.5">
        <img src={it.image_url} alt={it.title} className="size-10 rounded object-cover" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{it.title}</p>
          <p className="text-[10px] text-muted-foreground truncate">{it.hashtags.join(" ")} {it.song && `· ${it.song}`}</p>
        </div>
        <button
          onClick={() => { setDraft(it.prompt ?? DEFAULT_PHOTOSHOP_PROMPT); setEditing((v) => !v); }}
          className={`p-1.5 ${isCustom ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}
          aria-label="Edit prompt"
          title={isCustom ? "Custom prompt" : "Default prompt"}
        >
          <FileText className="size-3.5" />
        </button>
        <button onClick={onMoveUp} disabled={!canMoveUp}
          className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move up">
          <ArrowUp className="size-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={!canMoveDown}
          className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move down">
          <ArrowDown className="size-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete photo">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {editing && (
        <div className="border-t border-border p-2 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            AI prompt used when a user recreates this template. Leave as default for face replacement; customize per item (e.g. swap whole body, swap outfit only).
          </p>

          {/* Outfit mode — admin only. Controls whether the user's own clothes
              are copied, or only the face is swapped onto the template. */}
          <div className="rounded-lg border border-border p-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-foreground">Outfit mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setKeepOutfit(false)}
                className={`rounded-md px-2 py-1.5 text-[11px] font-semibold border ${
                  !keepOutfit
                    ? "bg-brand text-white border-brand"
                    : "bg-background text-muted-foreground border-border"
                }`}
              >
                Face + body/clothes
              </button>
              <button
                type="button"
                onClick={() => setKeepOutfit(true)}
                className={`rounded-md px-2 py-1.5 text-[11px] font-semibold border ${
                  keepOutfit
                    ? "bg-brand text-white border-brand"
                    : "bg-background text-muted-foreground border-border"
                }`}
              >
                Face only
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground">
              {keepOutfit
                ? "Only the face is swapped; the template's outfit is kept."
                : "Default — the user's own clothes are copied onto the template."}
            </p>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-[11px] font-mono leading-relaxed"
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1 bg-brand text-white text-xs font-semibold rounded-md py-1.5 disabled:opacity-60">
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              {saving ? "Saving…" : "Save prompt"}
            </button>
            <button onClick={() => setDraft(DEFAULT_PHOTOSHOP_PROMPT)} disabled={saving}
              className="px-2 text-xs font-semibold rounded-md bg-muted text-foreground">
              Reset
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}
              className="px-2 text-xs font-semibold rounded-md bg-muted text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}
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
  prompt: string | null;
  keep_template_outfit: boolean;
};

/** Default prompt. Outfit behavior is controlled by the user's outfit-mode toggle — do not mention wardrobe here. */
export const DEFAULT_PHOTOSHOP_PROMPT = [
  "Place the user (from Image 2 and Image 3) into the scene from Image 1.",
  "Keep the template's composition, framing, camera angle, lighting, color grading, background, and body pose exactly as shown.",
  "The user's face and hair MUST replace the template person's face — preserve the user's exact facial identity, skin tone, and distinctive features.",
  "Keep the result photorealistic, sharp, and consistent with the template's camera and lens style.",
  "Return exactly ONE final edited image.",
].join("\n");

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

  const sorted = [...items].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

  const moveItem = async (index: number, dir: -1 | 1) => {
    const target = sorted[index];
    const neighbor = sorted[index + dir];
    if (!target || !neighbor) return;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("photoshop_items").update({ position: neighbor.position }).eq("id", target.id),
      supabase.from("photoshop_items").update({ position: target.position }).eq("id", neighbor.id),
    ]);
    if (e1 || e2) { alert((e1 ?? e2)!.message); return; }
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
        {sorted.map((it, idx) => (
          <PhotoRow
            key={it.id}
            it={it}
            canMoveUp={idx !== 0}
            canMoveDown={idx !== sorted.length - 1}
            onMoveUp={() => moveItem(idx, -1)}
            onMoveDown={() => moveItem(idx, 1)}
            onDelete={() => deleteItem(it.id)}
            onChange={onChange}
          />
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
  const [prompt, setPrompt] = useState(DEFAULT_PHOTOSHOP_PROMPT);
  const [keepOutfit, setKeepOutfit] = useState(false);
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
        prompt: prompt.trim() || null,
        keep_template_outfit: keepOutfit,
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
      <Field label="What changes for the user">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setKeepOutfit(false)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold border ${
              !keepOutfit
                ? "bg-brand text-white border-brand"
                : "bg-background text-muted-foreground border-border"
            }`}
          >
            Face + body
          </button>
          <button
            type="button"
            onClick={() => setKeepOutfit(true)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold border ${
              keepOutfit
                ? "bg-brand text-white border-brand"
                : "bg-background text-muted-foreground border-border"
            }`}
          >
            Face only
          </button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {keepOutfit
            ? "Only the face is swapped — the template's body & clothes are kept."
            : "Default — the face, body and clothes all become the user's."}
        </p>
      </Field>
      <Field label="AI prompt (used when a user recreates this template)">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono leading-relaxed"
        />
        <button
          type="button"
          onClick={() => setPrompt(DEFAULT_PHOTOSHOP_PROMPT)}
          className="mt-1 text-[10px] text-muted-foreground hover:text-foreground underline"
        >
          Reset to default
        </button>
      </Field>
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

/* =========================================================================
   VIDEOS ADMIN — list managed videos shown on the home Videos section
   ========================================================================= */

type VideoItem = {
  id: string;
  title: string;
  hashtags: string[];
  song: string | null;
  cover_image_url: string;
  sample_video_url: string | null;
  prompt: string;
  position: number;
  created_at: string;
};

function VideosAdmin() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const q = useQuery({
    queryKey: ["admin-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_items")
        .select("*")
        .order("position")
        .order("created_at");
      if (error) throw error;
      return data as VideoItem[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-videos"] });
    qc.invalidateQueries({ queryKey: ["home-videos"] });
  };

  const sorted = [...(q.data ?? [])].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  );

  const moveItem = async (index: number, dir: -1 | 1) => {
    const target = sorted[index];
    const neighbor = sorted[index + dir];
    if (!target || !neighbor) return;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("video_items").update({ position: neighbor.position }).eq("id", target.id),
      supabase.from("video_items").update({ position: target.position }).eq("id", neighbor.id),
    ]);
    if (e1 || e2) { alert((e1 ?? e2)!.message); return; }
    invalidateAll();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this video?")) return;
    const { error } = await supabase.from("video_items").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    invalidateAll();
  };

  return (
    <div className="space-y-5">
      {showAdd ? (
        <AddVideoForm
          existingCount={sorted.length}
          onDone={() => { setShowAdd(false); invalidateAll(); }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full inline-flex items-center justify-center gap-2 bg-brand text-white font-semibold rounded-lg py-2.5 text-sm">
          <Plus className="size-4" />Add video
        </button>
      )}

      <div className="space-y-2">
        {sorted.map((it, idx) => (
          <div key={it.id} className="bg-card border border-border rounded-xl p-2">
            <div className="flex items-center gap-3">
              <div className="relative size-14 shrink-0">
                <img src={it.cover_image_url} alt={it.title} className="size-14 rounded-lg object-cover" />
                {it.sample_video_url && (
                  <span className="absolute bottom-0.5 right-0.5 bg-black/70 rounded p-0.5">
                    <VideoIcon className="size-2.5 text-white" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{it.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {it.hashtags.join(" ")} {it.song && `· ${it.song}`}
                </p>
                <p className="text-[10px] text-muted-foreground/70 truncate flex items-center gap-1 mt-0.5">
                  <FileText className="size-2.5" /> {it.prompt}
                </p>
              </div>
              <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="size-3.5" />
              </button>
              <button onClick={() => moveItem(idx, 1)} disabled={idx === sorted.length - 1}
                className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="size-3.5" />
              </button>
              <button onClick={() => deleteItem(it.id)}
                className="p-2 text-muted-foreground hover:text-destructive" aria-label="Delete">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">No videos yet.</p>
        )}
      </div>
    </div>
  );
}

function AddVideoForm({ existingCount, onDone, onCancel }: {
  existingCount: number; onDone: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [song, setSong] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [sample, setSample] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !cover || !prompt.trim()) {
      alert("Title, cover photo and prompt are required.");
      return;
    }
    setBusy(true);
    try {
      const cover_image_url = await uploadFile("reel-images", cover);
      const sample_video_url = sample ? await uploadFile("video-files", sample) : null;
      const { error } = await supabase.from("video_items").insert({
        title: title.trim(),
        hashtags: parseTags(hashtags),
        song: song.trim() || null,
        cover_image_url,
        sample_video_url,
        prompt: prompt.trim(),
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
    <div className="space-y-3 p-4 rounded-2xl bg-card border border-border">
      <h3 className="font-semibold">Add video</h3>
      <Field label="Title"><Input value={title} onChange={setTitle} placeholder="Cinematic ride" /></Field>
      <Field label="Hashtags"><Input value={hashtags} onChange={setHashtags} placeholder="travel, cinematic" /></Field>
      <Field label="Song name"><Input value={song} onChange={setSong} placeholder="Track — Artist" /></Field>
      <Field label="Cover photo (used as visual reference)">
        <FilePicker icon={<ImageIcon className="size-4" />} accept="image/*"
          placeholder={cover ? cover.name : "Choose cover photo…"}
          onChange={(files) => setCover(files[0] ?? null)} />
      </Field>
      <Field label="Sample video (preview shown to users)">
        <FilePicker icon={<VideoIcon className="size-4" />} accept="video/*"
          placeholder={sample ? sample.name : "Choose sample .mp4…"}
          onChange={(files) => setSample(files[0] ?? null)} />
      </Field>
      <Field label="AI prompt (used to generate user video)">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic 8 second handheld shot of the subject walking through neon-lit streets at night, soft rain, film grain…"
          rows={4}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
      </Field>
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-brand text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Uploading…" : "Add video"}
        </button>
        <button onClick={onCancel} disabled={busy}
          className="px-4 inline-flex items-center justify-center gap-1.5 bg-muted text-foreground text-sm font-semibold rounded-lg py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}