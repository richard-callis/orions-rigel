-- =====================================================================
-- BrewHaven Coffee Co. — Sample Database for the SQL Boot Camp
-- Target dialect: PostgreSQL (notes for SQLite/MySQL in 00-setup.md)
-- Run this whole file once. It drops and recreates everything, so it's
-- safe to re-run at any point during the day if someone's data drifts.
-- =====================================================================

DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- ---------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------

CREATE TABLE customers (
    customer_id   SERIAL PRIMARY KEY,
    first_name    VARCHAR(50)  NOT NULL,
    last_name     VARCHAR(50)  NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    city          VARCHAR(50),
    country       VARCHAR(50),
    signup_date   DATE NOT NULL
);

-- Self-referencing table: great for teaching self-joins & recursive CTEs
CREATE TABLE employees (
    employee_id   SERIAL PRIMARY KEY,
    first_name    VARCHAR(50) NOT NULL,
    last_name     VARCHAR(50) NOT NULL,
    title         VARCHAR(50) NOT NULL,
    manager_id    INTEGER REFERENCES employees(employee_id),
    hire_date     DATE NOT NULL
);

CREATE TABLE categories (
    category_id   SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL
);

CREATE TABLE products (
    product_id    SERIAL PRIMARY KEY,
    product_name  VARCHAR(100) NOT NULL,
    category_id   INTEGER NOT NULL REFERENCES categories(category_id),
    price         NUMERIC(8,2) NOT NULL CHECK (price >= 0),
    cost          NUMERIC(8,2) NOT NULL CHECK (cost >= 0),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders (
    order_id      SERIAL PRIMARY KEY,
    customer_id   INTEGER NOT NULL REFERENCES customers(customer_id),
    employee_id   INTEGER REFERENCES employees(employee_id),
    order_date    DATE NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('completed','pending','cancelled'))
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(order_id),
    product_id    INTEGER NOT NULL REFERENCES products(product_id),
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    unit_price    NUMERIC(8,2) NOT NULL  -- price at time of sale (snapshot)
);

CREATE TABLE reviews (
    review_id     SERIAL PRIMARY KEY,
    product_id    INTEGER NOT NULL REFERENCES products(product_id),
    customer_id   INTEGER NOT NULL REFERENCES customers(customer_id),
    rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_date   DATE NOT NULL,
    comment       TEXT
);

-- ---------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------

INSERT INTO categories (category_name) VALUES
    ('Coffee Beans'), ('Brewing Equipment'), ('Mugs & Drinkware'),
    ('Tea'), ('Snacks');

INSERT INTO employees (first_name, last_name, title, manager_id, hire_date) VALUES
    ('Dana', 'Reyes',   'CEO',             NULL, '2018-01-10'),
    ('Marcus', 'Lee',    'Sales Director',   1,    '2018-06-01'),
    ('Priya', 'Nair',    'Support Director', 1,    '2019-02-15'),
    ('Owen', 'Brooks',   'Sales Rep',        2,    '2020-03-20'),
    ('Sofia', 'Alvarez', 'Sales Rep',        2,    '2021-07-11'),
    ('Jamal', 'Whitfield','Sales Rep',       2,    '2022-01-05'),
    ('Grace', 'Kim',     'Support Rep',      3,    '2020-09-01'),
    ('Leo', 'Fischer',   'Support Rep',      3,    '2023-04-18');

INSERT INTO customers (first_name, last_name, email, city, country, signup_date) VALUES
    ('Alice',   'Johnson', 'alice.johnson@example.com',  'Austin',      'USA',     '2022-01-15'),
    ('Ben',     'Carter',  'ben.carter@example.com',     'Toronto',     'Canada',  '2022-02-20'),
    ('Chloe',   'Dubois',  'chloe.dubois@example.com',   'Paris',       'France',  '2022-03-05'),
    ('Diego',   'Santos',  'diego.santos@example.com',   'Lisbon',      'Portugal','2022-03-22'),
    ('Emma',    'Wilson',  'emma.wilson@example.com',    'Austin',      'USA',     '2022-04-10'),
    ('Farid',   'Hassan',  'farid.hassan@example.com',   'Cairo',       'Egypt',   '2022-05-01'),
    ('Grace',   'Park',    'grace.park@example.com',     'Seoul',       'South Korea','2022-05-19'),
    ('Hana',    'Tanaka',  'hana.tanaka@example.com',    'Osaka',       'Japan',   '2022-06-02'),
    ('Ivan',    'Petrov',  'ivan.petrov@example.com',    'Toronto',     'Canada',  '2022-06-30'),
    ('Julia',   'Novak',   'julia.novak@example.com',    'Prague',      'Czechia', '2022-07-14'),
    ('Kenji',   'Ito',     'kenji.ito@example.com',      'Osaka',       'Japan',   '2022-08-01'),
    ('Lena',    'Schmidt', 'lena.schmidt@example.com',   'Berlin',      'Germany', '2022-08-25'),
    ('Mateo',   'Rossi',   'mateo.rossi@example.com',    'Milan',       'Italy',   '2022-09-09'),
    ('Nadia',   'Haddad',  'nadia.haddad@example.com',   'Cairo',       'Egypt',   '2022-10-01'),
    ('Omar',    'Farouk',  'omar.farouk@example.com',    'Austin',      'USA',     '2022-11-17');

INSERT INTO products (product_name, category_id, price, cost, is_active) VALUES
    ('Ethiopia Yirgacheffe 12oz',    1, 16.99, 7.50, TRUE),
    ('Colombia Supremo 12oz',        1, 14.99, 6.80, TRUE),
    ('Sumatra Mandheling 12oz',      1, 15.99, 7.10, TRUE),
    ('Decaf House Blend 12oz',       1, 13.99, 6.20, TRUE),
    ('Espresso Dark Roast 12oz',     1, 15.49, 6.90, TRUE),
    ('Pour-Over Dripper',            2, 24.00, 9.00, TRUE),
    ('French Press 34oz',            2, 29.99, 11.50, TRUE),
    ('Manual Burr Grinder',          2, 45.00, 20.00, TRUE),
    ('Digital Kitchen Scale',        2, 22.50, 9.75, TRUE),
    ('Ceramic Mug 12oz',             3, 12.00, 4.00, TRUE),
    ('Travel Tumbler 16oz',          3, 18.00, 6.50, TRUE),
    ('Espresso Cup Set (4)',         3, 26.00, 10.00, TRUE),
    ('Earl Grey Loose Leaf 4oz',     4, 9.99,  3.50, TRUE),
    ('Jasmine Green Tea 4oz',        4, 10.99, 3.75, TRUE),
    ('Chamomile Herbal 4oz',         4, 8.99,  3.10, TRUE),
    ('Almond Biscotti (6-pack)',     5, 7.50,  2.75, TRUE),
    ('Dark Chocolate Squares',       5, 6.25,  2.10, TRUE),
    ('Vintage Percolator (Discontinued)', 2, 39.99, 18.00, FALSE);

INSERT INTO orders (customer_id, employee_id, order_date, status) VALUES
    (1, 4, '2023-01-05', 'completed'), (2, 4, '2023-01-08', 'completed'),
    (3, 5, '2023-01-10', 'completed'), (1, 4, '2023-01-15', 'completed'),
    (4, 6, '2023-01-18', 'cancelled'), (5, 5, '2023-01-20', 'completed'),
    (6, 4, '2023-01-25', 'completed'), (7, 6, '2023-02-01', 'completed'),
    (2, 4, '2023-02-03', 'completed'), (8, 5, '2023-02-07', 'completed'),
    (9, 4, '2023-02-10', 'completed'), (10,6, '2023-02-14', 'completed'),
    (3, 5, '2023-02-18', 'pending'),   (11,4, '2023-02-20', 'completed'),
    (1, 4, '2023-02-25', 'completed'), (12,6, '2023-03-01', 'completed'),
    (5, 5, '2023-03-04', 'completed'), (13,4, '2023-03-08', 'completed'),
    (6, 4, '2023-03-11', 'cancelled'), (14,6, '2023-03-15', 'completed'),
    (7, 5, '2023-03-19', 'completed'), (2, 4, '2023-03-22', 'completed'),
    (15,6, '2023-03-25', 'completed'), (8, 5, '2023-03-28', 'completed'),
    (9, 4, '2023-04-02', 'completed'), (4, 6, '2023-04-05', 'completed'),
    (10,5, '2023-04-09', 'pending'),   (1, 4, '2023-04-12', 'completed'),
    (11,6, '2023-04-16', 'completed'), (3, 5, '2023-04-20', 'completed'),
    (12,4, '2023-04-23', 'completed'), (13,6, '2023-04-27', 'completed'),
    (6, 5, '2023-05-01', 'completed'), (14,4, '2023-05-05', 'completed'),
    (2, 6, '2023-05-09', 'completed'), (15,5, '2023-05-13', 'completed'),
    (7, 4, '2023-05-17', 'cancelled'), (9, 6, '2023-05-21', 'completed'),
    (5, 5, '2023-05-25', 'completed'), (1, 4, '2023-05-30', 'completed');

-- order_items: several line items per order, referencing real product prices
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1,1,2,16.99),(1,10,1,12.00),
    (2,2,1,14.99),(2,6,1,24.00),
    (3,3,3,15.99),
    (4,1,1,16.99),(4,13,2,9.99),
    (5,7,1,29.99),
    (6,5,2,15.49),(6,11,1,18.00),
    (7,4,1,13.99),(7,16,2,7.50),
    (8,2,2,14.99),
    (9,1,1,16.99),(9,9,1,22.50),
    (10,14,3,10.99),
    (11,3,1,15.99),(11,17,4,6.25),
    (12,8,1,45.00),
    (13,6,1,24.00),
    (14,5,3,15.49),
    (15,1,2,16.99),(15,10,2,12.00),
    (16,2,1,14.99),(16,12,1,26.00),
    (17,15,2,8.99),
    (18,7,1,29.99),(18,9,1,22.50),
    (19,4,1,13.99),
    (20,3,2,15.99),
    (21,1,1,16.99),(21,13,1,9.99),
    (22,11,3,18.00),
    (23,2,2,14.99),
    (24,16,5,7.50),
    (25,5,1,15.49),
    (26,14,1,10.99),
    (27,1,3,16.99),
    (28,8,1,45.00),(28,9,1,22.50),
    (29,3,1,15.99),
    (30,6,2,24.00),
    (31,2,1,14.99),
    (32,17,3,6.25),
    (33,15,1,8.99),
    (34,1,2,16.99),
    (35,10,4,12.00),
    (36,7,1,29.99),
    (37,4,2,13.99),
    (38,5,1,15.49),(38,11,1,18.00),
    (39,3,2,15.99),
    (40,1,1,16.99),(40,12,1,26.00);

INSERT INTO reviews (product_id, customer_id, rating, review_date, comment) VALUES
    (1, 1, 5, '2023-01-12', 'Best coffee I''ve had in years.'),
    (1, 5, 4, '2023-01-28', 'Great flavor, a bit pricey.'),
    (2, 2, 4, '2023-01-14', 'Smooth and balanced.'),
    (3, 3, 5, '2023-01-16', 'Rich and smoky, exactly what I wanted.'),
    (4, 6, 3, '2023-01-30', 'Good decaf but a little weak.'),
    (5, 7, 5, '2023-02-03', 'Perfect for espresso shots.'),
    (6, 2, 4, '2023-02-05', 'Easy to use, makes a great cup.'),
    (7, 3, 2, '2023-02-20', 'Glass carafe arrived cracked.'),
    (7, 5, 5, '2023-03-06', 'Replacement was perfect, love it now.'),
    (8, 9, 4, '2023-04-04', 'Consistent grind size.'),
    (9, 8, 5, '2023-02-09', 'Accurate and sturdy scale.'),
    (10,1, 5, '2023-01-12', 'Cute mug, holds heat well.'),
    (11,6, 4, '2023-01-27', 'Keeps coffee hot for hours.'),
    (12,12,3, '2023-03-03', 'Nice set but cups are small.'),
    (13,4, 4, '2023-01-20', 'Classic earl grey taste.'),
    (14,10,5, '2023-02-16', 'Fragrant and delicious.'),
    (15,7, 4, '2023-03-20', 'Relaxing evening tea.'),
    (16,7, 5, '2023-02-02', 'Crunchy and not too sweet.'),
    (17,3, 4, '2023-02-19', 'Pairs perfectly with dark roast.'),
    (1, 9, 5, '2023-02-11', 'Ordering again next week.'),
    (2, 8, 3, '2023-02-08', 'Fine, nothing special.'),
    (5, 14,5, '2023-03-16', 'My daily go-to now.'),
    (3, 12,4, '2023-04-24', 'Bold and earthy.'),
    (6, 13,5, '2023-03-09', 'Changed my morning routine.'),
    (11,15,4, '2023-05-14', 'Great for the commute.');
