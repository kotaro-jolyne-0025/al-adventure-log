-- Migration 9: Add subclass column to character table
ALTER TABLE "character" 
    ADD COLUMN IF NOT EXISTS subclass VARCHAR(100);
