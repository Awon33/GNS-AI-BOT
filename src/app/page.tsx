import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { Sparkles, ArrowRight } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch chat sessions
  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  const suggestions = [
    { text: "Explain the key concepts of GNS 212", icon: "📚" },
    { text: "Summarize chapter 1 for me", icon: "📝" },
    { text: "What are the main topics covered?", icon: "🎯" },
    { text: "Help me prepare for the exam", icon: "🧠" },
  ];

  return (
    <AppLayout sessions={sessions || []} userId={user.id}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto">
        <div className="max-w-[48rem] w-full space-y-8 py-12">
          
          {/* Gemini-style gradient greeting */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-light tracking-tight">
              <span className="gemini-gradient font-medium">Hello there</span>
            </h1>
            <p className="text-3xl md:text-4xl font-light text-muted-foreground">
              How can I help you today?
            </p>
          </div>

          {/* Suggestion chips — Gemini style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6">
            {suggestions.map((s, i) => (
              <form key={i} action="/api/chat/new" method="POST">
                <button
                  type="submit"
                  className="w-full text-left p-4 rounded-2xl border border-border bg-background hover:bg-secondary transition-colors duration-200 group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-2xl mb-2 block">{s.icon}</span>
                      <p className="text-sm text-foreground leading-relaxed">{s.text}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </button>
              </form>
            ))}
          </div>

        </div>

        {/* Bottom input area (for landing page feel) */}
        <div className="w-full max-w-[48rem] pb-6 px-4 md:px-0">
          <form action="/api/chat/new" method="POST">
            <button
              type="submit"
              className="w-full flex items-center rounded-[28px] bg-secondary border border-border hover:border-primary/30 transition-colors px-6 py-4 cursor-pointer group"
            >
              <span className="text-muted-foreground text-[15px] flex-1 text-left">Ask about GNS 212...</span>
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          </form>
          <p className="text-center text-[11px] text-muted-foreground mt-3">
            GNS 212 AI may display inaccurate info. Answers are based on the provided textbook.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
