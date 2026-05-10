-- Add content column to links table for storing extracted article text
ALTER TABLE links ADD COLUMN IF NOT EXISTS content TEXT;
