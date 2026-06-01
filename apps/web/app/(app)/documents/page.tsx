"use client";

import { useEffect, useState, useRef } from "react";
import AppShell from "@/components/AppShell";
import { getDocuments, uploadDocument, deleteDocument } from "@/lib/api-extensions";
import { useAuthStore } from "@/lib/auth-store";
import Button from "@/components/ui/Button";

export default function DocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const [docs, setDocs] = useState<any[]>([]);
  const [desc, setDesc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    if (!token) return;
    try {
      const res = await getDocuments(token);
      if (res.ok) setDocs(res.documents);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [user, token]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !fileRef.current?.files?.[0]) return;

    const file = fileRef.current.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", desc);

    try {
      const res = await uploadDocument(token, formData);
      if (res.ok) {
        setDesc("");
        if (fileRef.current) fileRef.current.value = "";
        loadDocs();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm("Delete document?")) return;
    try {
      const res = await deleteDocument(token, id);
      if (res.ok) loadDocs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <AppShell title="Documents & Files" subtitle="Organization File Repository">
      <div className="flex flex-col md:flex-row gap-6 mt-6">
        
        {/* Left: Document List */}
        <div className="flex-1 space-y-4">
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Files</h2>
            {docs.length === 0 ? (
              <p className="text-text-muted text-sm">No documents found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {docs.map((d) => (
                  <div key={d.id} className="bg-zinc-800/40 border border-primary/20 p-4 rounded-xl flex flex-col justify-between group">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="font-semibold text-primary text-sm truncate pr-2" title={d.name}>
                          {d.name}
                        </div>
                        {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || d.uploadedById === user?.id) && (
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-text-muted mt-1">
                        {(d.sizeBytes / 1024 / 1024).toFixed(2)} MB • {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-text-muted mt-2 line-clamp-2">
                        {d.description || <span className="italic">No description</span>}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-primary/20/50 flex items-center justify-between">
                      <div className="text-[10px] text-text-muted truncate">
                        By {d.uploadedBy.fullName}
                      </div>
                      <a 
                        href={`${process.env.NEXT_PUBLIC_API_HOST || "http://localhost:4000"}${d.fileUrl}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-primary hover:text-primary-light font-medium"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Upload Form */}
        <div className="w-full md:w-80 space-y-6">
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6 sticky top-24">
            <h2 className="text-xl font-bold text-white mb-4">Upload File</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-2">Select File</label>
                <input
                  type="file"
                  required
                  ref={fileRef}
                  className="block w-full text-sm text-text-muted
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary/10 file:text-primary
                    hover:file:bg-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="What is this file?"
                  className="w-full bg-zinc-800 border border-primary/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <Button type="submit" className="w-full">Upload Document</Button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
