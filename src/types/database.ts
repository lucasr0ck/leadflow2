
export interface Team {
  id: string;
  team_name: string;
  owner_id: string;
  slug: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export type TeamRole = 'owner' | 'admin' | 'member';

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberWithUser extends TeamMember {
  user_email?: string;
}

export interface UserTeam {
  team_id: string;
  team_name: string;
  team_slug: string;
  description: string | null;
  role: TeamRole;
  is_active: boolean;
  member_count: number;
  joined_at: string;
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
  full_slug: string;
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

// Audit Log Types
export type AuditActionType = 'login' | 'logout' | 'create' | 'update' | 'delete';
export type AuditEntityType = 'seller' | 'campaign' | 'contact' | 'team' | 'user';

export interface AuditLog {
  id: string;
  user_id: string | null;
  action_type: AuditActionType;
  entity_type: AuditEntityType | null;
  entity_id: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  user_agent: string | null;
  ip_address: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface AuditLogWithUser extends AuditLog {
  user_email?: string;
}
