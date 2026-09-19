-- Country / nationality columns store ISO 3166-1 alpha-2 codes (e.g. 'EG').
-- Names are rendered by the app (src/shared/static/countries.ts).
ALTER TABLE public.contacts
  ALTER COLUMN country TYPE varchar(2),
  ADD CONSTRAINT contacts_country_iso2_check CHECK (country ~ '^[A-Z]{2}$');

ALTER TABLE public.guests
  ALTER COLUMN country TYPE varchar(2),
  ADD CONSTRAINT guests_country_iso2_check CHECK (country ~ '^[A-Z]{2}$');

ALTER TABLE public.reservation_guests
  ALTER COLUMN nationality TYPE varchar(2),
  ADD CONSTRAINT reservation_guests_nationality_iso2_check CHECK (nationality ~ '^[A-Z]{2}$');
