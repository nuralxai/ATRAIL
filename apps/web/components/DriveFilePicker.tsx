"use client";

import { useState, useEffect, useCallback } from "react";
import { authedFetch } from "../lib/authed-fetch";
import { HardDrive, Search, Folder, FileText, X, ExternalLink, Copy, Check, ChevronLeft, Loader2 } from "lucide-react";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  iconUrl: string | null;
  viewLink: string | null;
  size: string | null;
  modifiedAt: string | null;
  isFolder: boolean;
};

type Props = {
  /** Called when user picks a file and gets a shareable link */
  onSelect: (file: { name: string; shareLink: string; mimeType: string }) => void;
  /** Optional: show as inline panel rather than modal */
  inline?: boolean;
  onClose?: () => void;
};

function formatSize(bytes: string | null) {
  if (!bytes) return "";
  const n = parseInt(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function getMimeIcon(mimeType: string) {
  if (mimeType.includes("folder")) return "📁";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📊";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("video")) return "🎬";
  if (mimeType.includes("audio")) return "🎵";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "🗜️";
  return "📎";
}

export default function DriveFilePicker({ onSelect, inline = false, onClose }: Props) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : undefined;

  const loadFiles = useCallback(async (folderId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch<{ ok: boolean; files: DriveFile[]; message?: string }>(
        `/integrations/drive/files${folderId ? `?folderId=${folderId}` : ""}`
      );
      if (!res.ok) {
        if (res.message?.includes("No Google account")) {
          setNoAccount(true);
        } else {
          setError(res.message || "Failed to load Drive files");
        }
      } else {
        setFiles(res.files);
        setNoAccount(false);
      }
    } catch (e: any) {
      if (e.message?.includes("No Google account")) {
        setNoAccount(true);
      } else {
        setError(e.message || "Failed to load Drive files");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles(currentFolderId);
  }, [currentFolderId, loadFiles]);

  const handleSearch = async () => {
    if (!search.trim()) {
      loadFiles(currentFolderId);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await authedFetch<{ ok: boolean; files: DriveFile[] }>(
        `/integrations/drive/search?q=${encodeURIComponent(search.trim())}`
      );
      if (res.ok) setFiles(res.files);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleOpenFolder = (file: DriveFile) => {
    setFolderStack((prev) => [...prev, { id: file.id, name: file.name }]);
    setSearch("");
  };

  const handleBack = () => {
    setFolderStack((prev) => prev.slice(0, -1));
    setSearch("");
  };

  const handlePickFile = async (file: DriveFile) => {
    if (file.isFolder) {
      handleOpenFolder(file);
      return;
    }
    setSharingId(file.id);
    try {
      const res = await authedFetch<{ ok: boolean; name: string; shareLink: string; mimeType: string }>(
        `/integrations/drive/share/${file.id}`,
        { method: "POST" }
      );
      if (res.ok && res.shareLink) {
        onSelect({ name: res.name, shareLink: res.shareLink, mimeType: res.mimeType });
        onClose?.();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSharingId(null);
    }
  };

  const handleCopyLink = async (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setSharingId(file.id);
    try {
      const res = await authedFetch<{ ok: boolean; shareLink: string }>(
        `/integrations/drive/share/${file.id}`,
        { method: "POST" }
      );
      if (res.ok && res.shareLink) {
        await navigator.clipboard.writeText(res.shareLink);
        setCopiedId(file.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSharingId(null);
    }
  };

  const content = (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#0f172a", borderRadius: inline ? "16px" : "0",
      border: inline ? "1px solid rgba(56,189,248,0.15)" : "none",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", background: "rgba(14,165,233,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <HardDrive size={18} style={{ color: "#38bdf8" }} />
        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.9rem" }}>
          My Google Drive
        </span>
        {onClose && (
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "none", border: "none",
            cursor: "pointer", color: "#64748b", padding: "4px",
          }}>
            <X size={16} />
          </button>
        )}
      </div>

      {noAccount ? (
        <div style={{ padding: "32px 24px", textAlign: "center" }}>
          <HardDrive size={40} style={{ color: "#334155", margin: "0 auto 12px" }} />
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "16px" }}>
            Connect your Google Drive to browse and share files without leaving ATRAIL.
          </p>
          <a
            href="/settings"
            style={{
              display: "inline-block", padding: "10px 20px", borderRadius: "10px",
              background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
              color: "white", fontWeight: 700, fontSize: "0.85rem",
              textDecoration: "none",
            }}
          >
            Connect Google in Settings →
          </a>
        </div>
      ) : (
        <>
          {/* Breadcrumb + Search */}
          <div style={{ padding: "12px 16px", display: "flex", gap: "8px", alignItems: "center" }}>
            {folderStack.length > 0 && (
              <button onClick={handleBack} style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px", padding: "6px 8px", cursor: "pointer", color: "#94a3b8",
                display: "flex", alignItems: "center",
              }}>
                <ChevronLeft size={14} />
              </button>
            )}
            <div style={{ flex: 1, display: "flex", gap: "6px" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search your Drive…"
                style={{
                  flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px", padding: "7px 12px", color: "#e2e8f0", fontSize: "0.83rem", outline: "none",
                }}
              />
              <button onClick={handleSearch} disabled={searching} style={{
                background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: "8px", padding: "7px 10px", cursor: "pointer", color: "#38bdf8",
                display: "flex", alignItems: "center",
              }}>
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </div>
          </div>

          {/* Breadcrumb path */}
          {folderStack.length > 0 && (
            <div style={{ padding: "0 16px 8px", display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", color: "#475569", cursor: "pointer" }} onClick={() => setFolderStack([])}>
                My Drive
              </span>
              {folderStack.map((f, i) => (
                <span key={f.id} style={{ fontSize: "0.72rem", color: i === folderStack.length - 1 ? "#38bdf8" : "#475569", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: "#334155" }}>/</span>
                  <span
                    style={{ cursor: i < folderStack.length - 1 ? "pointer" : "default" }}
                    onClick={() => i < folderStack.length - 1 && setFolderStack((prev) => prev.slice(0, i + 1))}
                  >
                    {f.name}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* File List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                <Loader2 size={24} style={{ color: "#38bdf8", animation: "spin 1s linear infinite" }} />
              </div>
            ) : error ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#f87171", fontSize: "0.83rem" }}>
                {error}
              </div>
            ) : files.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#475569", fontSize: "0.83rem" }}>
                {search ? "No files match your search." : "This folder is empty."}
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handlePickFile(file)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                    transition: "background 0.15s",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{getMimeIcon(file.mimeType)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#e2e8f0", fontSize: "0.83rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {file.name}
                    </p>
                    {!file.isFolder && (
                      <p style={{ color: "#475569", fontSize: "0.7rem" }}>
                        {formatSize(file.size)}{file.modifiedAt ? ` · ${new Date(file.modifiedAt).toLocaleDateString()}` : ""}
                      </p>
                    )}
                  </div>

                  {!file.isFolder && (
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      {/* Copy shareable link */}
                      <button
                        onClick={(e) => handleCopyLink(file, e)}
                        disabled={sharingId === file.id}
                        title="Copy shareable link"
                        style={{
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "7px", padding: "5px 8px", cursor: "pointer",
                          color: copiedId === file.id ? "#22c55e" : "#94a3b8",
                          display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem",
                        }}
                      >
                        {sharingId === file.id ? (
                          <Loader2 size={12} />
                        ) : copiedId === file.id ? (
                          <><Check size={12} /> Copied</>
                        ) : (
                          <><Copy size={12} /> Share</>
                        )}
                      </button>

                      {/* Open in Drive */}
                      {file.viewLink && (
                        <a
                          href={file.viewLink}
                          target="_blank"
                          rel="noreferrer"
                          title="Open in Google Drive"
                          style={{
                            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "7px", padding: "5px 7px", color: "#64748b",
                            display: "flex", alignItems: "center",
                          }}
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}

                      {/* Use in ATRAIL (insert link) */}
                      <button
                        onClick={() => handlePickFile(file)}
                        disabled={sharingId === file.id}
                        title="Attach to task/chat"
                        style={{
                          background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.2)",
                          borderRadius: "7px", padding: "5px 8px", cursor: "pointer",
                          color: "#38bdf8", fontSize: "0.7rem", fontWeight: 700,
                        }}
                      >
                        Attach
                      </button>
                    </div>
                  )}

                  {file.isFolder && (
                    <Folder size={14} style={{ color: "#475569", flexShrink: 0 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );

  if (inline) return content;

  // Modal overlay
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: "520px", height: "560px", borderRadius: "16px", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
