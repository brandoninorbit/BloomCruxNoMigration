import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment variables from .env.local
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillQuestUnlocks() {
  console.log('Starting backfill of quest unlocks...');

  // Get all user_deck_quest_progress rows
  const { data: progressRows, error: progressError } = await supabase
    .from('user_deck_quest_progress')
    .select('user_id, deck_id, per_bloom');

  if (progressError) {
    console.error('Error fetching progress:', progressError);
    return;
  }

  for (const row of progressRows) {
    const { user_id, deck_id, per_bloom } = row;
    const per = per_bloom || {};

    // Get total cards per bloom level for this deck
    const { data: cardRows, error: cardError } = await supabase
      .from('cards')
      .select('bloom_level')
      .eq('deck_id', deck_id);

    if (cardError) {
      console.error(`Error fetching cards for deck ${deck_id}:`, cardError);
      continue;
    }

    const cardCounts = {};
    cardRows.forEach(card => {
      const level = card.bloom_level || 'Remember';
      cardCounts[level] = (cardCounts[level] || 0) + 1;
    });

    let updated = false;

    for (const level of ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']) {
      const totalCards = cardCounts[level] || 0;
      const totalMissions = Math.ceil(totalCards / 50);

      if (totalMissions === 0) continue;

      // Get the latest quest attempt for this user/deck/level
      const { data: attemptRows, error: attemptError } = await supabase
        .from('user_deck_mission_attempts')
        .select('score_pct')
        .eq('user_id', user_id)
        .eq('deck_id', deck_id)
        .eq('bloom_level', level)
        .eq('mode', 'quest')
        .order('ended_at', { ascending: false })
        .limit(1);

      if (attemptError) {
        console.error(`Error fetching attempts for ${user_id}/${deck_id}/${level}:`, attemptError);
        continue;
      }

      const latestAttempt = attemptRows[0];
      if (latestAttempt && latestAttempt.score_pct >= 65) {
        // Set cleared and missionsPassed
        per[level] = per[level] || {};
        per[level].cleared = true;
        per[level].missionsPassed = totalMissions;
        updated = true;
        console.log(`Unlocked ${level} for ${user_id}/${deck_id}`);
      }
    }

    if (updated) {
      // Update the row
      const { error: updateError } = await supabase
        .from('user_deck_quest_progress')
        .update({ per_bloom: per })
        .eq('user_id', user_id)
        .eq('deck_id', deck_id);

      if (updateError) {
        console.error(`Error updating ${user_id}/${deck_id}:`, updateError);
      }
    }
  }

  console.log('Backfill complete.');
}

backfillQuestUnlocks().catch(console.error);
