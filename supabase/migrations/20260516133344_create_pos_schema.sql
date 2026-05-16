/*
  # POS System Schema

  ## New Tables
  - `products` - Stores product catalog
    - `id` (uuid, primary key)
    - `code` (text, unique) - product barcode/SKU
    - `name` (text) - product name
    - `price` (numeric) - unit price
    - `stock` (integer) - available stock
    - `image_url` (text, optional) - product image
    - `created_at` (timestamptz)

  - `orders` - Stores completed transactions
    - `id` (uuid, primary key)
    - `customer_phone` (text) - customer phone number
    - `total` (numeric) - total amount
    - `created_at` (timestamptz)

  - `order_items` - Line items for each order
    - `id` (uuid, primary key)
    - `order_id` (uuid, foreign key to orders)
    - `product_id` (uuid, foreign key to products)
    - `quantity` (integer)
    - `unit_price` (numeric)

  ## Security
  - RLS enabled on all tables
  - Public read/write access (no auth for this POS system)
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  price numeric(12, 0) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL DEFAULT '',
  total numeric(12, 0) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12, 0) NOT NULL DEFAULT 0
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert products"
  ON products FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update products"
  ON products FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete products"
  ON products FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read orders"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public read order_items"
  ON order_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert order_items"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

INSERT INTO products (code, name, price, stock) VALUES
  ('SP001', 'Coca Cola 330ml', 15000, 100),
  ('SP002', 'Pepsi 330ml', 14000, 80),
  ('SP003', 'Bánh mì sandwich', 25000, 50),
  ('SP004', 'Nước suối Aquafina', 8000, 200),
  ('SP005', 'Mì gói Hảo Hảo', 6000, 150)
ON CONFLICT (code) DO NOTHING;
