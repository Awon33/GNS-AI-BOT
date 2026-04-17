'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Bot, User } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
};

export function ChatWindow({ sessionId, userId, initialMessages }: { sessionId: string, userId: string, initialMessages: any[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageContent = input.trim();
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userMessageContent };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessageContent, sessionId, userId }),
      });

      if (!response.ok) {
        throw new Error('API Error');
      }

      if (!response.body) throw new Error('No response body');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiMessageContent = '';
      
      setMessages(prev => [...prev, { id: 'ai-temp', role: 'ai', content: '' }]);

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

    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'An error occurred while generating the response. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {m.role === 'ai' && (
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-md">
                  <Bot size={20} />
                </div>
              )}

              <div className={`
                max-w-[85%] rounded-2xl px-5 py-4 shadow-sm
                ${m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-sm shadow-indigo-500/20' 
                  : 'bg-slate-900/80 backdrop-blur-sm text-slate-200 border border-slate-700/50 rounded-tl-sm prose-invert hover:shadow-lg transition-shadow duration-300'
                }
              `}>
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                ) : (
                  <div className="prose prose-invert prose-indigo max-w-none text-slate-300 break-words prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 focus:outline-none">
                    <ReactMarkdown
                      components={{
                        p: ({node, children}) => {
                          // Custom renderer to highlight [Page X] citations
                          return <p className="mb-4 last:mb-0">
                            {React.Children.map(children, child => {
                              if (typeof child === 'string') {
                                // Split by [Page X] and render styled spans
                                const parts = child.split(/(\[Page \d+\])/g);
                                return parts.map((part, i) => {
                                  if (part.match(/\[Page \d+\]/)) {
                                    return <span key={i} className="inline-flex items-center px-1.5 py-0.5 mx-1 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">{part}</span>;
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
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700">
                  <User size={20} />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 justify-start animate-in fade-in zoom-in duration-300">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Bot size={20} />
              </div>
              <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span className="text-sm font-medium animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 md:p-6 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800/80 sticky bottom-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about GNS 212..."
            disabled={isLoading}
            className="w-full pr-14 bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500 rounded-full h-14 pl-6 shadow-inner text-base"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 rounded-full h-10 w-10 bg-indigo-600 hover:bg-indigo-500 text-white transition-transform active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
          </Button>
        </form>
        <p className="text-center text-xs text-slate-500 mt-3 font-medium">
          GNS 212 AI Teaching Assistant. Answers are based exclusively on the provided textbook context.
        </p>
      </div>
    </div>
  );
}
