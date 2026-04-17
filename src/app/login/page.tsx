import { login, signup } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles } from 'lucide-react';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground">
            to continue to GNS 212 AI
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {/* Form — clean Google-style */}
        <form className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              placeholder="you@example.com" 
              required 
              className="h-12 rounded-xl bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
            <Input 
              id="password" 
              name="password" 
              type="password" 
              required 
              className="h-12 rounded-xl bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary"
            />
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <Button 
              type="submit" 
              formAction={login} 
              className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all"
            >
              Sign in
            </Button>
            <Button 
              type="submit" 
              formAction={signup} 
              variant="ghost"
              className="w-full h-11 rounded-full text-primary hover:bg-primary/5 font-medium transition-all"
            >
              Create account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
