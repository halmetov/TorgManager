# Confectionery Management System - Backend

FastAPI backend для системы управления кондитерскими изделиями.

## Установка

1. Создайте виртуальное окружение:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows
```

2. Установите зависимости:
```bash
pip install -r requirements.txt
```

3. Настройте PostgreSQL:
```bash
# Создайте базу данных
createdb confectionery_db

# Или используйте SQL:
# CREATE DATABASE confectionery_db;
```

4. Настройте переменные окружения:
```bash
cp .env.example .env
# Отредактируйте .env и укажите правильные данные для подключения к базе
```

5. Запустите сервер:
```bash
python main.py
# или
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Аутентификация
- `POST /token` - Вход (username, password)
- `GET /me` - Получить текущего пользователя

### Товары (Products)
- `GET /products` - Получить все товары
- `POST /products` - Создать товар (только admin)
- `PUT /products/{id}` - Обновить товар (только admin)
- `DELETE /products/{id}` - Удалить товар (только admin)

### Магазины (Shops)
- `GET /shops` - Получить все магазины
- `POST /shops` - Создать магазин

### Менеджеры (Managers)
- `GET /managers` - Получить всех менеджеров (только admin)
- `POST /managers` - Создать менеджера (только admin)
- `PUT /managers/{id}` - Обновить менеджера (только admin)

### Отправка (Dispatch)
- `POST /dispatch` - Отправить товары менеджеру (только admin)

### Заказы (Orders)
- `POST /orders` - Создать заказ (только manager)

### Возвраты (Returns)
- `POST /returns` - Создать возврат

### Отчеты (Reports)
- `GET /reports/products` - Отчет по товарам (только admin)
- `GET /reports/manager/{id}` - Отчет по менеджеру (только admin)
- `GET /reports/manager-summary` - Сводный отчет по менеджерам

## Учетные данные по умолчанию

**Админ:**
- Username: `admin`
- Password: `admin`

## API Documentation

После запуска сервера документация доступна по адресу:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## SQL для новых таблиц (если нет миграций)

```sql
CREATE TABLE IF NOT EXISTS counterparties (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    company_name VARCHAR,
    phone VARCHAR,
    iin_bin VARCHAR,
    address VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_admin_id INTEGER NOT NULL REFERENCES users(id),
    is_archived BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sales_orders (
    id SERIAL PRIMARY KEY,
    counterparty_id INTEGER NOT NULL REFERENCES counterparties(id),
    status VARCHAR DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    created_by_admin_id INTEGER NOT NULL REFERENCES users(id),
    total_amount FLOAT DEFAULT 0,
    paid_amount FLOAT DEFAULT 0,
    debt_amount FLOAT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity FLOAT NOT NULL,
    price_at_time FLOAT NOT NULL,
    line_total FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_order_payments (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
    paid_amount FLOAT NOT NULL,
    debt_amount FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR,
    bin VARCHAR,
    address VARCHAR,
    phone VARCHAR,
    bank_details TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
```
