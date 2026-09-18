"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";
import { useLanguage } from "@/lib/i18n";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// --- Local, on-device chat history -----------------------------------
// Persists chat messages to localStorage so history survives a refresh,
// capped at MAX_STORAGE_BYTES. Once the cap is exceeded, the oldest
// messages are dropped first (FIFO) until the log fits again — so it
// keeps cycling indefinitely instead of growing forever or erroring out
// when localStorage's own quota is hit.
const CHAT_STORAGE_KEY = "agrisense.chatHistory";
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5 MB

interface StoredChat {
  sessionId?: string;
  messages: Message[];
}

function sizeOf(chat: StoredChat): number {
  // UTF-16 in-memory strings vs UTF-8 on disk differ slightly, but this is
  // close enough for a soft cap and avoids extra encoding work per save.
  return new Blob([JSON.stringify(chat)]).size;
}

function loadChat(): StoredChat {
  if (typeof window === "undefined") return { messages: [] };
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw) as StoredChat;
    return { sessionId: parsed.sessionId, messages: parsed.messages ?? [] };
  } catch {
    // Corrupt or unreadable entry — start fresh rather than crashing the page.
    return { messages: [] };
  }
}

function saveChat(chat: StoredChat) {
  if (typeof window === "undefined") return;
  const trimmed = { ...chat, messages: [...chat.messages] };

  // Evict oldest messages first until we're back under the cap.
  while (trimmed.messages.length > 0 && sizeOf(trimmed) > MAX_STORAGE_BYTES) {
    trimmed.messages.shift();
  }

  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Even the trimmed payload didn't fit (quota shared with other data) —
    // drop half the remaining history and try once more before giving up.
    trimmed.messages.splice(0, Math.ceil(trimmed.messages.length / 2));
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* localStorage unavailable (private mode, etc.) — chat still works in-memory */
    }
  }
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <Chat />
    </AuthGuard>
  );
}

function Chat() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load any saved chat history from this device on first render.
  useEffect(() => {
    const stored = loadChat();
    setMessages(stored.messages);
    setSessionId(stored.sessionId);
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever the conversation changes, once the
  // initial load has completed (avoids overwriting saved history with an
  // empty array during the very first render).
  useEffect(() => {
    if (!hydrated) return;
    saveChat({ sessionId, messages });
  }, [hydrated, sessionId, messages]);

  async function handleSend() {
    if (!input.trim()) return;
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const response = (await api.chat.send(userMessage.content, sessionId)) as { session_id: string; reply: string };
      setSessionId(response.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-57px)] max-w-2xl flex-col px-6 py-6">
      <h1 className="mb-1 text-2xl font-bold text-primary">💬 {t("chat.title")}</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Ask about crop issues, irrigation, or fertilizer — I already know your farm and recent diagnoses.
      </p>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="rounded-xl bg-neutral-100 p-4 text-neutral-500">
            Try: &quot;My tomato leaves are curling, what should I do?&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${
              m.role === "user" ? "ml-auto bg-primary text-white" : "bg-neutral-100 text-neutral-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && <div className="max-w-[60%] rounded-2xl bg-neutral-100 px-4 py-2.5 text-neutral-400">Typing…</div>}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={t("chat.placeholder")}
          className="flex-1 rounded-full border border-neutral-300 px-4 py-3"
        />
        <button
          onClick={handleSend}
          disabled={sending}
          className="rounded-full bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {t("chat.send")}
        </button>
      </div>
    </main>
  );
}