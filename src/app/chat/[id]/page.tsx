import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/ChatWindow';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all chat sessions for the sidebar
  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch current session messages using promise structure for db row
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: true });

  // Make sure session belongs to user
  const currentSession = sessions?.find(s => s.id === id);
  if (!currentSession) {
    redirect('/');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar sessions={sessions || []} userId={user.id} />
      
      <main className="flex-1 flex flex-col relative h-full">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-slate-950 to-slate-950 -z-10" />
        
        {/* Pass the server messages to client Chat component */}
        <ChatWindow 
          sessionId={id} 
          userId={user.id} 
          initialMessages={messages || []} 
        />
      </main>
    </div>
  );
}
