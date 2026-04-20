-- ═══════════════════════════════════════════════════════════
-- Le Barista — Seed Data
-- Run after schema migration
-- ═══════════════════════════════════════════════════════════

-- ─── ROLES ──────────────────────────────────────────────
insert into public.roles (id, name, label, color, is_system, permissions) values
  ('00000000-0000-0000-0000-000000000001', 'super_admin', 'Super Admin', '#7C3AED', true,
   '["dashboard.read","daily.read","daily.write","employees.read","employees.write","suppliers.read","suppliers.write","safe.read","safe.write","inventory.read","inventory.write","admin.manage_users","admin.manage_roles","admin.manage_settings"]'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'admin', 'Admin', '#2D8B75', true,
   '["dashboard.read","daily.read","daily.write","employees.read","employees.write","suppliers.read","suppliers.write","safe.read","safe.write","inventory.read","inventory.write","admin.manage_users","admin.manage_settings"]'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'serveur', 'Serveur', '#378ADD', false,
   '["dashboard.read","daily.read","daily.write","inventory.read","inventory.write"]'::jsonb),
  ('00000000-0000-0000-0000-000000000004', 'cuisinier', 'Cuisinier', '#D85A30', false,
   '["dashboard.read","daily.read","inventory.read","inventory.write","suppliers.read"]'::jsonb)
on conflict (name) do nothing;

-- ─── PRODUCTS ───────────────────────────────────────────
insert into public.products (name, unit, unit_price, category, sort_order) values
  ('Poulet', 'KG', 15, 'food', 1),
  ('VH', 'KG', 120, 'food', 2),
  ('Crevette', 'G', 190, 'food', 3),
  ('Calamar', 'G', 75, 'food', 4),
  ('Mozzarela', 'KG', 58, 'food', 5),
  ('Frites surgelé', 'KG', 22, 'food', 6),
  ('Eau 33cl', 'Pce', 1.7, 'drink', 7),
  ('Eau 50cl', 'Pce', 5, 'drink', 8),
  ('Boisson 250ml', 'Pce', 3.5, 'drink', 9),
  ('Boisson 330ml', 'Pce', 7.5, 'drink', 10),
  ('Oulmès', 'Pce', 4.6, 'drink', 11),
  ('Red Bull', 'Pce', 18, 'drink', 12),
  ('Café', 'KG', 115, 'drink', 13),
  ('Oreo', 'Pce', 2, 'snack', 14),
  ('Kinder', 'Pce', 5, 'snack', 15),
  ('KitKat', 'Pce', 3.5, 'snack', 16),
  ('Gâteau Rubon d''Or', 'Pce', 16, 'snack', 17),
  ('Papier serviette', 'Pce', 8.5, 'other', 18);

-- ─── SUPPLIERS ──────────────────────────────────────────
insert into public.suppliers (name, items) values
  ('Mouhmad', '["Poulet","Légumes","Fruits"]'::jsonb),
  ('North Africa', '["Mozzarella","Tortilla","Frite sous vide","Sauce mayonnaise","Crème premium","Pâte penne","Nuggets","Chicken burger","Cheddar","Papier serviette","Nutella"]'::jsonb),
  ('Café', '["Café grain","Café moulu"]'::jsonb),
  ('Gaz', '["Bouteille gaz"]'::jsonb),
  ('Pepsi', '["Pepsi 33cl","7up","Mirinda"]'::jsonb),
  ('Orange', '["Fanta","Coca light"]'::jsonb),
  ('Carrefour', '["Farine","Lait","Riz","Sauce soja","Parmesan","Viande hachée","Beurre","Pain","Sucre","Eau"]'::jsonb),
  ('Épicerie', '["Divers épicerie"]'::jsonb),
  ('Coca', '["Coca Cola 33cl","Sprite","Hawai"]'::jsonb),
  ('Youssef Charcuterie', '["Charcuterie","Viande"]'::jsonb),
  ('Yozi Food', '["Sauce Biggy","Sauce algérienne","Frite","Tortilla"]'::jsonb),
  ('Ouiss Food', '["Plats préparés"]'::jsonb);

-- ─── EMPLOYEES ──────────────────────────────────────────
insert into public.employees (name, base_salary, position) values
  ('Imane', 3000, 'Serveuse'),
  ('Abdelhadi', 3000, 'Serveur'),
  ('Fatim Ezzahra', 3000, 'Serveuse'),
  ('Hakim', 3000, 'Serveur'),
  ('Meryame', 3000, 'Serveuse'),
  ('Fatim Ezzahra 2', 2500, 'Serveuse'),
  ('Bouchra', 2500, 'Serveuse'),
  ('Leila', 2500, 'Serveuse'),
  ('Aymane', 0, 'Stagiaire'),
  ('Kaoutar', 0, 'Stagiaire'),
  ('Houssam', 0, 'Stagiaire');

-- ─── DEFAULT MONTHLY CHARGES (template) ─────────────────
-- These get copied for each new month
insert into public.monthly_charges (label, amount, payment_method, month_key, sort_order) values
  ('Ruban d''Or', 0, 'Virement', '2026-04', 1),
  ('Eau + Élec', 0, 'Application', '2026-04', 2),
  ('Téléphone / Internet', 250, 'Application', '2026-04', 3),
  ('Loyer Bureau + Intilaq', 3800, 'Application', '2026-04', 4),
  ('Loyer Local', 13800, 'Chèque', '2026-04', 5);
