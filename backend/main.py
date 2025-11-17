from fastapi import FastAPI, Depends, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta, timezone, date
from datetime import time as time_type
from typing import Any, Dict, List, Optional, Sequence
from decimal import Decimal
import os
import secrets
import models
import schemas
from database import engine, get_db
from sqlalchemy import inspect, text, bindparam, func, literal
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from passlib.context import CryptContext
import jwt

# Create database tables
models.Base.metadata.create_all(bind=engine)


def ensure_shop_columns():
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("shops")}
    statements = []

    if "manager_id" not in columns:
        statements.append("ALTER TABLE shops ADD COLUMN IF NOT EXISTS manager_id INTEGER")
    if "manager_name" not in columns:
        statements.append("ALTER TABLE shops ADD COLUMN IF NOT EXISTS manager_name VARCHAR")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))


ensure_shop_columns()


def ensure_dispatch_columns():
    inspector = inspect(engine)
    try:
        columns = {column["name"] for column in inspector.get_columns("dispatches")}
    except Exception:
        return

    statements = []
    if "status" not in columns:
        statements.append("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS status VARCHAR")
    if "accepted_at" not in columns:
        statements.append("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))
            connection.execute(text("UPDATE dispatches SET status = 'sent' WHERE status IS NULL"))


def ensure_incoming_tables():
    create_incoming = """
        CREATE TABLE IF NOT EXISTS incoming (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP DEFAULT NOW(),
            created_by_admin_id INTEGER REFERENCES users(id)
        )
    """
    create_incoming_items = """
        CREATE TABLE IF NOT EXISTS incoming_items (
            id SERIAL PRIMARY KEY,
            incoming_id INTEGER REFERENCES incoming(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER NOT NULL
        )
    """

    with engine.begin() as connection:
        connection.execute(text(create_incoming))
        connection.execute(text(create_incoming_items))

    try:
        columns = {column["name"] for column in inspect(engine).get_columns("incoming")}
    except Exception:
        columns = set()

    if "created_by_admin_id" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE incoming ADD COLUMN IF NOT EXISTS "
                    "created_by_admin_id INTEGER REFERENCES users(id)"
                )
            )


ensure_dispatch_columns()
ensure_incoming_tables()


def ensure_shop_order_item_columns():
    inspector = inspect(engine)
    try:
        columns = {column["name"] for column in inspector.get_columns("shop_order_items")}
    except Exception:
        return

    if "is_bonus" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE shop_order_items "
                    "ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN DEFAULT FALSE"
                )
            )
            connection.execute(
                text(
                    "UPDATE shop_order_items SET is_bonus = FALSE "
                    "WHERE is_bonus IS NULL"
                )
            )


ensure_shop_order_item_columns()


def ensure_shop_order_payment_columns():
    inspector = inspect(engine)
    try:
        columns = {column["name"] for column in inspector.get_columns("shop_order_payments")}
    except Exception:
        return

    statements = []
    if "total_goods_amount" not in columns:
        statements.append(
            "ALTER TABLE shop_order_payments ADD COLUMN IF NOT EXISTS total_goods_amount NUMERIC DEFAULT 0"
        )
    if "returns_amount" not in columns:
        statements.append(
            "ALTER TABLE shop_order_payments ADD COLUMN IF NOT EXISTS returns_amount NUMERIC DEFAULT 0"
        )
    if "payable_amount" not in columns:
        statements.append(
            "ALTER TABLE shop_order_payments ADD COLUMN IF NOT EXISTS payable_amount NUMERIC DEFAULT 0"
        )

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

        if "total_amount" in columns:
            connection.execute(
                text(
                    """
                    UPDATE shop_order_payments
                    SET total_goods_amount = COALESCE(total_amount, total_goods_amount, 0)
                    WHERE total_goods_amount IS NULL OR total_goods_amount = 0
                    """
                )
            )
        else:
            connection.execute(
                text(
                    """
                    UPDATE shop_order_payments
                    SET total_goods_amount = COALESCE(total_goods_amount, 0)
                    WHERE total_goods_amount IS NULL
                    """
                )
            )

        connection.execute(
            text(
                """
                UPDATE shop_order_payments
                SET returns_amount = COALESCE(returns_amount, 0)
                """
            )
        )

        connection.execute(
            text(
                """
                UPDATE shop_order_payments
                SET payable_amount = GREATEST(total_goods_amount - COALESCE(returns_amount, 0), 0)
                WHERE payable_amount IS NULL OR payable_amount < 0
                """
            )
        )

        connection.execute(
            text("ALTER TABLE shop_order_payments ALTER COLUMN total_goods_amount SET NOT NULL")
        )
        connection.execute(
            text("ALTER TABLE shop_order_payments ALTER COLUMN returns_amount SET NOT NULL")
        )
        connection.execute(
            text("ALTER TABLE shop_order_payments ALTER COLUMN payable_amount SET NOT NULL")
        )


ensure_shop_order_payment_columns()


def ensure_return_tables():
    create_returns = """
        CREATE TABLE IF NOT EXISTS returns (
            id SERIAL PRIMARY KEY,
            manager_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW()
        )
    """

    create_return_items = """
        CREATE TABLE IF NOT EXISTS return_items (
            id SERIAL PRIMARY KEY,
            return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER NOT NULL
        )
    """

    with engine.begin() as connection:
        connection.execute(text(create_returns))
        connection.execute(text(create_return_items))


ensure_return_tables()

app = FastAPI(title="Confectionery Management System")

ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://192.168.8.98:8080",  # TODO: replace with the active frontend origin if different
    "http://10.254.77.109:8080"
]

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def _to_float(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)
    if value is None:
        return 0.0
    return float(value)


def _to_optional_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    return _to_float(value)


def _to_decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    return Decimal(str(value))

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# Initialize admin user
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        admin = models.User(
            username="admin",
            password=get_password_hash("admin"),
            role="admin",
            full_name="Administrator",
            is_active=True
        )
        db.add(admin)
        db.commit()

# Auth endpoints
@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active"
        )
    
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name
    }

@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "role": current_user.role,
        "full_name": current_user.full_name
    }

# Products endpoints
@app.get("/products", response_model=List[schemas.Product])
def get_products(
    q: Optional[str] = Query(None),
    is_return: Optional[bool] = Query(None),
    main_only: bool = Query(False),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Product)

    archived_column = getattr(models.Product, "is_archived", None)
    if archived_column is not None:
        query = query.filter(archived_column.is_(False))

    if main_only:
        query = query.filter(models.Product.manager_id.is_(None))
    elif current_user.role == "admin":
        query = query.filter(models.Product.manager_id.is_(None))
    else:
        query = query.filter(models.Product.manager_id == current_user.id)

    if is_return is not None:
        query = query.filter(models.Product.is_return == is_return)
    else:
        query = query.filter(models.Product.is_return.is_(False))

    search = (q or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(models.Product.name.ilike(pattern))
        return query.order_by(models.Product.name.asc()).limit(50).all()

    return query.order_by(models.Product.name.asc()).limit(50).all()

@app.post("/products", response_model=schemas.Product)
def create_product(
    product: schemas.ProductCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только администратор может создавать товары")
    
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.put("/products/{product_id}", response_model=schemas.Product)
def update_product(
    product_id: int,
    product: schemas.ProductUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только администратор может обновлять товары")

    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.manager_id.is_(None)
    ).first()
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")

    update_data = product.dict(exclude_unset=True)
    if not update_data:
        return db_product

    for key, value in update_data.items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product

@app.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только администратор может удалять товары")

    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.manager_id.is_(None)
    ).first()
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")

    has_dispatches = db.query(models.Dispatch).filter(models.Dispatch.product_id == product_id).first()
    has_orders = db.query(models.Order).filter(models.Order.product_id == product_id).first()
    has_returns = db.execute(
        text("SELECT 1 FROM return_items WHERE product_id = :product_id LIMIT 1"),
        {"product_id": product_id},
    ).first()

    if has_dispatches or has_orders or has_returns:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя удалить товар, он участвует в операциях"
        )

    db.delete(db_product)
    db.commit()
    return {"message": "Товар удалён"}

@app.get("/shops", response_model=List[schemas.ShopOut])
def get_shops(
    manager_id: Optional[int] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    query = db.query(models.Shop)
    if manager_id is not None:
        query = query.filter(models.Shop.manager_id == manager_id)

    return query.order_by(models.Shop.created_at.desc()).all()


@app.get("/shops/me", response_model=List[schemas.ShopOut])
def get_my_shops(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    return (
        db.query(models.Shop)
        .filter(models.Shop.manager_id == current_user.id)
        .order_by(models.Shop.created_at.desc())
        .all()
    )


@app.post("/shops", response_model=schemas.ShopOut)
def create_shop(
    shop: schemas.ShopCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    if not shop.name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название обязательно")
    if not shop.refrigerator_number.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Номер холодильника обязателен")

    manager_name = current_user.full_name or current_user.username
    db_shop = models.Shop(
        **shop.dict(),
        manager_id=current_user.id,
        manager_name=manager_name,
    )
    db.add(db_shop)
    db.commit()
    db.refresh(db_shop)
    return db_shop


@app.put("/shops/{shop_id}", response_model=schemas.ShopOut)
def update_shop(
    shop_id: int,
    shop: schemas.ShopUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    db_shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not db_shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Магазин не найден")
    if db_shop.manager_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к магазину")

    update_data = shop.dict(exclude_unset=True)

    if "name" in update_data and not update_data["name"].strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название обязательно")
    if "refrigerator_number" in update_data and not update_data["refrigerator_number"].strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Номер холодильника обязателен")

    for key, value in update_data.items():
        setattr(db_shop, key, value)

    if not db_shop.manager_name:
        db_shop.manager_name = current_user.full_name or current_user.username

    db.commit()
    db.refresh(db_shop)
    return db_shop


@app.delete("/shops/{shop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shop(
    shop_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    db_shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not db_shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Магазин не найден")
    if db_shop.manager_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к магазину")

    db.delete(db_shop)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# Managers endpoints
@app.get("/managers", response_model=List[schemas.Manager])
def get_managers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(models.User).filter(models.User.role == "manager").all()

@app.post("/managers", response_model=schemas.Manager)
def create_manager(
    manager: schemas.ManagerCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing_user = db.query(models.User).filter(models.User.username == manager.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    db_manager = models.User(
        username=manager.username,
        password=get_password_hash(manager.password),
        role="manager",
        full_name=manager.full_name,
        is_active=manager.is_active
    )
    db.add(db_manager)
    db.commit()
    db.refresh(db_manager)
    return db_manager

@app.put("/managers/{manager_id}")
def update_manager(
    manager_id: int,
    manager: schemas.ManagerUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_manager = db.query(models.User).filter(models.User.id == manager_id, models.User.role == "manager").first()
    if not db_manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    if manager.full_name:
        db_manager.full_name = manager.full_name
    if manager.is_active is not None:
        db_manager.is_active = manager.is_active
    if manager.password:
        db_manager.password = get_password_hash(manager.password)
    
    db.commit()
    return {"message": "Manager updated"}

# Dispatch endpoints
def _attach_dispatch_items(db: Session, rows: Sequence[Dict[str, Any]]):
    dispatch_ids = [row["id"] for row in rows]
    items_map: Dict[int, List[Dict[str, Any]]] = {dispatch_id: [] for dispatch_id in dispatch_ids}

    if dispatch_ids:
        item_query = (
            text(
                """
                SELECT di.dispatch_id,
                       di.product_id,
                       di.quantity,
                       di.price,
                       COALESCE(p.name, '') AS product_name
                FROM dispatch_items di
                LEFT JOIN products p ON p.id = di.product_id
                WHERE di.dispatch_id IN :dispatch_ids
                ORDER BY p.name ASC, di.id ASC
                """
            )
            .bindparams(bindparam("dispatch_ids", expanding=True))
        )

        for item in db.execute(item_query, {"dispatch_ids": dispatch_ids}).mappings().all():
            items_map[item["dispatch_id"]].append(
                {
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "quantity": item["quantity"],
                    "price": float(item["price"]) if item["price"] is not None else 0.0,
                }
            )

    result: List[Dict[str, Any]] = []
    for row in rows:
        data = dict(row)
        data["items"] = items_map.get(row["id"], [])
        result.append(data)
    return result


def _fetch_dispatch(db: Session, dispatch_id: int) -> Optional[Dict[str, Any]]:
    dispatch_row = db.execute(
        text(
            """
            SELECT d.id,
                   d.manager_id,
                   COALESCE(u.full_name, u.username) AS manager_name,
                   COALESCE(d.status, 'pending') AS status,
                   d.created_at,
                   d.accepted_at
            FROM dispatches d
            LEFT JOIN users u ON u.id = d.manager_id
            WHERE d.id = :dispatch_id
            """
        ),
        {"dispatch_id": dispatch_id},
    ).mappings().first()

    if not dispatch_row:
        return None

    return _attach_dispatch_items(db, [dispatch_row])[0]


@app.post("/dispatch", response_model=schemas.DispatchOut)
def create_dispatch(
    dispatch: schemas.DispatchCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    manager = (
        db.query(models.User)
        .filter(models.User.id == dispatch.manager_id, models.User.role == "manager")
        .first()
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    if not dispatch.items:
        raise HTTPException(status_code=400, detail="Нет товаров для отправки")

    aggregated: Dict[int, Dict[str, Any]] = {}
    for item in dispatch.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Количество должно быть больше нуля")
        if item.price < 0:
            raise HTTPException(status_code=400, detail="Цена не может быть отрицательной")

        current = aggregated.setdefault(item.product_id, {"quantity": 0, "price": float(item.price)})
        current["quantity"] += item.quantity
        current["price"] = float(item.price)

    product_ids = list(aggregated.keys())
    archived_column = getattr(models.Product, "is_archived", None)

    products_query = db.query(models.Product.id, models.Product.quantity).filter(
        models.Product.id.in_(product_ids),
        models.Product.manager_id.is_(None),
        models.Product.is_return.is_(False),
    )
    if archived_column is not None:
        products_query = products_query.filter(archived_column.is_(False))

    products = products_query.all()
    found_ids = {row.id for row in products}
    missing_ids = [str(pid) for pid in product_ids if pid not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Product(s) not found in admin inventory: {', '.join(missing_ids)}",
        )

    availability = {row.id: row.quantity for row in products}
    insufficient: List[Dict[str, Any]] = []
    for product_id, data in aggregated.items():
        available = availability.get(product_id, 0)
        requested = data["quantity"]
        if requested > available:
            insufficient.append(
                {
                    "product_id": product_id,
                    "requested": requested,
                    "available": available,
                }
            )

    if insufficient:
        raise HTTPException(
            status_code=409,
            detail={"error": "INSUFFICIENT_STOCK", "items": insufficient},
        )

    validated_items: List[Dict[str, Any]] = [
        {"product_id": product_id, "quantity": data["quantity"], "price": data["price"]}
        for product_id, data in aggregated.items()
    ]

    now = datetime.now(timezone.utc)

    try:
        created = db.execute(
            text(
                """
                INSERT INTO dispatches (manager_id, status, created_at)
                VALUES (:manager_id, :status, :created_at)
                RETURNING id
                """
            ),
            {"manager_id": dispatch.manager_id, "status": "pending", "created_at": now},
        ).mappings().first()

        if not created:
            raise HTTPException(status_code=500, detail="Не удалось создать отправку")

        dispatch_id = created["id"]

        item_stmt = text(
            """
            INSERT INTO dispatch_items (dispatch_id, product_id, quantity, price)
            VALUES (:dispatch_id, :product_id, :quantity, :price)
            """
        )

        for item in validated_items:
            db.execute(
                item_stmt,
                {
                    "dispatch_id": dispatch_id,
                    "product_id": item["product_id"],
                    "quantity": item["quantity"],
                    "price": item["price"],
                },
            )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    dispatch_row = _fetch_dispatch(db, dispatch_id)
    if not dispatch_row:
        raise HTTPException(status_code=404, detail="Отправка не найдена")

    return dispatch_row


# Dispatch history and acceptance
@app.get("/dispatch", response_model=List[schemas.DispatchOut])
def list_dispatches(
    manager_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    params: Dict[str, Any] = {}
    base_query = """
        SELECT d.id,
               d.manager_id,
               COALESCE(u.full_name, u.username) AS manager_name,
               COALESCE(d.status, 'pending') AS status,
               d.created_at,
               d.accepted_at
        FROM dispatches d
        LEFT JOIN users u ON u.id = d.manager_id
        WHERE 1=1
    """

    if current_user.role == "manager":
        base_query += " AND d.manager_id = :current_manager_id"
        params["current_manager_id"] = current_user.id
    elif manager_id is not None:
        base_query += " AND d.manager_id = :manager_id"
        params["manager_id"] = manager_id

    if status_filter:
        base_query += " AND COALESCE(d.status, 'pending') = :status"
        params["status"] = status_filter

    base_query += " ORDER BY d.created_at DESC, d.id DESC"

    rows = db.execute(text(base_query), params).mappings().all()
    if not rows:
        return []

    return _attach_dispatch_items(db, rows)


@app.get("/dispatch/{dispatch_id}", response_model=schemas.DispatchOut)
def get_dispatch(
    dispatch_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dispatch_row = _fetch_dispatch(db, dispatch_id)
    if not dispatch_row:
        raise HTTPException(status_code=404, detail="Отправка не найдена")

    if current_user.role == "manager" and dispatch_row["manager_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к отправке")

    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    return dispatch_row


@app.post("/dispatch/{dispatch_id}/accept", response_model=schemas.DispatchOut)
def accept_dispatch(
    dispatch_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    dispatch_row = db.execute(
        text(
            """
            SELECT d.id,
                   d.manager_id,
                   COALESCE(d.status, 'pending') AS status
            FROM dispatches d
            WHERE d.id = :dispatch_id
            """
        ),
        {"dispatch_id": dispatch_id},
    ).mappings().first()

    if not dispatch_row:
        raise HTTPException(status_code=404, detail="Отправка не найдена")

    if dispatch_row["manager_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к отправке")

    status_value = dispatch_row["status"] or "pending"
    if status_value != "pending":
        raise HTTPException(status_code=400, detail="Отправка уже обработана")

    items = db.execute(
        text(
            """
            SELECT product_id, quantity, price
            FROM dispatch_items
            WHERE dispatch_id = :dispatch_id
            ORDER BY id
            """
        ),
        {"dispatch_id": dispatch_id},
    ).mappings().all()

    if not items:
        raise HTTPException(status_code=400, detail="У отправки нет позиций")

    archived_column = getattr(models.Product, "is_archived", None)
    missing: List[Dict[str, Any]] = []
    products_for_update: Dict[int, models.Product] = {}

    try:
        for item in items:
            product_query = db.query(models.Product).filter(
                models.Product.id == item["product_id"],
                models.Product.manager_id.is_(None),
                models.Product.is_return.is_(False),
            )
            if archived_column is not None:
                product_query = product_query.filter(archived_column.is_(False))

            product = product_query.with_for_update().first()

            if not product:
                raise HTTPException(status_code=404, detail=f"Товар {item['product_id']} не найден на складе")

            available = product.quantity
            required_qty = item["quantity"]
            if available < required_qty:
                missing.append(
                    {
                        "product_id": item["product_id"],
                        "required": required_qty,
                        "available": available,
                    }
                )

            products_for_update[item["product_id"]] = product

        if missing:
            raise HTTPException(status_code=409, detail=missing)

        for item in items:
            product = products_for_update[item["product_id"]]
            product.quantity -= item["quantity"]

            manager_product_query = db.query(models.Product).filter(
                models.Product.manager_id == current_user.id,
                models.Product.name == product.name,
                models.Product.is_return.is_(False),
            )
            if archived_column is not None:
                manager_product_query = manager_product_query.filter(archived_column.is_(False))

            manager_product = manager_product_query.first()
            price_value = float(item["price"]) if item["price"] is not None else product.price

            if manager_product:
                manager_product.quantity += item["quantity"]
                manager_product.price = price_value
            else:
                manager_product = models.Product(
                    name=product.name,
                    quantity=item["quantity"],
                    price=price_value,
                    manager_id=current_user.id,
                    is_return=False,
                )
                db.add(manager_product)

        accepted_at = datetime.now(timezone.utc)
        db.execute(
            text(
                """
                UPDATE dispatches
                SET status = 'sent', accepted_at = :accepted_at
                WHERE id = :dispatch_id
                """
            ),
            {"accepted_at": accepted_at, "dispatch_id": dispatch_id},
        )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    updated = _fetch_dispatch(db, dispatch_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Отправка не найдена")

    return updated

# Orders endpoints
@app.post("/orders")
def create_order(
    order: schemas.OrderCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check shop exists
    shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    for item in order.items:
        # Check product availability
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.manager_id == current_user.id
        ).first()
        
        if not product or product.quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient quantity for product {item.product_id}")
        
        # Deduct from manager inventory
        product.quantity -= item.quantity
        
        # Create order record
        db_order = models.Order(
            manager_id=current_user.id,
            shop_id=order.shop_id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=item.price,
            refrigerator_number=order.refrigerator_number
        )
        db.add(db_order)
    
    db.commit()
    return {"message": "Order created successfully"}

# Returns endpoints
@app.get("/manager/stock", response_model=List[schemas.ManagerStockItem])
def get_manager_stock(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    archived_column = getattr(models.Product, "is_archived", None)
    products_query = db.query(models.Product).filter(
        models.Product.manager_id == current_user.id,
        models.Product.is_return.is_(False),
    )
    if archived_column is not None:
        products_query = products_query.filter(archived_column.is_(False))

    products = products_query.order_by(models.Product.name.asc()).all()
    return [
        {
            "product_id": product.id,
            "name": product.name,
            "quantity": product.quantity,
            "price": product.price,
        }
        for product in products
    ]


def _fetch_shop_orders(
    db: Session,
    *,
    manager_id: Optional[int] = None,
    order_ids: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    query = db.query(models.ShopOrder).options(
        joinedload(models.ShopOrder.items).joinedload(models.ShopOrderItem.product),
        joinedload(models.ShopOrder.shop),
        joinedload(models.ShopOrder.payment),
    )

    if manager_id is not None:
        query = query.filter(models.ShopOrder.manager_id == manager_id)

    if order_ids is not None:
        query = query.filter(models.ShopOrder.id.in_(order_ids))

    orders = (
        query.order_by(models.ShopOrder.created_at.desc(), models.ShopOrder.id.desc())
        .all()
    )

    results: List[Dict[str, Any]] = []
    for order in orders:
        items = sorted(order.items, key=lambda item: item.id)
        results.append(
            {
                "id": order.id,
                "manager_id": order.manager_id,
                "shop_id": order.shop_id,
                "shop_name": order.shop.name if order.shop else "",
                "created_at": order.created_at,
                "items": [
                    {
                        "product_id": item.product_id,
                        "product_name": item.product.name if item.product else "",
                        "quantity": _to_float(item.quantity),
                        "price": _to_optional_float(item.price),
                        "is_bonus": bool(item.is_bonus),
                    }
                    for item in items
                ],
                "payment":
                    {
                        "total_goods_amount": _to_float(order.payment.total_goods_amount),
                        "returns_amount": _to_float(order.payment.returns_amount),
                        "payable_amount": _to_float(order.payment.payable_amount),
                        "paid_amount": _to_float(order.payment.paid_amount),
                        "debt_amount": _to_float(order.payment.debt_amount),
                    }
                    if order.payment
                    else None,
            }
        )

    return results


def _fetch_shop_returns(
    db: Session,
    *,
    manager_id: Optional[int] = None,
    return_ids: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    query = db.query(models.ShopReturn).options(
        joinedload(models.ShopReturn.items).joinedload(models.ShopReturnItem.product),
        joinedload(models.ShopReturn.shop),
    )

    if manager_id is not None:
        query = query.filter(models.ShopReturn.manager_id == manager_id)

    if return_ids is not None:
        query = query.filter(models.ShopReturn.id.in_(return_ids))

    returns = (
        query.order_by(models.ShopReturn.created_at.desc(), models.ShopReturn.id.desc())
        .all()
    )

    results: List[Dict[str, Any]] = []
    for return_doc in returns:
        items = sorted(return_doc.items, key=lambda item: item.id)
        results.append(
            {
                "id": return_doc.id,
                "manager_id": return_doc.manager_id,
                "shop_id": return_doc.shop_id,
                "shop_name": return_doc.shop.name if return_doc.shop else "",
                "created_at": return_doc.created_at,
                "items": [
                    {
                        "product_id": item.product_id,
                        "product_name": item.product.name if item.product else "",
                        "quantity": _to_float(item.quantity),
                    }
                    for item in items
                ],
            }
        )

    return results


def _get_day_bounds(target_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target_date, time_type.min)
    end = start + timedelta(days=1)
    return start, end


def _build_manager_daily_report(
    db: Session,
    *,
    manager_id: int,
    report_date: date,
) -> tuple[schemas.ManagerDailyReport, models.User]:
    manager = (
        db.query(models.User)
        .filter(models.User.id == manager_id, models.User.role == "manager")
        .first()
    )
    if manager is None:
        raise HTTPException(status_code=404, detail="Менеджер не найден")

    start, end = _get_day_bounds(report_date)

    dispatch_status = func.coalesce(models.Dispatch.status, literal("pending"))
    dispatch_timestamp = func.coalesce(models.Dispatch.accepted_at, models.Dispatch.created_at)

    received_total_raw = (
        db.query(func.coalesce(func.sum(models.Dispatch.quantity), 0))
        .filter(models.Dispatch.manager_id == manager.id)
        .filter(dispatch_status.in_(("sent", "accepted")))
        .filter(dispatch_timestamp >= start, dispatch_timestamp < end)
        .scalar()
        or 0
    )

    delivered_total_raw = (
        db.query(func.coalesce(func.sum(models.ShopOrderItem.quantity), 0))
        .join(models.ShopOrder, models.ShopOrderItem.order_id == models.ShopOrder.id)
        .filter(models.ShopOrder.manager_id == manager.id)
        .filter(models.ShopOrder.created_at >= start, models.ShopOrder.created_at < end)
        .scalar()
        or 0
    )

    return_to_main_total_raw = (
        db.query(func.coalesce(func.sum(models.ManagerReturnItem.quantity), 0))
        .join(models.ManagerReturn, models.ManagerReturnItem.return_id == models.ManagerReturn.id)
        .filter(models.ManagerReturn.manager_id == manager.id)
        .filter(models.ManagerReturn.created_at >= start, models.ManagerReturn.created_at < end)
        .scalar()
        or 0
    )

    return_from_shops_total_raw = (
        db.query(func.coalesce(func.sum(models.ShopReturnItem.quantity), 0))
        .join(models.ShopReturn, models.ShopReturnItem.return_id == models.ShopReturn.id)
        .filter(models.ShopReturn.manager_id == manager.id)
        .filter(models.ShopReturn.created_at >= start, models.ShopReturn.created_at < end)
        .scalar()
        or 0
    )

    deliveries_rows = (
        db.query(models.ShopOrder)
        .options(joinedload(models.ShopOrder.shop))
        .filter(models.ShopOrder.manager_id == manager.id)
        .filter(models.ShopOrder.created_at >= start, models.ShopOrder.created_at < end)
        .order_by(models.ShopOrder.created_at.asc(), models.ShopOrder.id.asc())
        .all()
    )

    returns_to_main_rows = (
        db.query(models.ManagerReturn)
        .filter(models.ManagerReturn.manager_id == manager.id)
        .filter(models.ManagerReturn.created_at >= start, models.ManagerReturn.created_at < end)
        .order_by(models.ManagerReturn.created_at.asc(), models.ManagerReturn.id.asc())
        .all()
    )

    returns_from_shops_rows = (
        db.query(models.ShopReturn)
        .options(joinedload(models.ShopReturn.shop))
        .filter(models.ShopReturn.manager_id == manager.id)
        .filter(models.ShopReturn.created_at >= start, models.ShopReturn.created_at < end)
        .order_by(models.ShopReturn.created_at.asc(), models.ShopReturn.id.asc())
        .all()
    )

    summary = schemas.ManagerDailySummary(
        received_total=_to_decimal(received_total_raw),
        delivered_total=_to_decimal(delivered_total_raw),
        return_to_main_total=_to_decimal(return_to_main_total_raw),
        return_from_shops_total=_to_decimal(return_from_shops_total_raw),
    )

    deliveries = [
        schemas.MovementRow(
            id=order.id,
            time=order.created_at,
            shop_name=order.shop.name if order.shop else None,
            type="delivery",
        )
        for order in deliveries_rows
    ]

    returns_to_main = [
        schemas.MovementRow(
            id=return_doc.id,
            time=return_doc.created_at,
            shop_name=None,
            type="return_to_main",
        )
        for return_doc in returns_to_main_rows
    ]

    returns_from_shops = [
        schemas.MovementRow(
            id=return_doc.id,
            time=return_doc.created_at,
            shop_name=return_doc.shop.name if return_doc.shop else None,
            type="return_from_shop",
        )
        for return_doc in returns_from_shops_rows
    ]

    report = schemas.ManagerDailyReport(
        date=report_date,
        summary=summary,
        deliveries=deliveries,
        returns_to_main=returns_to_main,
        returns_from_shops=returns_from_shops,
    )

    return report, manager


def _fetch_manager_returns(
    db: Session,
    *,
    manager_id: Optional[int] = None,
    return_ids: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    query = db.query(models.ManagerReturn).options(
        joinedload(models.ManagerReturn.items).joinedload(models.ManagerReturnItem.product)
    )

    if manager_id is not None:
        query = query.filter(models.ManagerReturn.manager_id == manager_id)

    if return_ids is not None:
        query = query.filter(models.ManagerReturn.id.in_(return_ids))

    returns = (
        query.order_by(models.ManagerReturn.created_at.desc(), models.ManagerReturn.id.desc())
        .all()
    )

    results: List[Dict[str, Any]] = []
    for return_doc in returns:
        items = sorted(return_doc.items, key=lambda item: item.id)
        results.append(
            {
                "id": return_doc.id,
                "manager_id": return_doc.manager_id,
                "created_at": return_doc.created_at,
                "items": [
                    {
                        "product_id": item.product_id,
                        "product_name": item.product.name if item.product else "",
                        "quantity": _to_float(item.quantity),
                    }
                    for item in items
                ],
            }
        )

    return results


@app.post("/returns", response_model=schemas.ReturnCreated)
def create_return(
    return_data: schemas.ReturnCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create returns")

    if not return_data.items:
        raise HTTPException(status_code=400, detail="Необходимо указать товары")

    aggregated: Dict[int, int] = {}
    for item in return_data.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Количество должно быть больше нуля")
        aggregated[item.product_id] = aggregated.get(item.product_id, 0) + item.quantity

    product_ids = list(aggregated.keys())
    archived_column = getattr(models.Product, "is_archived", None)
    now = datetime.now(timezone.utc)
    return_id: Optional[int] = None

    try:
        with db.begin():
            manager_products_query = db.query(models.Product).filter(
                models.Product.id.in_(product_ids),
                models.Product.manager_id == current_user.id,
                models.Product.is_return.is_(False),
            )
            if archived_column is not None:
                manager_products_query = manager_products_query.filter(archived_column.is_(False))

            manager_products = manager_products_query.with_for_update().all()
            manager_map = {product.id: product for product in manager_products}
            missing_ids = [str(pid) for pid in product_ids if pid not in manager_map]
            if missing_ids:
                raise HTTPException(
                    status_code=404,
                    detail=f"Товары не найдены в остатках менеджера: {', '.join(missing_ids)}",
                )

            for product_id, quantity in aggregated.items():
                available = manager_map[product_id].quantity
                if quantity > available:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Недостаточно остатка для товара {manager_map[product_id].name}",
                    )

            base_names = {manager_map[pid].name for pid in product_ids}
            base_query = db.query(models.Product).filter(
                models.Product.manager_id.is_(None),
                models.Product.is_return.is_(False),
                models.Product.name.in_(base_names),
            )
            if archived_column is not None:
                base_query = base_query.filter(archived_column.is_(False))

            base_products = base_query.with_for_update().all()
            base_map = {product.name: product for product in base_products}
            missing_base = [name for name in base_names if name not in base_map]
            if missing_base:
                raise HTTPException(
                    status_code=404,
                    detail=f"Не найден основной склад для товаров: {', '.join(missing_base)}",
                )

            created = db.execute(
                text(
                    """
                    INSERT INTO returns (manager_id, created_at)
                    VALUES (:manager_id, :created_at)
                    RETURNING id
                    """
                ),
                {"manager_id": current_user.id, "created_at": now},
            ).mappings().first()

            if not created:
                raise HTTPException(status_code=500, detail="Не удалось создать возврат")

            return_id = created["id"]

            item_stmt = text(
                """
                INSERT INTO return_items (return_id, product_id, quantity)
                VALUES (:return_id, :product_id, :quantity)
                """
            )

            for product_id, quantity in aggregated.items():
                manager_product = manager_map[product_id]
                base_product = base_map[manager_product.name]

                manager_product.quantity -= quantity
                base_product.quantity += quantity

                db.execute(
                    item_stmt,
                    {
                        "return_id": return_id,
                        "product_id": base_product.id,
                        "quantity": quantity,
                    },
                )
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Конфликт данных при сохранении возврата") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=400, detail="Ошибка базы данных") from exc

    return {"id": return_id, "created_at": now}


@app.get("/returns", response_model=List[schemas.ReturnListItem])
def list_returns(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    base_query = """
        SELECT r.id,
               r.manager_id,
               COALESCE(u.full_name, u.username) AS manager_name,
               r.created_at
        FROM returns r
        LEFT JOIN users u ON u.id = r.manager_id
        WHERE 1=1
    """
    params: Dict[str, Any] = {}

    if current_user.role == "manager":
        base_query += " AND r.manager_id = :manager_id"
        params["manager_id"] = current_user.id

    base_query += " ORDER BY r.created_at DESC, r.id DESC"

    rows = db.execute(text(base_query), params).mappings().all()
    return [dict(row) for row in rows]


@app.get("/returns/{return_id}", response_model=schemas.ReturnDetail)
def get_return_detail(
    return_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    header = db.execute(
        text(
            """
            SELECT r.id,
                   r.manager_id,
                   COALESCE(u.full_name, u.username) AS manager_name,
                   r.created_at
            FROM returns r
            LEFT JOIN users u ON u.id = r.manager_id
            WHERE r.id = :return_id
            """
        ),
        {"return_id": return_id},
    ).mappings().first()

    if not header:
        raise HTTPException(status_code=404, detail="Возврат не найден")

    if current_user.role == "manager" and header["manager_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к возврату")

    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    items = db.execute(
        text(
            """
            SELECT ri.product_id,
                   COALESCE(p.name, '') AS product_name,
                   ri.quantity
            FROM return_items ri
            LEFT JOIN products p ON p.id = ri.product_id
            WHERE ri.return_id = :return_id
            ORDER BY ri.id
            """
        ),
        {"return_id": return_id},
    ).mappings().all()

    return {
        "id": header["id"],
        "created_at": header["created_at"],
        "manager_id": header["manager_id"],
        "manager_name": header["manager_name"],
        "items": [dict(item) for item in items],
    }

# Incoming endpoints
@app.post("/incoming", response_model=schemas.IncomingCreated)
def create_incoming(
    incoming: schemas.IncomingCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create incoming")

    items: List[schemas.IncomingItemCreate] = []

    if incoming.items:
        items = incoming.items
    elif incoming.product_id is not None and incoming.quantity is not None:
        items = [
            schemas.IncomingItemCreate(
                product_id=incoming.product_id,
                quantity=incoming.quantity,
            )
        ]

    if not items:
        raise HTTPException(status_code=400, detail="Необходимо указать товары")

    aggregated: Dict[int, int] = {}
    for item in items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Количество должно быть больше 0")
        aggregated[item.product_id] = aggregated.get(item.product_id, 0) + int(item.quantity)

    product_ids = list(aggregated.keys())
    if not product_ids:
        raise HTTPException(status_code=400, detail="Необходимо указать товары")

    archived_column = getattr(models.Product, "is_archived", None)
    now = datetime.now(timezone.utc)
    incoming_id: Optional[int] = None

    try:
        products_query = db.query(models.Product).filter(
            models.Product.id.in_(product_ids),
            models.Product.manager_id.is_(None),
            models.Product.is_return.is_(False),
        )
        if archived_column is not None:
            products_query = products_query.filter(archived_column.is_(False))

        products = products_query.with_for_update().all()
        found_ids = {product.id for product in products}
        if len(found_ids) != len(product_ids):
            raise HTTPException(status_code=404, detail="Товар не найден")

        product_map = {product.id: product for product in products}

        incoming_row = models.Incoming(
            created_at=now,
            created_by_admin_id=current_user.id,
        )
        db.add(incoming_row)
        db.flush()

        incoming_id = incoming_row.id

        for product in products:
            product.quantity = (product.quantity or 0) + aggregated[product.id]

        for product_id, quantity in aggregated.items():
            product = product_map.get(product_id)
            if product is None:
                raise HTTPException(status_code=404, detail=f"Товар {product_id} не найден")

            price_at_time = product.price if product.price is not None else 0

            item_row = models.IncomingItem(
                incoming_id=incoming_id,
                product_id=product_id,
                quantity=quantity,
                price_at_time=price_at_time,
            )
            db.add(item_row)

        db.commit()
        db.refresh(incoming_row)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Database integrity error while creating incoming: {exc.orig}",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Ошибка базы данных при создании поступления: {exc}",
        ) from exc

    return {"id": incoming_id, "created_at": incoming_row.created_at}


@app.get("/incoming", response_model=List[schemas.IncomingListItem])
def list_incoming(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    result = db.execute(
        text("SELECT id, created_at FROM incoming ORDER BY created_at DESC, id DESC")
    )
    return [dict(row) for row in result.mappings()]


@app.get("/incoming/{incoming_id}", response_model=schemas.IncomingDetail)
def get_incoming_detail(
    incoming_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    header = db.execute(
        text("SELECT id, created_at FROM incoming WHERE id = :incoming_id"),
        {"incoming_id": incoming_id},
    ).mappings().first()

    if not header:
        raise HTTPException(status_code=404, detail="Поступление не найдено")

    items = db.execute(
        text(
            """
            SELECT ii.product_id,
                   COALESCE(p.name, '') AS product_name,
                   ii.quantity
            FROM incoming_items ii
            LEFT JOIN products p ON p.id = ii.product_id
            WHERE ii.incoming_id = :incoming_id
            ORDER BY ii.id
            """
        ),
        {"incoming_id": incoming_id},
    ).mappings().all()

    return {
        "id": header["id"],
        "created_at": header["created_at"],
        "items": [dict(item) for item in items],
    }

@app.get("/reports/manager/daily", response_model=schemas.ManagerDailyReport)
def get_manager_daily_report(
    report_date: date = Query(..., alias="date"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only manager can view this report")

    report, _ = _build_manager_daily_report(
        db,
        manager_id=current_user.id,
        report_date=report_date,
    )
    return report


@app.get("/reports/admin/daily", response_model=schemas.AdminDailyReport)
def get_admin_daily_report(
    manager_id: int = Query(...),
    report_date: date = Query(..., alias="date"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view this report")

    report, manager = _build_manager_daily_report(
        db,
        manager_id=manager_id,
        report_date=report_date,
    )
    manager_name = manager.full_name or manager.username
    return schemas.AdminDailyReport(
        manager_id=manager.id,
        manager_name=manager_name,
        **report.model_dump(),
    )


@app.get("/reports/admin/shop-period", response_model=schemas.AdminShopPeriodReport)
def get_admin_shop_period_report(
    shop_id: int = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view this report")

    if date_from > date_to:
        raise HTTPException(status_code=400, detail="Некорректный период")

    shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    range_start = datetime.combine(date_from, time_type.min)
    range_end = datetime.combine(date_to, time_type.min) + timedelta(days=1)

    price_expr = models.ShopOrderItem.quantity * func.coalesce(models.ShopOrderItem.price, 0)

    issued_total_raw = (
        db.query(func.coalesce(func.sum(price_expr), 0))
        .join(models.ShopOrder, models.ShopOrderItem.order_id == models.ShopOrder.id)
        .filter(models.ShopOrder.shop_id == shop_id)
        .filter(models.ShopOrder.created_at >= range_start, models.ShopOrder.created_at < range_end)
        .filter(models.ShopOrderItem.is_bonus.is_(False))
        .scalar()
        or 0
    )

    bonuses_total_raw = (
        db.query(func.coalesce(func.sum(price_expr), 0))
        .join(models.ShopOrder, models.ShopOrderItem.order_id == models.ShopOrder.id)
        .filter(models.ShopOrder.shop_id == shop_id)
        .filter(models.ShopOrder.created_at >= range_start, models.ShopOrder.created_at < range_end)
        .filter(models.ShopOrderItem.is_bonus.is_(True))
        .scalar()
        or 0
    )

    returns_total_raw = (
        db.query(func.coalesce(func.sum(models.ShopReturnItem.quantity), 0))
        .join(models.ShopReturn, models.ShopReturnItem.return_id == models.ShopReturn.id)
        .filter(models.ShopReturn.shop_id == shop_id)
        .filter(models.ShopReturn.created_at >= range_start, models.ShopReturn.created_at < range_end)
        .scalar()
        or 0
    )

    debt_total_raw = (
        db.query(func.coalesce(func.sum(models.ShopOrderPayment.debt_amount), 0))
        .join(models.ShopOrder, models.ShopOrderPayment.order_id == models.ShopOrder.id)
        .filter(models.ShopOrder.shop_id == shop_id)
        .filter(models.ShopOrder.created_at >= range_start, models.ShopOrder.created_at < range_end)
        .scalar()
        or 0
    )

    day_stats: Dict[date, Dict[str, Decimal]] = {}
    current_day = date_from
    while current_day <= date_to:
        day_stats[current_day] = {
            "issued_total": Decimal("0"),
            "returns_total": Decimal("0"),
            "bonuses_total": Decimal("0"),
            "debt_total": Decimal("0"),
        }
        current_day += timedelta(days=1)

    issued_by_day = (
        db.query(
            func.date(models.ShopOrder.created_at).label("day"),
            func.coalesce(func.sum(price_expr), 0).label("total"),
        )
        .join(models.ShopOrder, models.ShopOrderItem.order_id == models.ShopOrder.id)
        .filter(models.ShopOrder.shop_id == shop_id)
        .filter(models.ShopOrder.created_at >= range_start, models.ShopOrder.created_at < range_end)
        .filter(models.ShopOrderItem.is_bonus.is_(False))
        .group_by(func.date(models.ShopOrder.created_at))
        .all()
    )

    for row in issued_by_day:
        day = row.day
        if day in day_stats:
            day_stats[day]["issued_total"] = _to_decimal(row.total)

    bonuses_by_day = (
        db.query(
            func.date(models.ShopOrder.created_at).label("day"),
            func.coalesce(func.sum(price_expr), 0).label("total"),
        )
        .join(models.ShopOrder, models.ShopOrderItem.order_id == models.ShopOrder.id)
        .filter(models.ShopOrder.shop_id == shop_id)
        .filter(models.ShopOrder.created_at >= range_start, models.ShopOrder.created_at < range_end)
        .filter(models.ShopOrderItem.is_bonus.is_(True))
        .group_by(func.date(models.ShopOrder.created_at))
        .all()
    )

    for row in bonuses_by_day:
        day = row.day
        if day in day_stats:
            day_stats[day]["bonuses_total"] = _to_decimal(row.total)

    returns_by_day = (
        db.query(
            func.date(models.ShopReturn.created_at).label("day"),
            func.coalesce(func.sum(models.ShopReturnItem.quantity), 0).label("total"),
        )
        .join(models.ShopReturn, models.ShopReturnItem.return_id == models.ShopReturn.id)
        .filter(models.ShopReturn.shop_id == shop_id)
        .filter(models.ShopReturn.created_at >= range_start, models.ShopReturn.created_at < range_end)
        .group_by(func.date(models.ShopReturn.created_at))
        .all()
    )

    for row in returns_by_day:
        day = row.day
        if day in day_stats:
            day_stats[day]["returns_total"] = _to_decimal(row.total)

    debt_by_day = (
        db.query(
            func.date(models.ShopOrder.created_at).label("day"),
            func.coalesce(func.sum(models.ShopOrderPayment.debt_amount), 0).label("total"),
        )
        .join(models.ShopOrder, models.ShopOrderPayment.order_id == models.ShopOrder.id)
        .filter(models.ShopOrder.shop_id == shop_id)
        .filter(models.ShopOrder.created_at >= range_start, models.ShopOrder.created_at < range_end)
        .group_by(func.date(models.ShopOrder.created_at))
        .all()
    )

    for row in debt_by_day:
        day = row.day
        if day in day_stats:
            day_stats[day]["debt_total"] = _to_decimal(row.total)

    days = [
        schemas.ShopDayStat(
            date=day,
            issued_total=values["issued_total"],
            returns_total=values["returns_total"],
            bonuses_total=values["bonuses_total"],
            debt_total=values["debt_total"],
        )
        for day, values in sorted(day_stats.items())
    ]

    deliveries_rows = (
        db.query(
            models.ShopOrder.id,
            models.ShopOrder.created_at,
            models.Shop.name.label("shop_name"),
            models.User.full_name,
            models.User.username,
        )
        .join(models.Shop, models.Shop.id == models.ShopOrder.shop_id)
        .join(models.User, models.User.id == models.ShopOrder.manager_id)
        .filter(models.ShopOrder.shop_id == shop_id)
        .filter(models.ShopOrder.created_at >= range_start, models.ShopOrder.created_at < range_end)
        .order_by(models.ShopOrder.created_at.asc(), models.ShopOrder.id.asc())
        .all()
    )

    deliveries = [
        schemas.ShopDocumentRef(
            id=row.id,
            type="delivery",
            date=row.created_at,
            shop_name=row.shop_name or "",
            manager_name=(row.full_name or row.username or ""),
        )
        for row in deliveries_rows
    ]

    returns_rows = (
        db.query(
            models.ShopReturn.id,
            models.ShopReturn.created_at,
            models.Shop.name.label("shop_name"),
            models.User.full_name,
            models.User.username,
        )
        .join(models.Shop, models.Shop.id == models.ShopReturn.shop_id)
        .join(models.User, models.User.id == models.ShopReturn.manager_id)
        .filter(models.ShopReturn.shop_id == shop_id)
        .filter(models.ShopReturn.created_at >= range_start, models.ShopReturn.created_at < range_end)
        .order_by(models.ShopReturn.created_at.asc(), models.ShopReturn.id.asc())
        .all()
    )

    returns_from_shop = [
        schemas.ShopDocumentRef(
            id=row.id,
            type="return_from_shop",
            date=row.created_at,
            shop_name=row.shop_name or "",
            manager_name=(row.full_name or row.username or ""),
        )
        for row in returns_rows
    ]

    summary = schemas.AdminShopPeriodSummary(
        issued_total=_to_decimal(issued_total_raw),
        returns_total=_to_decimal(returns_total_raw),
        bonuses_total=_to_decimal(bonuses_total_raw),
        debt_total=_to_decimal(debt_total_raw),
    )

    return schemas.AdminShopPeriodReport(
        shop_id=shop.id,
        shop_name=shop.name,
        date_from=date_from,
        date_to=date_to,
        summary=summary,
        days=days,
        deliveries=deliveries,
        returns_from_shop=returns_from_shop,
    )


# Reports endpoints
@app.get("/reports/products")
def get_product_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    total_products = db.query(models.Product).filter(
        models.Product.manager_id.is_(None),
        models.Product.is_return == False
    ).count()
    
    total_returns = db.execute(
        text("SELECT COALESCE(SUM(quantity), 0) AS total FROM return_items")
    ).scalar() or 0
    
    dispatch_query = db.query(models.Dispatch).filter(text("COALESCE(dispatches.status, 'pending') = 'sent'"))
    if start_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at >= start_date)
    if end_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at <= end_date)
    
    dispatches = dispatch_query.all()
    total_dispatched = sum(d.quantity for d in dispatches)
    
    return {
        "total_products": total_products,
        "total_returns": total_returns,
        "total_dispatched": total_dispatched
    }

@app.get("/reports/manager/{manager_id}")
def get_manager_report(
    manager_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    dispatch_query = (
        db.query(models.Dispatch)
        .filter(models.Dispatch.manager_id == manager_id)
        .filter(text("COALESCE(dispatches.status, 'pending') = 'sent'"))
    )
    order_query = db.query(models.Order).filter(models.Order.manager_id == manager_id)
    returns_rows = db.execute(
        text(
            """
            SELECT ri.product_id,
                   ri.quantity,
                   r.created_at
            FROM returns r
            JOIN return_items ri ON ri.return_id = r.id
            WHERE r.manager_id = :manager_id
              AND (:start_date IS NULL OR r.created_at >= :start_date)
              AND (:end_date IS NULL OR r.created_at <= :end_date)
            ORDER BY r.created_at DESC, ri.id
            """
        ),
        {"manager_id": manager_id, "start_date": start_date, "end_date": end_date},
    ).mappings().all()
    
    if start_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at >= start_date)
        order_query = order_query.filter(models.Order.created_at >= start_date)
    if end_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at <= end_date)
        order_query = order_query.filter(models.Order.created_at <= end_date)

    dispatches = dispatch_query.all()
    orders = order_query.all()
    
    # Get product names for dispatches
    dispatches_with_names = []
    for d in dispatches:
        product = db.query(models.Product).filter(models.Product.id == d.product_id).first()
        dispatches_with_names.append({
            "id": d.id,
            "quantity": d.quantity,
            "price": d.price,
            "created_at": d.created_at,
            "product_name": product.name if product else "Unknown"
        })
    
    returns_with_products = []
    for row in returns_rows:
        product = db.query(models.Product).filter(models.Product.id == row["product_id"]).first()
        returns_with_products.append(
            {
                "product_id": row["product_id"],
                "quantity": row["quantity"],
                "created_at": row["created_at"],
                "product_name": product.name if product else "Unknown",
            }
        )

    return {
        "manager_id": manager_id,
        "total_received": sum(d.quantity for d in dispatches),
        "total_delivered": sum(o.quantity for o in orders),
        "total_returns": sum(item["quantity"] for item in returns_rows),
        "dispatches": dispatches_with_names,
        "orders": orders,
        "returns": returns_with_products,
    }

@app.get("/reports/manager-summary")
def get_manager_summary_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        managers = db.query(models.User).filter(models.User.role == "manager").all()
    else:
        managers = [current_user]
    
    summary = []
    for manager in managers:
        dispatch_query = (
            db.query(models.Dispatch)
            .filter(models.Dispatch.manager_id == manager.id)
            .filter(text("COALESCE(dispatches.status, 'pending') = 'sent'"))
        )
        order_query = db.query(models.Order).filter(models.Order.manager_id == manager.id)
        returns_rows = db.execute(
            text(
                """
                SELECT ri.quantity,
                       r.created_at
                FROM returns r
                JOIN return_items ri ON ri.return_id = r.id
                WHERE r.manager_id = :manager_id
                  AND (:start_date IS NULL OR r.created_at >= :start_date)
                  AND (:end_date IS NULL OR r.created_at <= :end_date)
                """
            ),
            {
                "manager_id": manager.id,
                "start_date": start_date,
                "end_date": end_date,
            },
        ).mappings().all()
        
        if start_date:
            dispatch_query = dispatch_query.filter(models.Dispatch.created_at >= start_date)
            order_query = order_query.filter(models.Order.created_at >= start_date)
        if end_date:
            dispatch_query = dispatch_query.filter(models.Dispatch.created_at <= end_date)
            order_query = order_query.filter(models.Order.created_at <= end_date)

        dispatches = dispatch_query.all()
        orders = order_query.all()
        
        summary.append({
            "manager_id": manager.id,
            "manager_name": manager.full_name,
            "total_received": sum(d.quantity for d in dispatches),
            "total_delivered": sum(o.quantity for o in orders),
            "total_returns": sum(row["quantity"] for row in returns_rows),
        })
    
    return summary

@app.get("/reports/returns")
def get_returns_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    manager_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    base_query = """
        SELECT r.id,
               r.created_at,
               r.manager_id,
               COALESCE(u.full_name, u.username) AS manager_name,
               COALESCE(u.username, '') AS manager_username,
               ri.product_id,
               ri.quantity
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        LEFT JOIN users u ON u.id = r.manager_id
        WHERE 1=1
    """
    params: Dict[str, Any] = {}

    if start_date:
        base_query += " AND r.created_at >= :start_date"
        params["start_date"] = start_date
    if end_date:
        base_query += " AND r.created_at <= :end_date"
        params["end_date"] = end_date
    if manager_id:
        base_query += " AND r.manager_id = :manager_id"
        params["manager_id"] = manager_id

    base_query += " ORDER BY r.created_at DESC, r.id DESC, ri.id"

    returns = db.execute(text(base_query), params).mappings().all()
    result = []
    
    for return_item in returns:
        product = db.query(models.Product).filter(models.Product.id == return_item["product_id"]).first()

        result.append({
            "id": return_item["id"],
            "created_at": return_item["created_at"].isoformat() if return_item["created_at"] else None,
            "manager_name": return_item["manager_name"],
            "manager_username": return_item["manager_username"],
            "shop_name": None,
            "product_name": product.name if product else "Unknown",
            "quantity": return_item["quantity"],
        })
    
    return result

@app.post("/shop-orders", response_model=schemas.ShopOrderOut)
def create_shop_order(
    order: schemas.ShopOrderCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    shop = (
        db.query(models.Shop)
        .filter(
            models.Shop.id == order.shop_id,
            models.Shop.manager_id == current_user.id,
        )
        .first()
    )
    if not shop:
        raise HTTPException(status_code=404, detail="Магазин не найден или не принадлежит менеджеру")

    if not order.items:
        raise HTTPException(status_code=400, detail="Необходимо указать товары")

    totals_by_product: Dict[int, int] = {}
    line_items: List[Dict[str, Any]] = []
    for item in order.items:
        quantity_decimal = Decimal(str(item.quantity))
        quantity_value = int(quantity_decimal)
        if quantity_value <= 0:
            raise HTTPException(status_code=400, detail="Количество должно быть больше нуля")

        price_value: Optional[Decimal] = None
        if item.price is not None:
            price_value = Decimal(str(item.price))
            if price_value < 0:
                raise HTTPException(status_code=400, detail="Цена не может быть отрицательной")

        totals_by_product[item.product_id] = totals_by_product.get(item.product_id, 0) + quantity_value
        line_items.append(
            {
                "product_id": item.product_id,
                "quantity": quantity_value,
                "price": price_value,
                "is_bonus": bool(getattr(item, "is_bonus", False)),
            }
        )

    product_ids = list(totals_by_product.keys())
    archived_column = getattr(models.Product, "is_archived", None)

    products_query = db.query(models.Product).filter(
        models.Product.id.in_(product_ids),
        models.Product.manager_id == current_user.id,
        models.Product.is_return.is_(False),
    )
    if archived_column is not None:
        products_query = products_query.filter(archived_column.is_(False))

    manager_products = products_query.with_for_update().all()
    manager_map = {product.id: product for product in manager_products}

    missing_ids = [str(pid) for pid in product_ids if pid not in manager_map]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Товары не найдены в остатках менеджера: {', '.join(missing_ids)}",
        )

    insufficient: List[Dict[str, Any]] = []
    for product_id, requested in totals_by_product.items():
        available = manager_map[product_id].quantity or 0
        if requested > available:
            insufficient.append(
                {
                    "product_id": product_id,
                    "requested": requested,
                    "available": available,
                }
            )

    if insufficient:
        raise HTTPException(
            status_code=409,
            detail={"error": "INSUFFICIENT_STOCK", "items": insufficient},
        )

    returns_amount = Decimal("0")
    if order.returns and order.returns.amount is not None:
        returns_amount = Decimal(str(order.returns.amount))
    if returns_amount < 0:
        raise HTTPException(status_code=400, detail="Сумма возврата не может быть отрицательной")

    paid_amount = Decimal(str(order.paid_amount))
    if paid_amount < 0:
        raise HTTPException(status_code=400, detail="Оплата не может быть отрицательной")

    now = datetime.now(timezone.utc)
    total_goods_amount = Decimal("0")
    total_bonus_amount = Decimal("0")

    try:
        order_row = models.ShopOrder(
            manager_id=current_user.id,
            shop_id=shop.id,
            created_at=now,
        )
        db.add(order_row)
        db.flush()

        for product_id, requested in totals_by_product.items():
            product = manager_map[product_id]
            product.quantity = (product.quantity or 0) - requested

        for item_data in line_items:
            product = manager_map[item_data["product_id"]]
            fallback_price = Decimal(str(product.price or 0))
            price_decimal = item_data["price"] if item_data["price"] is not None else fallback_price
            if price_decimal < 0:
                raise HTTPException(status_code=400, detail="Цена не может быть отрицательной")

            line_total = Decimal(str(item_data["quantity"])) * price_decimal
            if item_data["is_bonus"]:
                total_bonus_amount += line_total
            else:
                total_goods_amount += line_total

            db.add(
                models.ShopOrderItem(
                    order_id=order_row.id,
                    product_id=item_data["product_id"],
                    quantity=item_data["quantity"],
                    price=price_decimal,
                    is_bonus=item_data["is_bonus"],
                )
            )

        payable_amount = total_goods_amount - returns_amount
        if payable_amount < 0:
            payable_amount = Decimal("0")

        debt_amount = payable_amount - paid_amount
        if debt_amount < 0:
            debt_amount = Decimal("0")

        db.add(
            models.ShopOrderPayment(
                order_id=order_row.id,
                total_goods_amount=total_goods_amount,
                returns_amount=returns_amount,
                payable_amount=payable_amount,
                paid_amount=paid_amount,
                debt_amount=debt_amount,
                created_at=now,
            )
        )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    created_orders = _fetch_shop_orders(db, order_ids=[order_row.id])
    if not created_orders:
        raise HTTPException(status_code=500, detail="Не удалось получить созданный заказ")

    return created_orders[0]


@app.get("/shop-orders/{order_id}", response_model=schemas.ShopOrderDetail)
def get_shop_order_detail(
    order_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    order = (
        db.query(models.ShopOrder)
        .options(
            joinedload(models.ShopOrder.items).joinedload(models.ShopOrderItem.product),
            joinedload(models.ShopOrder.shop),
            joinedload(models.ShopOrder.manager),
        )
        .filter(models.ShopOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if current_user.role == "manager" and order.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра заказа")

    sorted_items = sorted(order.items, key=lambda item: item.id)
    total_quantity = Decimal("0")
    total_goods_amount = Decimal("0")
    total_bonus_quantity = Decimal("0")
    total_bonus_amount = Decimal("0")
    items: List[Dict[str, Any]] = []

    for item in sorted_items:
        quantity_decimal = Decimal(str(item.quantity))
        price_decimal = Decimal(str(item.price)) if item.price is not None else None
        effective_price = price_decimal or Decimal("0")
        line_total = quantity_decimal * effective_price
        total_quantity += quantity_decimal
        if item.is_bonus:
            total_bonus_quantity += quantity_decimal
            total_bonus_amount += line_total
        else:
            total_goods_amount += line_total

        items.append(
            {
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else "",
                "quantity": quantity_decimal,
                "price": price_decimal,
                "line_total": line_total,
                "is_bonus": bool(item.is_bonus),
            }
        )

    manager_name = ""
    if order.manager:
        manager_name = order.manager.full_name or order.manager.username or ""

    payment_data = None
    if order.payment:
        payment_data = schemas.ShopOrderPaymentOut(
            total_goods_amount=_to_decimal(order.payment.total_goods_amount),
            returns_amount=_to_decimal(order.payment.returns_amount),
            payable_amount=_to_decimal(order.payment.payable_amount),
            paid_amount=_to_decimal(order.payment.paid_amount),
            debt_amount=_to_decimal(order.payment.debt_amount),
        )

    return schemas.ShopOrderDetail(
        id=order.id,
        manager_id=order.manager_id,
        manager_name=manager_name,
        shop_id=order.shop_id,
        shop_name=order.shop.name if order.shop else "",
        created_at=order.created_at,
        total_quantity=total_quantity,
        total_goods_amount=total_goods_amount,
        total_bonus_quantity=total_bonus_quantity,
        total_bonus_amount=total_bonus_amount,
        items=items,
        payment=payment_data,
    )


@app.get("/shop-orders", response_model=List[schemas.ShopOrderOut])
def list_shop_orders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    return _fetch_shop_orders(db, manager_id=current_user.id)


@app.post("/shop-returns", response_model=schemas.ShopReturnOut)
def create_shop_return(
    payload: schemas.ShopReturnCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    shop = (
        db.query(models.Shop)
        .filter(
            models.Shop.id == payload.shop_id,
            models.Shop.manager_id == current_user.id,
        )
        .first()
    )
    if not shop:
        raise HTTPException(status_code=404, detail="Магазин не найден или не принадлежит менеджеру")

    if not payload.items:
        raise HTTPException(status_code=400, detail="Необходимо указать товары")

    aggregated: Dict[int, int] = {}
    for item in payload.items:
        quantity_value = int(item.quantity)
        if quantity_value <= 0:
            raise HTTPException(status_code=400, detail="Количество должно быть больше нуля")
        aggregated[item.product_id] = aggregated.get(item.product_id, 0) + quantity_value

    product_ids = list(aggregated.keys())
    archived_column = getattr(models.Product, "is_archived", None)

    products_query = db.query(models.Product).filter(
        models.Product.id.in_(product_ids),
        models.Product.manager_id == current_user.id,
        models.Product.is_return.is_(False),
    )
    if archived_column is not None:
        products_query = products_query.filter(archived_column.is_(False))

    manager_products = products_query.all()
    manager_map = {product.id: product for product in manager_products}

    missing_ids = [str(pid) for pid in product_ids if pid not in manager_map]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Товары не найдены в остатках менеджера: {', '.join(missing_ids)}",
        )

    try:
        return_row = models.ShopReturn(
            manager_id=current_user.id,
            shop_id=shop.id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(return_row)
        db.flush()

        for product_id, quantity in aggregated.items():
            db.add(
                models.ShopReturnItem(
                    return_id=return_row.id,
                    product_id=product_id,
                    quantity=quantity,
                )
            )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    created_returns = _fetch_shop_returns(db, return_ids=[return_row.id])
    if not created_returns:
        raise HTTPException(status_code=500, detail="Не удалось получить созданный возврат")

    return created_returns[0]


@app.get("/shop-returns/{return_id}", response_model=schemas.ShopReturnDetail)
def get_shop_return_detail(
    return_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    return_doc = (
        db.query(models.ShopReturn)
        .options(
            joinedload(models.ShopReturn.items).joinedload(models.ShopReturnItem.product),
            joinedload(models.ShopReturn.shop),
            joinedload(models.ShopReturn.manager),
        )
        .filter(models.ShopReturn.id == return_id)
        .first()
    )

    if not return_doc:
        raise HTTPException(status_code=404, detail="Возврат не найден")

    if current_user.role == "manager" and return_doc.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра возврата")

    sorted_items = sorted(return_doc.items, key=lambda item: item.id)
    items: List[Dict[str, Any]] = []
    for item in sorted_items:
        quantity_decimal = Decimal(str(item.quantity))
        items.append(
            {
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else "",
                "quantity": quantity_decimal,
            }
        )

    manager_name = ""
    if return_doc.manager:
        manager_name = return_doc.manager.full_name or return_doc.manager.username or ""

    return schemas.ShopReturnDetail(
        id=return_doc.id,
        manager_id=return_doc.manager_id,
        manager_name=manager_name,
        shop_id=return_doc.shop_id,
        shop_name=return_doc.shop.name if return_doc.shop else "",
        created_at=return_doc.created_at,
        items=items,
    )


@app.get("/shop-returns", response_model=List[schemas.ShopReturnOut])
def list_shop_returns(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    return _fetch_shop_returns(db, manager_id=current_user.id)


@app.post("/manager-returns", response_model=schemas.ManagerReturnCreated)
def create_manager_return(
    payload: schemas.ManagerReturnCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    if not payload.items:
        raise HTTPException(status_code=400, detail="Необходимо указать товары")

    aggregated: Dict[int, int] = {}
    for item in payload.items:
        quantity_value = int(item.quantity)
        if quantity_value <= 0:
            raise HTTPException(status_code=400, detail="Количество должно быть больше нуля")
        aggregated[item.product_id] = aggregated.get(item.product_id, 0) + quantity_value

    product_ids = list(aggregated.keys())
    archived_column = getattr(models.Product, "is_archived", None)

    products_query = db.query(models.Product).filter(
        models.Product.id.in_(product_ids),
        models.Product.manager_id == current_user.id,
        models.Product.is_return.is_(False),
    )
    if archived_column is not None:
        products_query = products_query.filter(archived_column.is_(False))

    manager_products = products_query.with_for_update().all()
    manager_map = {product.id: product for product in manager_products}

    missing_ids = [str(pid) for pid in product_ids if pid not in manager_map]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Товары не найдены в остатках менеджера: {', '.join(missing_ids)}",
        )

    insufficient: List[Dict[str, Any]] = []
    for product_id, quantity in aggregated.items():
        available = manager_map[product_id].quantity or 0
        if quantity > available:
            insufficient.append(
                {
                    "product_id": product_id,
                    "requested": quantity,
                    "available": available,
                }
            )

    if insufficient:
        raise HTTPException(
            status_code=409,
            detail={"error": "INSUFFICIENT_STOCK", "items": insufficient},
        )

    product_names = {manager_map[pid].name for pid in product_ids}
    base_query = db.query(models.Product).filter(
        models.Product.manager_id.is_(None),
        models.Product.is_return.is_(False),
        models.Product.name.in_(product_names),
    )
    if archived_column is not None:
        base_query = base_query.filter(archived_column.is_(False))

    base_products = base_query.with_for_update().all()
    base_map = {product.name: product for product in base_products}

    missing_base = [name for name in product_names if name not in base_map]
    if missing_base:
        raise HTTPException(
            status_code=404,
            detail=f"Не найден основной склад для товаров: {', '.join(missing_base)}",
        )

    now = datetime.now(timezone.utc)

    try:
        return_row = models.ManagerReturn(
            manager_id=current_user.id,
            created_at=now,
        )
        db.add(return_row)
        db.flush()

        for product_id, quantity in aggregated.items():
            manager_product = manager_map[product_id]
            base_product = base_map[manager_product.name]

            manager_product.quantity = (manager_product.quantity or 0) - quantity
            base_product.quantity = (base_product.quantity or 0) + quantity

            db.add(
                models.ManagerReturnItem(
                    return_id=return_row.id,
                    product_id=base_product.id,
                    quantity=quantity,
                )
            )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    return schemas.ManagerReturnCreated(id=return_row.id, created_at=return_row.created_at)


@app.get("/manager-returns/{return_id}", response_model=schemas.ManagerReturnDetail)
def get_manager_return_detail(
    return_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    return_doc = (
        db.query(models.ManagerReturn)
        .options(
            joinedload(models.ManagerReturn.items).joinedload(models.ManagerReturnItem.product),
            joinedload(models.ManagerReturn.manager),
        )
        .filter(models.ManagerReturn.id == return_id)
        .first()
    )

    if not return_doc:
        raise HTTPException(status_code=404, detail="Возврат не найден")

    if current_user.role == "manager" and return_doc.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра возврата")

    sorted_items = sorted(return_doc.items, key=lambda item: item.id)
    items: List[Dict[str, Any]] = []
    for item in sorted_items:
        quantity_decimal = Decimal(str(item.quantity))
        items.append(
            {
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else "",
                "quantity": quantity_decimal,
            }
        )

    manager_name = ""
    if return_doc.manager:
        manager_name = return_doc.manager.full_name or return_doc.manager.username or ""

    return schemas.ManagerReturnDetail(
        id=return_doc.id,
        manager_id=return_doc.manager_id,
        manager_name=manager_name,
        created_at=return_doc.created_at,
        items=items,
    )


@app.get("/manager-returns", response_model=List[schemas.ManagerReturnOut])
def list_manager_returns(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    manager_id: Optional[int] = None
    if current_user.role == "manager":
        manager_id = current_user.id

    return _fetch_manager_returns(db, manager_id=manager_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

