-- Atomic purchase procedure for cosmetics
-- This function deducts tokens and records the purchase in a single transaction

CREATE OR REPLACE FUNCTION public.purchase_cosmetic(
  p_user_id uuid,
  p_cover_id text,
  p_price integer
) RETURNS json AS $$
DECLARE
  current_tokens integer;
  result json;
BEGIN
  -- Check current tokens
  SELECT tokens INTO current_tokens
  FROM public.user_economy
  WHERE user_id = p_user_id;

  IF current_tokens IS NULL THEN
    RETURN json_build_object('error', 'user_economy_not_found');
  END IF;

  IF current_tokens < p_price THEN
    RETURN json_build_object('error', 'insufficient_tokens', 'tokens', current_tokens);
  END IF;

  -- Deduct tokens
  UPDATE public.user_economy
  SET tokens = tokens - p_price
  WHERE user_id = p_user_id;

  -- Record purchase
  INSERT INTO public.user_cover_purchases (user_id, cover_id, purchased_at)
  VALUES (p_user_id, p_cover_id, NOW())
  ON CONFLICT (user_id, cover_id) DO NOTHING;

  RETURN json_build_object('ok', true, 'tokens_deducted', p_price);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
