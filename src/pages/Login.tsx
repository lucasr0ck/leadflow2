
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Branding Side */}
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-[#2D9065] to-slate-800 relative overflow-hidden flex flex-col justify-between p-12">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <pattern id="brand-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="50" cy="50" r="2" fill="white" fillOpacity="0.3"/>
                <circle cx="25" cy="25" r="1" fill="white" fillOpacity="0.2"/>
                <circle cx="75" cy="75" r="1" fill="white" fillOpacity="0.2"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#brand-grid)" />
          </svg>
        </div>

        {/* Main Branding Content - Centered */}
        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
          <div className="space-y-6">
            <h1 className="text-6xl font-bold text-white tracking-tight leading-tight">
              LeadFlow
            </h1>
            <p className="text-xl text-white/90 font-medium max-w-md leading-relaxed">
              Intelligent Lead Distribution, Simplified.
            </p>
          </div>
        </div>

        {/* Bottom Brand Credit */}
        <div className="relative z-10 text-center">
          <p className="text-white/60 text-sm font-medium tracking-wide">
            by Multium Group
          </p>
        </div>
      </div>

      {/* Right Column - Action Side */}
      <div className="flex-1 bg-slate-50 flex items-center justify-center p-8">
        {/* Login Form Card with Animation */}
        <Card className="w-full max-w-md bg-white shadow-2xl border-0 ring-1 ring-slate-200/50 animate-fade-in">
          <CardHeader className="text-center space-y-4 pb-6 pt-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">
                Welcome Back
              </h2>
              <p className="text-slate-600">
                Sign in to your account
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">
                  Team Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your team email"
                  required
                  className="h-12 border-slate-200 focus:border-[#2D9065] focus:ring-[#2D9065] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-12 border-slate-200 focus:border-[#2D9065] focus:ring-[#2D9065] transition-colors"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#2D9065] hover:bg-[#2D9065]/90 font-semibold text-white shadow-lg shadow-[#2D9065]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#2D9065]/30"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
