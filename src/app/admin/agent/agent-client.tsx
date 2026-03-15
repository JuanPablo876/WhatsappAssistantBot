'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  name?: string;
  timestamp: string;
}

interface ToolCallDisplay {
  name: string;
  args: Record<string, unknown>;
  result: { success: boolean; data?: unknown; error?: string };
}

export default function AdminAgentClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/admin/agent');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/agent/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        console.log('Loaded session messages:', data.session.messages);
        const msgs = (data.session.messages || []).map((m: Message) => ({
          ...m,
          content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
        }));
        setCurrentSessionId(sessionId);
        setMessages(msgs);
        setShowSidebar(false);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/agent/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(sessions.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const startNewSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setShowSidebar(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: currentSessionId,
        }),
      });

      if (!res.ok) throw new Error('Request failed');

      const data = await res.json();

      // Update session ID if new
      if (data.sessionId && data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId);
        loadSessions(); // Refresh session list
      }

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Agent error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your request.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleToolExpanded = (id: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen relative">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden fixed top-20 left-4 z-30 p-2 rounded-lg bg-white/[0.06] backdrop-blur-sm border border-white/[0.08]"
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      </button>

      {/* Sessions Sidebar */}
      <AnimatePresence>
        {(showSidebar || typeof window !== 'undefined' && window.innerWidth >= 768) && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className={`
              ${showSidebar ? 'fixed inset-y-0 left-0 z-40' : 'hidden md:flex'}
              w-72 flex-col bg-[#0c0c18]/95 backdrop-blur-xl border-r border-white/[0.06]
              md:relative
            `}
          >
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-white/70">Sessions</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="md:hidden p-1.5 rounded hover:bg-white/[0.06]"
                >
                  <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <button
                onClick={startNewSession}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-red-500/20 to-purple-500/20 hover:from-red-500/30 hover:to-purple-500/30 border border-white/[0.08] text-sm text-white/90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New conversation
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 ? (
                <p className="text-center text-white/30 text-xs py-8">No conversations yet</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`
                      group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all
                      ${currentSessionId === session.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}
                    `}
                    onClick={() => loadSession(session.id)}
                  >
                    <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="flex-1 text-sm text-white/70 truncate">{session.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.1] transition-all"
                    >
                      <svg className="w-3.5 h-3.5 text-white/40 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile sidebar */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <header className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/30 to-purple-500/30 flex items-center justify-center border border-white/[0.1]">
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 15.5m14.8-.2l-.1 3.2a2.4 2.4 0 01-2.4 2.4H6.7a2.4 2.4 0 01-2.4-2.4l-.1-3.2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white/90">Secret Agent</h1>
            <p className="text-xs text-white/40">Research assistant with knowledge management</p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-purple-500/20 flex items-center justify-center mb-4 border border-white/[0.08]">
                <svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 15.5m14.8-.2l-.1 3.2a2.4 2.4 0 01-2.4 2.4H6.7a2.4 2.4 0 01-2.4-2.4l-.1-3.2" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-white/70 mb-2">Secret Agent Ready</h2>
              <p className="text-sm text-white/40 max-w-md">
                I can help you research technical topics, manage knowledge skills, and analyze documentation.
                All conversations are logged for audit.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {['Search for API integrations', 'Create a new skill', 'What skills exist?'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 text-xs rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white/60 border border-white/[0.08] transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages
            .filter((m) => m.role !== 'tool' && m.role !== 'system')
            .map((message, i) => (
              <div key={i} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`
                    max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3
                    ${message.role === 'user'
                      ? 'bg-gradient-to-r from-red-500/30 to-purple-500/30 border border-white/[0.1]'
                      : 'bg-white/[0.04] border border-white/[0.06]'
                    }
                  `}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      {typeof message.content === 'string' && message.content.trim() ? (
                        <ReactMarkdown
                          components={{
                            pre: ({ children }) => (
                              <pre className="bg-black/30 rounded-lg p-3 overflow-x-auto text-xs">{children}</pre>
                            ),
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs">{children}</code>
                              ) : (
                                <code className="text-xs">{children}</code>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <span className="text-white/40 italic text-xs">Processing...</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-white/90 whitespace-pre-wrap">{String(message.content || '')}</p>
                  )}
                </div>
              </div>
            ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-white/40">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 md:px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              rows={1}
              className="flex-1 resize-none rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/[0.2] transition-colors"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 rounded-xl bg-gradient-to-r from-red-500 to-purple-500 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-red-500/20 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
