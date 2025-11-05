
-- Replace whatsapp_url with phone_number in seller_contacts table
ALTER TABLE public.seller_contacts 
DROP COLUMN IF EXISTS whatsapp_url;

ALTER TABLE public.seller_contacts
ADD COLUMN IF NOT EXISTS phone_number text;

-- Add greeting_message to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS greeting_message text;

-- Add comment to document the new fields
COMMENT ON COLUMN public.seller_contacts.phone_number IS 'Phone number for WhatsApp contact (e.g., 5511999998888)';
COMMENT ON COLUMN public.campaigns.greeting_message IS 'Message that will be sent when redirecting to WhatsApp';
