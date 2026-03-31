-- Migration: Seed initial users into user_roles table
-- Run this in Supabase (Apps Familia project)

INSERT INTO user_roles (email, role, nombre, password, empresa, activo) VALUES
('admin@brandit', 'admin', 'David', 'CAMBIAR_PASSWORD', 'ambas', true),
('secretaria@brandit', 'secretaria', 'Secretaria', 'CAMBIAR_PASSWORD', 'ambas', true),
('vendedora1@brandit', 'vendedora', 'Vendedora 1', 'CAMBIAR_PASSWORD', 'confecciones_boston', true),
('vendedora2@brandit', 'vendedora', 'Vendedora 2', 'CAMBIAR_PASSWORD', 'brand_it', true)
ON CONFLICT (email) DO NOTHING;
