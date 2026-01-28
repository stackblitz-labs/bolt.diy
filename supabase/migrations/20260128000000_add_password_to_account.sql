-- Add password column to account table for email/password authentication
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "password" text;
