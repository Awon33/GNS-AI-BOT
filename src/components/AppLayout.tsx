'use client';

import React, { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AppLayout({ sessions, userId, children }: { sessions: any[], userId: string, children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full shrink-0 w-70">
        <Sidebar sessions={sessions} userId={userId} />
      </div>

      <main className="flex-1 flex flex-col relative h-full w-full max-w-full min-h-0 min-w-0">
        {/* Mobile Header — clean, minimal like Gemini */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-background">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px]">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">Chat history and settings</SheetDescription>
              <Sidebar sessions={sessions} userId={userId} onMobileClose={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          <span className="text-sm font-medium text-muted-foreground">GNS 212</span>

          <ThemeToggle />
        </div>

        {/* Desktop Theme toggle — top right */}
        <div className="hidden md:flex absolute top-3 right-4 z-50">
          <ThemeToggle />
        </div>

        {children}
      </main>
    </div>
  );
}
