"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";
import { useLanguage } from "@/lib/i18n";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";

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

const EXAMPLE_KEYS = ["chat.example.1", "chat.example.2", "chat.example.3"];

function Chat() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
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
      const msg = err instanceof Error ? err.message : "";
      setError(
        err instanceof TypeError
          ? t("error.network")
          : !msg || msg.includes("[object Object]") || msg.startsWith("Request failed with status")
            ? t("chat.unavailable")
            : msg,
      );
      setInput(trimmed);
      setMessages((prev) => prev.filter((m) => m !== userMessage));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline instead. (Ignore Enter while an
    // IME composition is in progress, e.g. when typing Sinhala or Tamil.)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  function newConversation() {
    if (!window.confirm(t("chat.newConfirm"))) return;
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] min-h-[28rem] w-full max-w-2xl flex-col px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">{t("chat.title")}</h1>
        {messages.length > 0 && (
          <Button variant="ghost" onClick={newConversation}>
            {t("chat.new")}
          </Button>
        )}
      </div>
      <p className="mb-3 mt-1 text-ink-soft">{t("chat.subtitle")}</p>

      <div ref={scrollRef} role="log" aria-live="polite" aria-label={t("chat.title")} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && !sending && (
          <div className="rounded-card border border-line bg-paper-raised p-4">
            <p className="mb-2 text-sm font-medium text-ink">{t("chat.examplesLabel")}</p>
            <ul className="flex flex-col gap-2">
              {EXAMPLE_KEYS.map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(t(key));
                      inputRef.current?.focus();
                    }}
                    className="min-h-touch w-full rounded-control border border-line px-3 py-2 text-left text-ink hover:border-primary hover:bg-primary-50"
                  >
                    {t(key)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] whitespace-pre-wrap rounded-card px-4 py-2.5 [overflow-wrap:anywhere] ${
              m.role === "user" ? "ml-auto bg-primary text-paper-raised" : "border border-line bg-paper-raised text-ink"
            }`}
          >
            <span className="sr-only">{m.role === "user" ? t("chat.you") : t("chat.assistant")}: </span>
            {m.content}
          </div>
        ))}

        {sending && (
          <div className="flex w-fit items-center gap-1.5 rounded-card border border-line bg-paper-raised px-4 py-3 text-ink-soft">
            <span className="sr-only">{t("chat.thinking")}</span>
            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-soft" />
            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-soft [animation-delay:150ms]" />
            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-soft [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Alert>{error}</Alert>
          </div>
          <Button variant="ghost" onClick={() => setError(null)}>
            {t("common.dismiss")}
          </Button>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          rows={2}
          aria-label={t("chat.placeholder")}
          className="control max-h-40 flex-1 resize-none"
        />
        <Button onClick={handleSend} disabled={!input.trim()} loading={sending} size="lg">
          {t("chat.send")}
        </Button>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{t("chat.disclaimer")}</p>
    </div>
  );
}
