'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, PlusCircle, LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export function Sidebar({ sessions, userId }: { sessions: any[], userId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="w-80 border-r border-slate-800 bg-slate-950 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-800">
        <form action="/api/chat/new" method="POST">
          <Button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm transition-all justify-start">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Recent Chats</p>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500 px-2 italic">No previous sessions</p>
          ) : (
            sessions.map((session) => (
              <Link key={session.id} href={`/chat/${session.id}`}>
                <div className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                  pathname === `/chat/${session.id}`
                    ? 'bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                }`}>
                  <MessageSquare className="h-4 w-4" />
                  <span className="truncate text-sm">{session.title || 'New Conversation'}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-slate-800">
        <Button onClick={handleSignOut} variant="ghost" className="w-full justify-start text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
