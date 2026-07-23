-- Allow conversations with no listing attached (general seller inquiries
-- started from a profile page, as opposed to conversations started from a
-- specific listing/order, which keep their listing_id).
alter table conversations alter column listing_id drop not null;
