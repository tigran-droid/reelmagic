import { useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Image as ImageIcon, Music, Loader2, Trash2, Pencil, X, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AudioTrimmer } from "@/components/AudioTrimmer";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Add Reel" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Admin,
});

function Admin() {
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
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
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

  async function uploadFile(bucket: string, file: File) {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (images.length === 0 || !title.trim()) {
      setMsg("Title and at least one photo are required.");
      return;
    }
    setBusy(true);
    try {
      const image_urls = await Promise.all(
        images.map((f) => uploadFile("reel-images", f)),
      );
      const image_url = image_urls[0];
      const audio_url = audio ? await uploadFile("reel-audio", audio) : null;
      const tags = hashtags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));
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
      setTitle("");
      setHashtags("");
      setSong("");
      setImages([]);
      setAudio(null);
      setAudioStart(0);
      setAudioEnd(null);
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
    id: string;
    title: string;
    hashtags: string[];
    song: string | null;
    image_url: string;
    image_urls: string[];
    audio_url: string | null;
    audio_start_sec: number | null;
    audio_end_sec: number | null;
  };

  function startEdit(r: ReelRow) {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditHashtags(r.hashtags.join(" "));
    setEditSong(r.song ?? "");
    setEditImages([]);
    setEditAudio(null);
    setEditAudioStart(Number(r.audio_start_sec ?? 0));
    setEditAudioEnd(r.audio_end_sec != null ? Number(r.audio_end_sec) : null);
    setEditKeepAudio(
      r.audio_url
        ? {
            url: r.audio_url,
            start: Number(r.audio_start_sec ?? 0),
            end: r.audio_end_sec != null ? Number(r.audio_end_sec) : null,
          }
        : null,
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setEditImages([]);
    setEditAudio(null);
    setEditKeepAudio(null);
  }

  async function saveEdit(id: string) {
    setEditBusy(true);
    try {
      const tags = editHashtags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));
      const update: {
        title: string;
        hashtags: string[];
        song: string | null;
        image_urls?: string[];
        image_url?: string;
        audio_url?: string;
        audio_start_sec?: number;
        audio_end_sec?: number | null;
      } = {
        title: editTitle.trim(),
        hashtags: tags,
        song: editSong.trim() || null,
        audio_start_sec: editAudioStart,
        audio_end_sec: editAudioEnd,
      };
      if (editImages.length > 0) {
        const image_urls = await Promise.all(
          editImages.map((f) => uploadFile("reel-images", f)),
        );
        update.image_urls = image_urls;
        update.image_url = image_urls[0];
      }
      if (editAudio) {
        update.audio_url = await uploadFile("reel-audio", editAudio);
      }
      const { error } = await supabase.from("reels").update(update).eq("id", id);
      if (error) throw error;
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["admin-reels"] });
      qc.invalidateQueries({ queryKey: ["feed-reels"] });
    } catch (err: unknown) {
      const e = err as { message?: string };
      alert(`Error: ${e.message ?? "update failed"}`);
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin · Add Reel</h1>
          <Link to="/feed" className="text-sm text-brand">View feed →</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-2xl p-5">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Neon city nights"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Hashtags (comma or space separated)">
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="cinematic, neon, aiart"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Song name (label shown on reel)">
            <input
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder="Stardust — Luna"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Photos (pick one or more — swipeable in the reel)">
            <label className="flex items-center gap-2 bg-background border border-dashed border-border rounded-lg px-3 py-3 text-sm cursor-pointer">
              <ImageIcon className="size-4" />
              <span className="truncate flex-1">
                {images.length === 0
                  ? "Choose photos…"
                  : `${images.length} photo${images.length === 1 ? "" : "s"} selected`}
              </span>
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setImages(Array.from(e.target.files ?? []))}
              />
            </label>
            {images.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {images.map((f, i) => (
                  <div key={i} className="relative shrink-0">
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="size-16 rounded-lg object-cover border border-border"
                    />
                    <span className="absolute -top-1 -left-1 bg-brand text-white text-[10px] font-bold rounded-full size-4 flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <FilePick
            label="Music (audio or video file — only audio track is used)"
            icon={<Music className="size-4" />}
            file={audio}
            accept="audio/*,video/*"
            onPick={setAudio}
            inputRef={audRef}
          />

          {audio && (
            <AudioTrimmer
              file={audio}
              start={audioStart}
              end={audioEnd}
              onChange={(s: number, e: number | null) => {
                setAudioStart(s);
                setAudioEnd(e);
              }}
            />
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand text-white font-semibold rounded-lg py-2.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? "Uploading…" : "Publish reel"}
          </button>

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </form>

        <h2 className="text-lg font-semibold mt-10 mb-3">Existing reels</h2>
        <div className="space-y-2">
          {reels.data?.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-2">
              {editingId === r.id ? (
                <div className="space-y-2 p-2">
                  <Field label="Title">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Hashtags">
                    <input
                      value={editHashtags}
                      onChange={(e) => setEditHashtags(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Song">
                    <input
                      value={editSong}
                      onChange={(e) => setEditSong(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Replace photos (optional — leave empty to keep current)">
                    <label className="flex items-center gap-2 bg-background border border-dashed border-border rounded-lg px-3 py-2 text-sm cursor-pointer">
                      <ImageIcon className="size-4" />
                      <span className="truncate flex-1">
                        {editImages.length === 0
                          ? "Keep current photos"
                          : `${editImages.length} new photo${editImages.length === 1 ? "" : "s"}`}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => setEditImages(Array.from(e.target.files ?? []))}
                      />
                    </label>
                  </Field>
                  <Field label="Replace music (optional)">
                    <label className="flex items-center gap-2 bg-background border border-dashed border-border rounded-lg px-3 py-2 text-sm cursor-pointer">
                      <Music className="size-4" />
                      <span className="truncate flex-1">
                        {editAudio ? editAudio.name : "Keep current music"}
                      </span>
                      <input
                        type="file"
                        accept="audio/*,video/*"
                        className="hidden"
                        onChange={(e) => setEditAudio(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </Field>
                  {editAudio ? (
                    <AudioTrimmer
                      file={editAudio}
                      start={editAudioStart}
                      end={editAudioEnd}
                      onChange={(s: number, e: number | null) => {
                        setEditAudioStart(s);
                        setEditAudioEnd(e);
                      }}
                    />
                  ) : editKeepAudio ? (
                    <AudioTrimmer
                      url={editKeepAudio.url}
                      start={editAudioStart}
                      end={editAudioEnd}
                      onChange={(s: number, e: number | null) => {
                        setEditAudioStart(s);
                        setEditAudioEnd(e);
                      }}
                    />
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(r.id)}
                      disabled={editBusy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-brand text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-60"
                    >
                      {editBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={editBusy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-muted text-foreground text-sm font-semibold rounded-lg py-2"
                    >
                      <X className="size-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <img src={r.image_url} alt={r.title} className="size-14 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.hashtags.join(" ")} {r.song && `· ${r.song}`}
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(r as ReelRow)}
                    className="p-2 text-muted-foreground hover:text-foreground"
                    aria-label="Edit reel"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => del.mutate(r.id)}
                    className="p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Delete reel"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {reels.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No reels yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function FilePick({
  label,
  icon,
  file,
  accept,
  onPick,
  inputRef,
}: {
  label: string;
  icon: React.ReactNode;
  file: File | null;
  accept: string;
  onPick: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <Field label={label}>
      <label className="flex items-center gap-2 bg-background border border-dashed border-border rounded-lg px-3 py-3 text-sm cursor-pointer">
        {icon}
        <span className="truncate flex-1">{file ? file.name : "Choose file…"}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>
    </Field>
  );
}