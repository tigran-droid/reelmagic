import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera, Coins, Download, Loader2, Pencil, Check, X,
  ImageIcon, LogIn, Bookmark,
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — Magic Studio" }] }),
  component: AccountPage,
});

type UserImage = {
  id: string;
  image_url: string;
  template_title: string | null;
  created_at: string;
};

type SavedItem = {
  id: string;
  item_id: string;
  source: string;
  title: string | null;
  image_url: string | null;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function AccountPage() {
  const { user, credits, loading } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [tab, setTab] = useState<"creations" | "saved">("creations");

  // profile fields
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // gallery
  const [images, setImages] = useState<UserImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // saved templates
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const avatarPickerRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Signed-URL TTL (1 hour — fresh on every Account page load)
  const SIGN_TTL = 60 * 60;

  // Load profile — avatar_url stores a storage path; sign it on read.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!data) return;
      setDisplayName(data.display_name ?? "");
      if (data.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(data.avatar_url, SIGN_TTL);
        setAvatarUrl(signed?.signedUrl ?? null);
      } else {
        setAvatarUrl(null);
      }
    })();
  }, [user]);

  // Load generated images — image_url stores a storage path; batch-sign on read.
  useEffect(() => {
    if (!user) return;
    setLoadingImages(true);
    (async () => {
      const { data } = await supabase
        .from("user_images")
        .select("id, image_url, template_title, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      if (rows.length === 0) {
        setImages([]);
        setLoadingImages(false);
        return;
      }
      const paths = rows.map((r) => r.image_url);
      const { data: signed } = await supabase.storage
        .from("user-images")
        .createSignedUrls(paths, SIGN_TTL);
      const byPath = new Map<string, string>();
      signed?.forEach((s, i) => {
        if (s.signedUrl) byPath.set(paths[i], s.signedUrl);
      });
      setImages(
        rows.map((r) => ({
          id: r.id,
          template_title: r.template_title,
          created_at: r.created_at,
          image_url: byPath.get(r.image_url) ?? "",
        })),
      );
      setLoadingImages(false);
    })();
  }, [user]);

  // Load saved templates — covers are public urls, no signing needed. The
  // table may not exist yet (migration pending); fall back to empty quietly.
  useEffect(() => {
    if (!user) return;
    setLoadingSaved(true);
    (async () => {
      const { data, error } = await supabase
        .from("saved_items")
        .select("id, item_id, source, title, image_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setSaved(error ? [] : (data ?? []));
      setLoadingSaved(false);
    })();
  }, [user]);

  const unsave = async (row: SavedItem) => {
    setSaved((s) => s.filter((x) => x.id !== row.id));
    await supabase.from("saved_items").delete().eq("id", row.id);
  };

  // ── avatar upload ──
  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, SIGN_TTL);
      setAvatarUrl(signed?.signedUrl ?? null);
    } catch (err) {
      console.error("Avatar upload failed", err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── save display name ──
  const saveName = async () => {
    if (!user) return;
    setSavingName(true);
    await supabase
      .from("profiles")
      .update({ display_name: nameDraft.trim() })
      .eq("id", user.id);
    setDisplayName(nameDraft.trim());
    setEditingName(false);
    setSavingName(false);
  };

  const startEditName = () => {
    setNameDraft(displayName || user?.email?.split("@")[0] || "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 30);
  };

  if (loading) {
    return (
      <MobileFrame>
        <div className="flex-1 grid place-items-center py-32">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </MobileFrame>
    );
  }

  if (!user) {
    return (
      <MobileFrame>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-20">
          <div className="size-16 rounded-full bg-secondary grid place-items-center">
            <LogIn className="size-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-bold text-base mb-1">Sign in to see your account</p>
            <p className="text-sm text-muted-foreground">Your profile and generated images will appear here.</p>
          </div>
          <button
            onClick={() => setShowAuth(true)}
            className="px-8 py-3 rounded-2xl bg-brand text-white font-bold text-sm"
          >
            Sign in
          </button>
          {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </div>
      </MobileFrame>
    );
  }

  const shortName = displayName || user.email?.split("@")[0] || "User";
  const initials = shortName.slice(0, 2).toUpperCase();

  return (
    <MobileFrame>
      <div className="px-5 pt-8 pb-28 md:pb-8 max-w-[640px] mx-auto w-full">

        {/* ── Header: avatar + name + email ── */}
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="size-[60px] rounded-full overflow-hidden bg-brand/20 flex items-center justify-center ring-1 ring-black/5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-extrabold text-brand">{initials}</span>
              )}
            </div>
            <button
              onClick={() => avatarPickerRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full bg-foreground text-background flex items-center justify-center shadow-md ring-2 ring-background"
              aria-label="Change photo"
            >
              {uploadingAvatar
                ? <Loader2 className="size-3 animate-spin" />
                : <Camera className="size-3" />
              }
            </button>
            <input ref={avatarPickerRef} type="file" accept="image/*" onChange={onAvatarPick} className="hidden" />
          </div>

          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  className="flex-1 bg-background border border-brand/60 rounded-lg px-2.5 py-1.5 text-lg font-extrabold focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <button onClick={saveName} disabled={savingName} className="size-7 grid place-items-center rounded-lg bg-brand text-white disabled:opacity-60">
                  {savingName ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                </button>
                <button onClick={() => setEditingName(false)} className="size-7 grid place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={startEditName} className="flex items-center gap-1.5 group">
                <span className="text-2xl font-extrabold tracking-tight truncate">{shortName}</span>
                <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <p className="text-[13px] text-muted-foreground truncate mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* ── Dark credits card ── */}
        <div className="mt-5 rounded-2xl bg-[#171717] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-white/45 uppercase">Your credits</p>
            <p className="text-[34px] leading-none font-extrabold tabular-nums mt-1.5">{credits}</p>
          </div>
          <Link
            to="/pricing"
            className="flex items-center gap-1.5 pl-3 pr-4 py-2 rounded-full bg-white text-black text-[13px] font-bold active:scale-95 transition-transform"
          >
            <Coins className="size-4 text-amber-500" />
            Get more
          </Link>
        </div>

        {/* ── Info pill ── */}
        <div className="mt-2.5 rounded-2xl bg-secondary px-4 py-3 flex items-center gap-2.5 text-[13px]">
          <span className="size-2 rounded-full bg-foreground shrink-0" />
          <span className="text-muted-foreground">1 photo = <strong className="text-foreground font-bold">3 credits</strong></span>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex bg-secondary rounded-full p-1">
            <button
              onClick={() => setTab("creations")}
              className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                tab === "creations" ? "bg-background text-brand shadow-sm" : "text-muted-foreground"
              }`}
            >
              Your creations
            </button>
            <button
              onClick={() => setTab("saved")}
              className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                tab === "saved" ? "bg-background text-brand shadow-sm" : "text-muted-foreground"
              }`}
            >
              Saved
            </button>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-brand/10 text-brand text-[12px] font-bold tabular-nums whitespace-nowrap">
            {tab === "creations" ? `${images.length} items` : `${saved.length} saved`}
          </span>
        </div>

        {/* ── Grid ── */}
        <div className="mt-4">
          {tab === "creations" ? (
            loadingImages ? (
              <div className="grid place-items-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : images.length === 0 ? (
              <EmptyState
                title="No photos yet"
                body="Generate your first photo from the Photoshop tab — it will appear here."
                ctaTo="/photoshop"
                ctaLabel="Create a photo"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {images.map((img) => (
                  <ImageCard key={img.id} img={img} />
                ))}
              </div>
            )
          ) : (
            loadingSaved ? (
              <div className="grid place-items-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : saved.length === 0 ? (
              <EmptyState
                title="Nothing saved yet"
                body="Tap the bookmark on any template in the feed to save it here for later."
                ctaTo="/photoshop"
                ctaLabel="Browse templates"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {saved.map((row) => (
                  <SavedCard
                    key={row.id}
                    row={row}
                    onOpen={() =>
                      navigate({
                        to: "/photoshop/feed",
                        search: { item: row.item_id, from: row.source === "reel" ? "local" : undefined },
                      })
                    }
                    onRemove={() => unsave(row)}
                  />
                ))}
              </div>
            )
          )}
        </div>

      </div>
    </MobileFrame>
  );
}

function EmptyState({ title, body, ctaTo, ctaLabel }: { title: string; body: string; ctaTo: string; ctaLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
        <ImageIcon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[240px]">{body}</p>
      <Link to={ctaTo} className="mt-1 px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-bold">
        {ctaLabel}
      </Link>
    </div>
  );
}

function SavedCard({ row, onOpen, onRemove }: { row: SavedItem; onOpen: () => void; onRemove: () => void }) {
  return (
    <button onClick={onOpen} className="relative rounded-2xl overflow-hidden bg-secondary aspect-[3/4] text-left active:scale-[0.98] transition-transform">
      {row.image_url ? (
        <img src={row.image_url} alt={row.title ?? "Saved template"} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <ImageIcon className="size-6 text-muted-foreground" />
        </div>
      )}
      <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
        Template
      </span>
      <span
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-2 right-2 size-7 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center"
        aria-label="Remove from saved"
      >
        <Bookmark className="size-3.5" fill="currentColor" />
      </span>
    </button>
  );
}

function ImageCard({ img }: { img: UserImage }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(img.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `magic-studio-${img.id.slice(0, 8)}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-secondary aspect-[3/4] group">
      <img
        src={img.image_url}
        alt={img.template_title ?? "Generated photo"}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
        {img.template_title && (
          <span className="text-white text-[10px] font-bold leading-tight max-w-[70%] truncate">
            {img.template_title}
          </span>
        )}
        <button
          onClick={download}
          disabled={downloading}
          className="ml-auto size-8 rounded-full bg-white/90 text-black flex items-center justify-center shadow"
        >
          {downloading
            ? <Loader2 className="size-3.5 animate-spin" />
            : <Download className="size-3.5" />
          }
        </button>
      </div>
    </div>
  );
}
