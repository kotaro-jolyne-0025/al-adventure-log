-- Migration 11: Add requires_attunement column to inventory_item table
ALTER TABLE inventory_item 
    ADD COLUMN IF NOT EXISTS requires_attunement BOOLEAN DEFAULT FALSE;
