-- Snapshot of the result cards/tables shown for a turn, so a conversation can be
-- reopened from history exactly as the admin saw it (numbers as of that moment).
ALTER TABLE public.ai_chat_turns ADD COLUMN blocks jsonb NOT NULL DEFAULT '[]'::jsonb;
