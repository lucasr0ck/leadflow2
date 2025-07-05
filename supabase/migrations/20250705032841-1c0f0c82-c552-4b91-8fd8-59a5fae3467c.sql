
-- Add isActive field to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Add comment to document the field
COMMENT ON COLUMN public.campaigns.is_active IS 'Indicates if the campaign is currently active';
