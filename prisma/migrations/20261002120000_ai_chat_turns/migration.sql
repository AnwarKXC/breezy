-- AI data assistant: one row per chat turn. Serves as the audit trail
-- (who asked what, which tools ran with which arguments) and as the source for
-- the per-user daily token budget.
CREATE TABLE public.ai_chat_turns (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  conversation_id uuid        NOT NULL,
  question        text        NOT NULL,
  answer          text        NOT NULL DEFAULT '',
  tool_calls      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  provider        text        NOT NULL,
  model           text        NOT NULL,
  input_tokens    integer     NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens   integer     NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  status          text        NOT NULL CHECK (status IN ('ok', 'error', 'aborted')),
  error_code      text,
  latency_ms      integer     NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_chat_turns_user_created_idx ON public.ai_chat_turns (user_id, created_at DESC);
CREATE INDEX ai_chat_turns_conversation_idx ON public.ai_chat_turns (conversation_id, created_at);

-- Server-only table (Prisma connects as the owner); never exposed to API roles.
ALTER TABLE public.ai_chat_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_chat_turns FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON public.ai_chat_turns FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
