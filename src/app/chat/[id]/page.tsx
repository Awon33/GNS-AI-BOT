import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { ChatWindow } from '@/components/ChatWindow';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch sessions and messages IN PARALLEL (much faster than sequential)
  const [{ data: sessions }, { data: messages }] = await Promise.all([
    supabase
      .from('chat_sessions')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
  ]);

  // Make sure session belongs to user
  const currentSession = sessions?.find(s => s.id === id);
  if (!currentSession) {
    redirect('/');
  }

  return (
    <AppLayout sessions={sessions || []} userId={user.id}>
      <ChatWindow 
        sessionId={id} 
        userId={user.id} 
        initialMessages={messages || []} 
      />
    </AppLayout>
  );
}
