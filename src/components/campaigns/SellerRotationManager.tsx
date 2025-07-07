import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SellerRotationChart } from './SellerRotationChart';

interface Seller {
  id: string;
  name: string;
}

interface RotationEntry {
  sellerId: string;
  sellerName: string;
  repetitions: number;
}

interface SellerRotationManagerProps {
  rotation: RotationEntry[];
  onRotationChange: (rotation: RotationEntry[]) => void;
}

export const SellerRotationManager = ({ rotation, onRotationChange }: SellerRotationManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [repetitions, setRepetitions] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSellers();
    }
  }, [user]);

  const fetchSellers = async () => {
    try {
      setIsLoading(true);
      
      // Get user's team
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      // Fetch sellers
      const { data: sellersData } = await supabase
        .from('sellers')
        .select('id, name')
        .eq('team_id', team.id)
        .order('name');

      setSellers(sellersData || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar vendedores.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addToRotation = () => {
    if (!selectedSellerId) {
      toast({
        title: "Erro",
        description: "Selecione um vendedor.",
        variant: "destructive",
      });
      return;
    }

    if (repetitions < 1) {
      toast({
        title: "Erro",
        description: "O número de repetições deve ser pelo menos 1.",
        variant: "destructive",
      });
      return;
    }

    const seller = sellers.find(s => s.id === selectedSellerId);
    if (!seller) return;

    // Check if seller is already in rotation
    const existingEntryIndex = rotation.findIndex(entry => entry.sellerId === selectedSellerId);
    
    if (existingEntryIndex >= 0) {
      // Update existing entry
      const updatedRotation = [...rotation];
      updatedRotation[existingEntryIndex].repetitions += repetitions;
      onRotationChange(updatedRotation);
    } else {
      // Add new entry
      const newEntry: RotationEntry = {
        sellerId: selectedSellerId,
        sellerName: seller.name,
        repetitions,
      };
      onRotationChange([...rotation, newEntry]);
    }

    // Reset form
    setSelectedSellerId('');
    setRepetitions(1);
    
    toast({
      title: "Sucesso",
      description: `${seller.name} adicionado à rotação com ${repetitions} repetições.`,
    });
  };

  const removeFromRotation = (sellerId: string) => {
    onRotationChange(rotation.filter(entry => entry.sellerId !== sellerId));
  };

  const updateRepetitions = (sellerId: string, newRepetitions: number) => {
    if (newRepetitions < 1) return;
    
    const updatedRotation = rotation.map(entry =>
      entry.sellerId === sellerId
        ? { ...entry, repetitions: newRepetitions }
        : entry
    );
    onRotationChange(updatedRotation);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-slate-200 rounded animate-pulse" />
        <div className="h-32 bg-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Distribuição de Leads</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure quantos leads cada vendedor receberá na rotação desta campanha.
        </p>
      </div>

      {/* Add to Rotation Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="seller-select">Vendedor</Label>
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.length === 0 ? (
                    <SelectItem value="no-sellers" disabled>
                      Nenhum vendedor encontrado
                    </SelectItem>
                  ) : (
                    sellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repetitions">Repetições</Label>
              <Input
                id="repetitions"
                type="number"
                min="1"
                value={repetitions}
                onChange={(e) => setRepetitions(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full"
              />
            </div>

            <Button 
              onClick={addToRotation}
              disabled={!selectedSellerId || sellers.length === 0}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {sellers.length === 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              Nenhum vendedor encontrado. 
              <a href="/sellers/new" className="text-primary hover:underline ml-1">
                Adicionar vendedor
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Current Rotation */}
      {rotation.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Rotação Atual ({rotation.reduce((sum, entry) => sum + entry.repetitions, 0)} slots):</h4>
          <div className="flex flex-wrap gap-2">
            {rotation.map((entry) => (
              <Badge key={entry.sellerId} variant="secondary" className="px-3 py-2 text-sm">
                <span className="mr-2">
                  {entry.sellerName} ({entry.repetitions} slots)
                </span>
                <input
                  type="number"
                  min="1"
                  value={entry.repetitions}
                  onChange={(e) => updateRepetitions(entry.sellerId, parseInt(e.target.value) || 1)}
                  className="w-12 bg-transparent border-none text-center text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeFromRotation(entry.sellerId)}
                  className="ml-2 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Visualization */}
      <div className="flex justify-center">
        <SellerRotationChart rotation={rotation} />
      </div>
    </div>
  );
};