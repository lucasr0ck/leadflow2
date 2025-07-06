
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

export interface CampaignLink {
  id: string;
  campaign_id: string;
  contact_id: string;
  position: number;
  created_at: string;
}

export interface Click {
  id: number;
  campaign_id: string;
  campaign_link_id: string;
  created_at: string;
}

export interface SellerWithContacts extends Seller {
  seller_contacts: SellerContact[];
}

export interface CampaignWithLinks extends Campaign {
  campaign_links: (CampaignLink & {
    seller_contacts: SellerContact & {
      sellers: Seller;
    };
  })[];
}
