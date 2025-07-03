
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { SellerWithContacts } from '@/types/database';

export const Sellers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sellers, setSellers] = useState<SellerWithContacts[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSeller, setEditingSeller] = useState<SellerWithContacts | null>(null);
  const [sellerName, setSellerName] = useState('');
  const [contacts, setContacts] = useState<{ whatsapp_url: string; description: string }[]>([
    { whatsapp_url: '', description: '' },
  ]);

  useEffect(() => {
    if (user) {
      fetchSellers();
    }
  }, [user]);

  const fetchSellers = async () => {
    try {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      const { data: sellersData } = await supabase
        .from('sellers')
        .select(`
          *,
          seller_contacts (*)
        `)
        .eq('team_id', team.id)
        .order('created_at', { ascending: false });

      setSellers(sellersData || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      if (editingSeller) {
        // Update existing seller
        await supabase
          .from('sellers')
          .update({ name: sellerName })
          .eq('id', editingSeller.id);

        // Delete existing contacts
        await supabase
          .from('seller_contacts')
          .delete()
          .eq('seller_id', editingSeller.id);

        // Insert new contacts
        const validContacts = contacts.filter(c => c.whatsapp_url.trim());
        if (validContacts.length > 0) {
          await supabase
            .from('seller_contacts')
            .insert(
              validContacts.map(contact => ({
                seller_id: editingSeller.id,
                whatsapp_url: contact.whatsapp_url,
                description: contact.description || null,
              }))
            );
        }

        toast({
          title: 'Success',
          description: 'Seller updated successfully',
        });
      } else {
        // Create new seller
        const { data: newSeller } = await supabase
          .from('sellers')
          .insert({
            team_id: team.id,
            name: sellerName,
          })
          .select()
          .single();

        if (newSeller) {
          // Insert contacts
          const validContacts = contacts.filter(c => c.whatsapp_url.trim());
          if (validContacts.length > 0) {
            await supabase
              .from('seller_contacts')
              .insert(
                validContacts.map(contact => ({
                  seller_id: newSeller.id,
                  whatsapp_url: contact.whatsapp_url,
                  description: contact.description || null,
                }))
              );
          }
        }

        toast({
          title: 'Success',
          description: 'Seller created successfully',
        });
      }

      // Reset form
      setShowForm(false);
      setEditingSeller(null);
      setSellerName('');
      setContacts([{ whatsapp_url: '', description: '' }]);
      fetchSellers();
    } catch (error) {
      console.error('Error saving seller:', error);
      toast({
        title: 'Error',
        description: 'Failed to save seller',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (seller: SellerWithContacts) => {
    setEditingSeller(seller);
    setSellerName(seller.name);
    setContacts(
      seller.seller_contacts.length > 0
        ? seller.seller_contacts.map(c => ({
            whatsapp_url: c.whatsapp_url,
            description: c.description || '',
          }))
        : [{ whatsapp_url: '', description: '' }]
    );
    setShowForm(true);
  };

  const handleDelete = async (sellerId: string) => {
    if (!confirm('Are you sure you want to delete this seller?')) return;

    try {
      await supabase.from('sellers').delete().eq('id', sellerId);
      
      toast({
        title: 'Success',
        description: 'Seller deleted successfully',
      });
      
      fetchSellers();
    } catch (error) {
      console.error('Error deleting seller:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete seller',
        variant: 'destructive',
      });
    }
  };

  const addContactField = () => {
    setContacts([...contacts, { whatsapp_url: '', description: '' }]);
  };

  const removeContactField = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: string, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  return (
    <div className="space-y-6">
      <BackButton />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Sellers</h1>
          <p className="text-slate-600">Manage your sales team</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#2D9065] hover:bg-[#2D9065]/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Seller
        </Button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingSeller ? 'Edit Seller' : 'Add New Seller'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="sellerName">Seller Name</Label>
              <Input
                id="sellerName"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Enter seller name"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label>Contacts</Label>
              {contacts.map((contact, index) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Input
                    placeholder="WhatsApp URL"
                    value={contact.whatsapp_url}
                    onChange={(e) => updateContact(index, 'whatsapp_url', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={contact.description}
                    onChange={(e) => updateContact(index, 'description', e.target.value)}
                    className="flex-1"
                  />
                  {contacts.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeContactField(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addContactField}
                className="mt-2"
              >
                Add Contact
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="bg-[#2D9065] hover:bg-[#2D9065]/90"
              >
                {editingSeller ? 'Update' : 'Create'} Seller
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingSeller(null);
                  setSellerName('');
                  setContacts([{ whatsapp_url: '', description: '' }]);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Sales Team</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {sellers.map((seller) => (
            <div key={seller.id} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-800">{seller.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {seller.seller_contacts.length} contact(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(seller)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(seller.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {seller.seller_contacts.length > 0 && (
                <div className="mt-3 space-y-1">
                  {seller.seller_contacts.map((contact) => (
                    <div key={contact.id} className="text-sm text-slate-600">
                      <a
                        href={contact.whatsapp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2D9065] hover:underline"
                      >
                        {contact.whatsapp_url}
                      </a>
                      {contact.description && (
                        <span className="ml-2 text-slate-500">
                          - {contact.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {sellers.length === 0 && (
            <div className="p-6 text-center text-slate-500">
              No sellers added yet. Click "Add Seller" to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
