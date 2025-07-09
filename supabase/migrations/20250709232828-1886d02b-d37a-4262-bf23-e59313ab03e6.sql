-- Phase 1: Database Schema Modification for Dynamic Lead Distribution

-- 1.1. Add weight column to sellers table
ALTER TABLE public.sellers 
ADD COLUMN weight integer NOT NULL DEFAULT 1;

-- 1.2. Add seller_id to clicks table to track which seller received each click
ALTER TABLE public.clicks 
ADD COLUMN seller_id uuid REFERENCES public.sellers(id);

-- 1.3. Drop the obsolete campaign_links table entirely
DROP TABLE IF EXISTS public.campaign_links CASCADE;

-- 1.4. Remove the now-obsolete campaign_link_id column from clicks table
ALTER TABLE public.clicks 
DROP COLUMN IF EXISTS campaign_link_id;

-- 1.5. Create index for efficient seller-level click counting
CREATE INDEX IF NOT EXISTS idx_clicks_seller_campaign 
ON public.clicks(seller_id, campaign_id);

-- 1.6. Update RLS policies for clicks table to work with seller_id instead of campaign_link_id
DROP POLICY IF EXISTS "Allow public clicks insertion" ON public.clicks;
DROP POLICY IF EXISTS "Users can view clicks from their campaigns" ON public.clicks;

-- New RLS policies for clicks table
CREATE POLICY "Allow public clicks insertion" 
ON public.clicks 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view clicks from their campaigns" 
ON public.clicks 
FOR SELECT 
USING (campaign_id IN ( 
  SELECT c.id
  FROM campaigns c
  JOIN teams t ON (c.team_id = t.id)
  WHERE (t.owner_id = auth.uid())
));