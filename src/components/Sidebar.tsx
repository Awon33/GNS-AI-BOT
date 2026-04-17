'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, LogOut, MoreHorizontal, Trash2, Edit2, Sparkles } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function Sidebar({ sessions, userId, onMobileClose }: { sessions: any[], userId: string, onMobileClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [editingSession, setEditingSession] = useState<{ id: string, title: string } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !newTitle.trim()) return;
    setIsUpdating(true);
    try {
      await fetch(`/api/chat/session/${editingSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      router.refresh();
      setEditingSession(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/chat/session/${id}`, { method: 'DELETE' });
      if (pathname === `/chat/${id}`) {
        router.push('/');
      } else {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <div className="w-full bg-secondary/50 dark:bg-secondary flex flex-col h-full shrink-0">        {/* Logo / Brand */}
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-center gap-2 px-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground text-base">GNS 212</span>
          </div>
          <form action="/api/chat/new" method="POST" onSubmit={() => onMobileClose?.()}>
            <Button
              type="submit"
              variant="outline"
              className="w-full justify-start gap-3 rounded-full h-10 px-4 border-border bg-background hover:bg-accent text-foreground text-sm font-medium shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New chat
            </Button>
          </form>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className="text-xs font-medium text-muted-foreground px-4 py-2">Recent</p>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-2">No conversations yet</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  router.push(`/chat/${session.id}`);
                  if (onMobileClose) onMobileClose();
                }}
                className={`flex items-center justify-between group px-3 py-2.5 rounded-full transition-colors duration-150 cursor-pointer mb-0.5 ${pathname === `/chat/${session.id}`
                  ? 'bg-accent text-foreground'
                  : 'text-foreground/80 hover:bg-accent/60'
                  }`}
              >
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="truncate text-sm">{session.title || 'New chat'}</span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-accent shrink-0 inline-flex items-center justify-center rounded-full bg-transparent border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setEditingSession({ id: session.id, title: session.title }); setNewTitle(session.title || ''); }}
                      className="cursor-pointer"
                    >
                      <Edit2 className="mr-2 h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleDelete(session.id, e as any)}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 mt-auto">
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent rounded-full h-10 text-sm"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter a new name"
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditingSession(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating || !newTitle.trim()}>
                {isUpdating ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
