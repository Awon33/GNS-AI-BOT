'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Sparkles, User, ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
};

export function ChatWindow({ sessionId, userId, initialMessages }: { sessionId: string, userId: string, initialMessages: any[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageContent = input.trim();
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userMessageContent };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const isFirstMessage = messages.length === 0;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessageContent, 
          sessionId, 
          userId,
          generateTitle: isFirstMessage
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Server threw an error:', errText);
        throw new Error(`API Error: ${errText}`);
      }

      if (!response.body) throw new Error('No response body');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiMessageContent = '';
      
      const aiMessageId = Date.now().toString() + '-ai';
      setMessages(prev => [...prev, { id: aiMessageId, role: 'ai', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        aiMessageContent += chunk;
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = aiMessageContent;
          return newMessages;
        });
      }

      if (isFirstMessage) {
        setTimeout(() => router.refresh(), 1000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'An error occurred while generating the response. Please try again.' }]);
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

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[48rem] mx-auto px-4 md:px-0 py-6 space-y-8">
          {messages.map((m) => (
            <div key={m.id} className="group">
              {m.role === 'user' ? (
                /* ── User Message ── */
                <div className="flex items-start gap-4 justify-end">
                  <div className="bg-secondary rounded-[20px] px-5 py-3 max-w-[80%]">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed text-[15px]">
                      {m.content}
                    </p>
                  </div>
                </div>
              ) : (
                /* ── AI Message (Gemini-style: icon + flowing text) ── */
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="prose dark:prose-invert max-w-none text-foreground text-[15px] leading-7 prose-p:my-3 prose-headings:text-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-ul:my-3 prose-li:my-1">
                      <ReactMarkdown
                        components={{
                          p: ({node, children}) => {
                            return <p>
                              {React.Children.map(children, child => {
                                if (typeof child === 'string') {
                                  const parts = child.split(/(\[Page \d+\])/g);
                                  return parts.map((part, i) => {
                                    if (part.match(/\[Page \d+\]/)) {
                                      return <span key={i} className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary whitespace-nowrap">{part}</span>;
                                    }
                                    return part;
                                  });
                                }
                                return child;
                              })}
                            </p>
                          }
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                    
                    {/* Action bar — appears on hover like Gemini */}
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        onClick={() => handleCopy(m.content, m.id)}
                        className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy"
                      >
                        {copiedId === m.id ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Good response">
                        <ThumbsUp className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Bad response">
                        <ThumbsDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator — Gemini shimmer style */}
          {isLoading && (
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="flex-1 pt-1.5 space-y-3">
                <div className="h-4 bg-muted rounded-full w-3/4 animate-pulse" />
                <div className="h-4 bg-muted rounded-full w-1/2 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="h-4 bg-muted rounded-full w-2/3 animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input Area — Gemini pill-style */}
      <div className="px-4 pb-4 md:pb-6 pt-2">
        <div className="max-w-[48rem] mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end rounded-[28px] bg-secondary border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about GNS 212..."
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none bg-transparent px-6 py-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 max-h-[200px]"
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={isLoading || !input.trim()}
                className="rounded-full h-10 w-10 mr-2 mb-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted disabled:text-muted-foreground transition-all shrink-0"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </form>
          <p className="text-center text-[11px] text-muted-foreground mt-3">
            GNS 212 AI may display inaccurate info. Answers are based on the provided textbook.
          </p>
        </div>
      </div>
    </div>
  );
}
