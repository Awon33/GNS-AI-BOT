import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create a new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: user.id, title: 'New Conversation' })
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  // Redirect to the new chat session page
  redirect(`/chat/${data.id}`);
}
