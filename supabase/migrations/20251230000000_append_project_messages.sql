-- Migration: Add append-only RPC function for project messages
-- Feature: specs/001-project-chat-sync (Phase 3, Task T011)
-- Date: 2025-12-30
--
-- Purpose:
-- Provides a safe append-only write primitive for chat messages that:
-- 1. Allocates sequence_num on the server to prevent concurrent session collisions
-- 2. Uses advisory locks to serialize sequence allocation per project
-- 3. Deduplicates by message_id to prevent duplicate inserts
-- 4. Never overwrites existing messages (ON CONFLICT DO NOTHING)

-- Function: append_project_messages
-- Inserts new chat messages for a project with server-side sequence allocation
--
-- Parameters:
--   p_project_id: UUID of the project
--   p_messages: JSONB array of message objects (without sequence_num)
--
-- Each message object should contain:
--   - message_id (text): Unique identifier for the message
--   - role (text): 'user' | 'assistant' | 'system'
--   - content (jsonb): Message content (AI SDK format)
--   - annotations (jsonb, optional): Message annotations
--   - created_at (timestamptz, optional): Message timestamp (defaults to now())
--
-- Returns:
--   JSONB object with { inserted_count: <number> }
--
-- Behavior:
--   1. Acquires advisory lock per project to serialize sequence allocation
--   2. Finds max existing sequence_num for the project
--   3. Inserts each message with incremental sequence_num
--   4. Skips messages with duplicate message_id (ON CONFLICT DO NOTHING)
--   5. Returns count of actually inserted messages

CREATE OR REPLACE FUNCTION append_project_messages(
  p_project_id uuid,
  p_messages jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_seq integer;
  v_message jsonb;
  v_next_seq integer;
  v_inserted_count integer := 0;
  v_index integer := 0;
BEGIN
  -- Acquire advisory lock for this project to serialize sequence allocation
  -- Lock is released automatically at transaction end
  PERFORM pg_advisory_xact_lock(hashtext(p_project_id::text));

  -- Get current max sequence_num for this project (NULL if no messages exist)
  SELECT COALESCE(MAX(sequence_num), -1)
  INTO v_max_seq
  FROM project_messages
  WHERE project_id = p_project_id;

  -- Set starting sequence number
  v_next_seq := v_max_seq + 1;

  -- Insert each message in request order
  FOR v_message IN SELECT * FROM jsonb_array_elements(p_messages)
  LOOP
    -- Insert message with allocated sequence_num
    -- ON CONFLICT DO NOTHING prevents duplicate message_id inserts
    INSERT INTO project_messages (
      project_id,
      message_id,
      sequence_num,
      role,
      content,
      annotations,
      created_at
    )
    VALUES (
      p_project_id,
      v_message->>'message_id',
      v_next_seq,
      v_message->>'role',
      v_message->'content',
      v_message->'annotations',
      COALESCE(
        (v_message->>'created_at')::timestamptz,
        now()
      )
    )
    ON CONFLICT (project_id, message_id) DO NOTHING;

    -- Check if row was actually inserted (GET DIAGNOSTICS returns 0 if conflict occurred)
    IF FOUND THEN
      v_inserted_count := v_inserted_count + 1;
    END IF;

    -- Increment sequence for next message
    v_next_seq := v_next_seq + 1;
  END LOOP;

  -- Return result
  RETURN jsonb_build_object('inserted_count', v_inserted_count);
END;
$$;

-- Grant execute permission to authenticated users
-- RLS policies on project_messages will still enforce ownership checks
GRANT EXECUTE ON FUNCTION append_project_messages(uuid, jsonb) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION append_project_messages(uuid, jsonb) IS
'Append-only insert for project messages with server-side sequence allocation. Prevents concurrent write conflicts and message overwrites. Part of specs/001-project-chat-sync implementation.';
