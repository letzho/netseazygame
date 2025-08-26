-- Add design column to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS design VARCHAR(50) DEFAULT 'netscard1';
