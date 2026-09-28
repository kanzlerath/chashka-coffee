SELECT entity, count FROM (
  SELECT 'restaurants' AS entity, count(*) AS count FROM restaurants
  UNION ALL SELECT 'menus', count(*) FROM menus
  UNION ALL SELECT 'menu_categories', count(*) FROM menu_categories
  UNION ALL SELECT 'menu_items', count(*) FROM menu_items
  UNION ALL SELECT 'products', count(*) FROM products
  UNION ALL SELECT 'content_entries', count(*) FROM content_entries
  UNION ALL SELECT 'journal_articles', count(*) FROM content_entries WHERE type::text = 'ARTICLE'
  UNION ALL SELECT 'promotions', count(*) FROM content_entries WHERE type::text = 'PROMOTION'
  UNION ALL SELECT 'events', count(*) FROM content_entries WHERE type::text = 'EVENT'
  UNION ALL SELECT 'managed_pages', count(*) FROM managed_pages
  UNION ALL SELECT 'job_openings', count(*) FROM job_openings
  UNION ALL SELECT 'site_settings', count(*) FROM site_settings
  UNION ALL SELECT 'media_assets', count(*) FROM media_assets
  UNION ALL SELECT 'users', count(*) FROM users
  UNION ALL SELECT 'customer_accounts', count(*) FROM customer_accounts
  UNION ALL SELECT 'leads', count(*) FROM leads
  UNION ALL SELECT 'orders', count(*) FROM orders
) AS totals
ORDER BY entity;
