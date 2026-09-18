"use client";

import { useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const trimmed = input.trim();
    // Guards against both an empty send and a duplicate send fired while
    // a request is already in flight (e.g. Enter pressed twice quickly).
    if (!trimmed || sending) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setSending(true);

    try {
      const response = (await api.chat.send(userMessage.content, sessionId)) as {
        session_id: string;
        reply: string;
      };
      setSessionId(response.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
    } catch (err) {
      // Never swallow this: surface it in the UI, and put the farmer's
      // message back in the box so it isn't lost.
      setError(
        err instanceof Error
          ? err.message
          : "The AI assistant is temporarily unavailable. Please try again shortly."
      );
      setInput(trimmed);
      setMessages((prev) => prev.filter((m) => m !== userMessage));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline instead.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-64px)] max-w-2xl flex-col px-4 py-6 sm:px-6">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">{t("chat.title")}</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Ask about crop issues, irrigation, or fertilizer — I already know your farm and recent diagnoses.
      </p>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && !sending && (
          <p className="rounded-lg bg-paper-raised p-4 text-ink-soft">
            Try: &quot;My tomato leaves are curling, what should I do?&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${
              m.role === "user" ? "ml-auto bg-primary text-paper" : "bg-paper-raised text-ink"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div
            className="flex max-w-[60%] items-center gap-1.5 rounded-2xl bg-paper-raised px-4 py-3 text-ink-soft"
            aria-live="polite"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-soft" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-soft [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-soft [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-chili-50 px-4 py-2.5 text-sm text-chili-dark">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          rows={1}
          aria-label={t("chat.placeholder")}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-line bg-paper-raised px-4 py-3 text-[15px] focus:border-primary"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-busy={sending}
          className="shrink-0 rounded-full bg-primary px-6 py-3 font-semibold text-paper disabled:opacity-50"
        >
          {sending ? "…" : t("chat.send")}
        </button>
      </div>
    </main>
  );
}