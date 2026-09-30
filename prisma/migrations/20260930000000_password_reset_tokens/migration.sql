-- Single-use password reset links. id stores sha256(token); the raw token only
-- exists in the emailed link.
CREATE TABLE public.password_reset_tokens (
  id text NOT NULL,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX password_reset_tokens_user_id_idx ON public.password_reset_tokens (user_id);
CREATE INDEX password_reset_tokens_expires_at_idx ON public.password_reset_tokens (expires_at);
