'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Trash2,
  Bot,
  User,
  Copy,
  Check,
  Code2,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface PRChatDrawerProps {
  repositoryId: string;
  prNumber: number;
  isOpen: boolean;
  onClose: () => void;
}

const STARTER_PROMPTS = [
  'Explain the security vulnerabilities in this PR.',
  'How should I safely refactor the session token creation?',
  'Write a Vitest test suite for session.ts.',
  'Show me how to parameterize the SQL query in route.ts.',
];

export function PRChatDrawer({
  repositoryId,
  prNumber,
  isOpen,
  onClose,
}: PRChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/review/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId,
          prNumber,
          message: textToSend,
          history: newMessages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}: Failed to get answer`);
      }

      if (!response.body) {
        throw new Error('No readable response stream received.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: accumulated } : msg
          )
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown chat error';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `⚠️ **Chat Error**: ${msg}\n\nPlease check your Gemini API key or retry.`,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const renderMessageContent = (content: string, msgId: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
      <div className="space-y-2 text-xs leading-relaxed font-sans">
        {parts.map((part, index) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const lines = part.slice(3, -3).trim().split('\n');
            const lang = lines[0].trim();
            const code = (lang ? lines.slice(1) : lines).join('\n');
            const codeBlockId = `${msgId}-block-${index}`;

            return (
              <div key={index} className="my-2 rounded-lg border border-white/[0.08] bg-[#070b13] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1 bg-[#0a0f19] border-b border-white/[0.06] text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Code2 className="w-3 h-3 text-blue-400" />
                    {lang || 'code'}
                  </span>
                  <button
                    onClick={() => handleCopyCode(code, codeBlockId)}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {copiedCodeId === codeBlockId ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 font-mono text-[11px] text-slate-200 overflow-x-auto whitespace-pre">
                  {code}
                </pre>
              </div>
            );
          }

          return (
            <div key={index} className="whitespace-pre-wrap text-slate-300">
              {part}
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[440px] bg-[#0c1220] border-l border-[#1b2436] shadow-2xl flex flex-col transition-all duration-200 ease-in-out font-sans">
      {/* Drawer Header */}
      <div className="px-4 py-3 border-b border-[#1b2436] bg-[#090e1a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-white">CodeGuard Copilot</h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">PR #{prNumber} Diff & Guidelines</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear Conversation"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#070b13]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center px-4">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-semibold text-white">Chat with CodeGuard AI</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[280px]">
              Ask questions about security risks, architectural changes, or request test cases for this PR.
            </p>

            {/* Quick starter chips */}
            <div className="mt-5 w-full space-y-2">
              <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 font-semibold">
                Suggested Questions
              </span>
              {STARTER_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left p-2.5 rounded-lg border border-[#1b2436] bg-[#0c1220] hover:bg-[#11192c] hover:border-blue-500/40 text-[11px] text-slate-300 transition-all flex items-center justify-between group"
                >
                  <span className="line-clamp-1">{prompt}</span>
                  <Sparkles className="w-3 h-3 text-slate-500 group-hover:text-blue-400 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-tr-none'
                    : 'bg-[#0d1424] border border-[#1b2436] text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.role === 'assistant' ? (
                  msg.content === '' ? (
                    <div className="flex items-center gap-1.5 text-slate-400 py-1">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                      <span className="text-[11px]">Thinking with Gemini...</span>
                    </div>
                  ) : (
                    renderMessageContent(msg.content, msg.id)
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-md bg-[#162136] border border-[#1b2436] flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 bg-[#090e1a] border-t border-[#1b2436] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-end gap-2 bg-[#070b13] border border-[#1b2436] focus-within:border-blue-500/60 rounded-xl p-2 transition-colors"
        >
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about PR security, refactoring, or tests..."
            className="flex-1 bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none resize-none font-sans"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white transition-all shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>

        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
          <span>Enter to send • Esc to close</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Gemini 3.8 Flash Online
          </span>
        </div>
      </div>
    </div>
  );
}
