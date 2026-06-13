import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera, Coins, Download, Loader2, Pencil, Check, X,
  ImageIcon, Sparkles, LogIn,
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
  const { user, credits, loading, refreshProfile } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

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

  const avatarPickerRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Load profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDisplayName(data.display_name ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      });
  }, [user]);

  // Load generated images
  useEffect(() => {
    if (!user) return;
    setLoadingImages(true);
    supabase
      .from("user_images")
      .select("id, image_url, template_title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setImages((data as UserImage[]) ?? []);
        setLoadingImages(false);
      });
  }, [user]);

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
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setAvatarUrl(url);
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
      <div className="px-5 pt-8 pb-28 md:pb-8 space-y-6">

        {/* ── Profile card ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="size-18 rounded-full overflow-hidden bg-brand/20 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-extrabold text-brand">{initials}</span>
                )}
              </div>
              <button
                onClick={() => avatarPickerRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 size-7 rounded-full bg-brand text-white flex items-center justify-center shadow-md border-2 border-background"
              >
                {uploadingAvatar
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Camera className="size-3.5" />
                }
              </button>
              <input ref={avatarPickerRef} type="file" accept="image/*" onChange={onAvatarPick} className="hidden" />
            </div>

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={nameInputRef}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="flex-1 bg-background border border-brand/60 rounded-lg px-2.5 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-brand"
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
                  <span className="text-base font-bold truncate">{shortName}</span>
                  <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
            </div>
          </div>
        </div>

        {/* ── Credits card ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Coins className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credits remaining</p>
                <p className="text-2xl font-extrabold tabular-nums">{credits}</p>
              </div>
            </div>
            <Link
              to="/pricing"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold shadow-sm shadow-brand/30"
            >
              <Sparkles className="size-3.5" />
              Get more
            </Link>
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-brand" />
              <span>1 photo = <strong className="text-foreground">3 credits</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-violet-500" />
              <span>1 video = <strong className="text-foreground">20 credits</strong></span>
            </div>
          </div>
        </div>

        {/* ── Generated images gallery ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold">Your creations</h2>
            <span className="text-xs text-muted-foreground">{images.length} photos</span>
          </div>

          {loadingImages && (
            <div className="grid place-items-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingImages && images.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
                <ImageIcon className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">No photos yet</p>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                Generate your first photo from the Photoshop tab — it will appear here.
              </p>
              <Link
                to="/photoshop"
                className="mt-1 px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-bold"
              >
                Create a photo
              </Link>
            </div>
          )}

          {!loadingImages && images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {images.map((img) => (
                <ImageCard key={img.id} img={img} />
              ))}
            </div>
          )}
        </div>

      </div>
    </MobileFrame>
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
    <div className="relative rounded-xl overflow-hidden bg-secondary aspect-[3/4] group">
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
