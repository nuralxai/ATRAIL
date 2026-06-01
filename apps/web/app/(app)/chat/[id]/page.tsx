"use client";

import { useEffect, useState } from "react";
import ChatShell from "@/components/ChatShell";
import ChatView from "@/components/ChatView";
import EmergencyChatView from "@/components/EmergencyChatView";
import { authedFetch } from "@/lib/authed-fetch";

export default function ChatConversation({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Handle both sync and async params (Next.js 15+ uses async params)
  const conversationId = params instanceof Promise ? undefined : params.id;
  
  const [resolvedId, setResolvedId] = useState<string | undefined>(conversationId);
  const [isEmergency, setIsEmergency] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (params instanceof Promise) {
      params.then((p) => setResolvedId(p.id));
    }
  }, [params]);
  
  const finalId = resolvedId || conversationId;
  
  // Check if this is an emergency conversation
  useEffect(() => {
    if (!finalId) return;
    
    const checkEmergency = async () => {
      try {
        const res = await authedFetch<{ ok: true; event: any | null }>(
          `/emergency/conversation/${finalId}`
        );
        setIsEmergency(res.event !== null);
      } catch (e) {
        setIsEmergency(false);
      }
    };
    
    checkEmergency();
  }, [finalId]);
  
  if (!finalId) {
    return (
      <div className="min-h-screen grid place-items-center glass-panel">
        <div className="text-sm text-text-muted">Loading...</div>
      </div>
    );
  }
  
  // Show emergency chat UI if this is an emergency conversation
  if (isEmergency === true) {
    return <EmergencyChatView conversationId={finalId} />;
  }
  
  // Show regular chat UI
  if (isEmergency === false) {
    return (
      <ChatShell selectedId={finalId}>
        <ChatView conversationId={finalId} />
      </ChatShell>
    );
  }
  
  // Still checking
  return (
    <div className="min-h-screen grid place-items-center glass-panel">
      <div className="text-sm text-text-muted">Loading...</div>
    </div>
  );
}
