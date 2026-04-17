import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { title } = await req.json();

    if (!title || !id) {
      return NextResponse.json({ error: 'Missing title or id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('chat_sessions')
      .update({ title })
      .eq('id', id)
      .eq('user_id', user.id); 

    if (error) {
      console.error('Error updating session title:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, title });
  } catch (err) {
    console.error('Session update error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting session:', error);
      return NextResponse.json({ error: 'Database delete failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Session delete error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
