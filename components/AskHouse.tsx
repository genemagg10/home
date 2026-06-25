"use client";

import { useRef, useState } from "react";

interface Source { doc_title: string; doc_kind: string }
interface Msg { role: "user" | "assistant"; text: string; sources?: Source[] }

const PROMPTS = [
  "What's overdue right now?",
  "Which paint is in the living room?",
  "Who do I call for the AC?",
  "When's the deck due to be resealed?",
];

export default function AskHouse({ seed }: { seed: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }, { role: "assistant", text: "" }]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        const err = await res.text();
        setMessages((m) => updateLast(m, () => `⚠️ ${err || "Something went wrong."}`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let sources: Source[] | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.text) { acc += evt.text; setMessages((m) => updateLast(m, () => acc, sources)); }
            if (evt.sources) { sources = evt.sources; setMessages((m) => updateLast(m, () => acc, sources)); }
          } catch { /* ignore keepalive */ }
        }
        scroller.current?.scrollTo(0, scroller.current.scrollHeight);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-line p-5 shadow-soft"
         style={{ background: "linear-gradient(160deg,#fffdf8,#fbf6ec)" }}>
      <h2 className="card-title">🪴 Ask the House</h2>
      <p className="text-muted text-[13px] mb-4">
        {seed
          ? "Demo mode — connect Supabase + add docs and I'll answer from your real manual."
          : "I've read all your manuals, receipts, photos & notes. Ask me anything."}
      </p>

      {messages.length > 0 && (
        <div ref={scroller} className="max-h-[360px] overflow-auto mb-3 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i}
                 className={`px-3.5 py-3 rounded-2xl text-[13.5px] leading-relaxed max-w-[88%] ${
                   m.role === "user" ? "ml-auto bg-sage text-white rounded-br-sm" : "bg-[#f3eee2] rounded-bl-sm"
                 }`}>
              {m.text || <span className="opacity-50">thinking…</span>}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {m.sources.map((s, j) => (
                    <span key={j} className="text-[11px] px-2.5 py-0.5 rounded-xl bg-card border border-line text-muted">
                      {s.doc_kind === "image" ? "🖼️" : s.doc_kind === "pdf" ? "📄" : s.doc_kind === "link" ? "🔗" : "📝"} {s.doc_title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex gap-2 flex-wrap my-2 mb-4">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => ask(p)}
                    className="text-[12.5px] px-3 py-2 rounded-2xl bg-card border border-line cursor-pointer hover:border-clay">
              {p}
            </button>
          ))}
        </div>
      )}

      <form className="flex gap-2.5 items-center" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
               placeholder="Ask anything about your house…"
               className="flex-1 border border-line rounded-3xl px-4 py-3 bg-card text-sm outline-none focus:border-sage" />
        <button type="submit" disabled={busy}
                className="w-11 h-11 rounded-full border-0 bg-clay text-white text-[17px] cursor-pointer flex-none disabled:opacity-50">
          {busy ? "…" : "↑"}
        </button>
      </form>
    </div>
  );
}

function updateLast(msgs: Msg[], textFn: () => string, sources?: Source[]): Msg[] {
  const copy = [...msgs];
  const last = copy[copy.length - 1];
  if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, text: textFn(), sources };
  return copy;
}
