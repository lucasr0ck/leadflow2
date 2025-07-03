
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const BackButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      onClick={() => navigate(-1)}
      className="mb-6 p-0 text-slate-600 hover:text-slate-800"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
  );
};
