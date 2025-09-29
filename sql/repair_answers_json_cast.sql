-- Repair script: convert legacy string answers_json (a JSON *string* that itself holds an array) into proper jsonb arrays.
-- Safe to re-run; only touches rows where answers_json is a jsonb string representing an array.

-- 1. Diagnostic: how many rows have answers_json stored as a jsonb string?
select count(*) as string_rows
from user_deck_mission_attempts
where answers_json is not null
  and jsonb_typeof(answers_json) = 'string';

-- 2. Sample the first 20 problematic rows (shows the raw text inside the string)
select id,
       jsonb_typeof(answers_json) as jb_type,
       left(answers_json::text, 120) as raw_text
from user_deck_mission_attempts
where answers_json is not null
  and jsonb_typeof(answers_json) = 'string'
limit 20;

-- 3. Identify candidate rows whose string content LOOKS like a JSON array
with candidates as (
  select id, answers_json::text as raw_text
  from user_deck_mission_attempts
  where answers_json is not null
    and jsonb_typeof(answers_json) = 'string'
    and (
      -- Two patterns: already unquoted array text OR quoted with leading [
      answers_json::text like '[%'      -- some deployments may already yield bare array text
      or answers_json::text like '"[%' -- typical case: string starting with "[
    )
)
select count(*) as candidate_rows from candidates;

-- 4. Perform the in‑place conversion.
-- Explanation: answers_json::text gives the inner string (without surrounding quotes if it was a jsonb string),
-- then casting to jsonb converts the array text into a real jsonb array.
with candidates as (
  select id, answers_json::text as raw_text
  from user_deck_mission_attempts
  where answers_json is not null
    and jsonb_typeof(answers_json) = 'string'
    and (
      answers_json::text like '[%'
      or answers_json::text like '"[%'
    )
)
update user_deck_mission_attempts a
set answers_json = (a.answers_json::text)::jsonb
where a.id in (select id from candidates);

-- 5. Post‑verification: count rows now properly arrays
select count(*) as array_rows
from user_deck_mission_attempts
where answers_json is not null
  and jsonb_typeof(answers_json) = 'array';

-- 6. Optional: any remaining non-array, non-null rows (should be zero or other scalar edge cases)
select count(*) as remaining_non_array
from user_deck_mission_attempts
where answers_json is not null
  and jsonb_typeof(answers_json) <> 'array';
