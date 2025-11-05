import { Loader2 } from 'lucide-react';

export const GlobalSpinner = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
        <div className="text-slate-600 text-sm">Carregando...</div>
      </div>
    </div>
  );
};

