
export interface Team {
  id: string;
  team_name: string;
  owner_id: string;
  created_at: string;
}

export interface Seller {
  id: string;
  team_id: string;
  name: string;
  weight: number;
  created_at: string;
}

export interface SellerContact {
  id: string;
  seller_id: string;
  phone_number: string;
  description?: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  greeting_message?: string;
  created_at: string;
}

// CampaignLink interface removed - no longer using static links

export interface Click {
  id: number;
  campaign_id: string;
  seller_id: string;
  created_at: string;
}

export interface SellerWithContacts extends Seller {
  seller_contacts: SellerContact[];
}

// CampaignWithLinks interface removed - no longer using static links
