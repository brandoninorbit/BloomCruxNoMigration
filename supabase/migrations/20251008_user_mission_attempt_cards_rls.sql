-- Add RLS policies for user_mission_attempt_cards table
-- This table stores per-card coverage details for mission attempts

-- Enable RLS on the table (if not already enabled)
ALTER TABLE user_mission_attempt_cards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own attempt card records
CREATE POLICY "Users can insert their own attempt cards"
ON user_mission_attempt_cards
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own attempt card records
CREATE POLICY "Users can read their own attempt cards"
ON user_mission_attempt_cards
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can update their own attempt card records (for corrections/amendments)
CREATE POLICY "Users can update their own attempt cards"
ON user_mission_attempt_cards
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: No DELETE policy - attempt cards are immutable audit records
