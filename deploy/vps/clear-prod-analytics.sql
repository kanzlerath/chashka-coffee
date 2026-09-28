BEGIN;
DO $$
BEGIN
  IF current_database() <> 'chashka_coffee_prod' THEN
    RAISE EXCEPTION 'Refusing to clear analytics outside chashka_coffee_prod';
  END IF;
END $$;
DELETE FROM page_views;
COMMIT;
