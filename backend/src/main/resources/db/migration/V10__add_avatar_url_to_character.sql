-- Migration 10: Add avatar_url column to character table
ALTER TABLE "character" 
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;
