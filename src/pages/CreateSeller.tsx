
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackButton } from '@/components/BackButton';
import { SellerForm } from '@/components/seller/SellerForm';
import { useSellerOperations } from '@/hooks/useSellerOperations';

export const CreateSeller = () => {
  const navigate = useNavigate();
  const { createSeller, isSubmitting } = useSellerOperations();

  const handleCancel = () => {
    navigate('/sellers');
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-6">
        <BackButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Novo Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <SellerForm
            onSubmit={createSeller}
            isSubmitting={isSubmitting}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
};
