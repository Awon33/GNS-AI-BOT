import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, BookOpen } from 'lucide-react';
import Link from 'next/link';

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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar sessions={sessions || []} userId={user.id} />
      
      <main className="flex-1 flex flex-col relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 -z-10" />
        
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-indigo-500/10 text-indigo-400 rounded-3xl flex items-center justify-center border border-indigo-500/20 shadow-2xl shadow-indigo-500/10">
            <BookOpen className="w-12 h-12" />
          </div>
          
          <div className="space-y-4 max-w-lg">
            <h1 className="text-4xl font-bold tracking-tight text-slate-100">
              GNS 212 Assistant
            </h1>
            <p className="text-lg text-slate-400">
              Welcome back. I am ready to answer your questions about the GNS 212 coursework. Every answer comes with a precise page citation.
            </p>
          </div>

          <form action="/api/chat/new" method="POST">
            <Button size="lg" className="rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 px-8 h-14 text-lg transition-all hover:scale-105 active:scale-95">
              <PlusCircle className="mr-2 h-6 w-6" />
              Start New Conversation
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
