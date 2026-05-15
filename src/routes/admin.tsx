import { useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Image as ImageIcon, Music, Loader2, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  const [image, setImage] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reels"] }),
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
    if (!image || !title.trim()) {
      setMsg("Title and photo are required.");
      return;
    }
    setBusy(true);
    try {
      const image_url = await uploadFile("reel-images", image);
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
        audio_url,
      });
      if (error) throw error;
      setTitle("");
      setHashtags("");
      setSong("");
      setImage(null);
      setAudio(null);
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

          <FilePick
            label="Photo"
            icon={<ImageIcon className="size-4" />}
            file={image}
            accept="image/*"
            onPick={setImage}
            inputRef={imgRef}
          />

          <FilePick
            label="Music (audio file, optional)"
            icon={<Music className="size-4" />}
            file={audio}
            accept="audio/*"
            onPick={setAudio}
            inputRef={audRef}
          />

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
            <div key={r.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-2">
              <img src={r.image_url} alt={r.title} className="size-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.hashtags.join(" ")} {r.song && `· ${r.song}`}
                </p>
              </div>
              <button
                onClick={() => del.mutate(r.id)}
                className="p-2 text-muted-foreground hover:text-destructive"
                aria-label="Delete reel"
              >
                <Trash2 className="size-4" />
              </button>
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