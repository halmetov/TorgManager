from fastapi import FastAPI, Depends, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence
import os
import secrets
import models
import schemas
from database import engine, get_db
from sqlalchemy import inspect, text, bindparam
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
            created_at TIMESTAMP DEFAULT NOW()
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


ensure_dispatch_columns()
ensure_incoming_tables()

app = FastAPI(title="Confectionery Management System")

ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://192.168.8.98:8080",  # TODO: replace with the active frontend origin if different
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

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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

    if q not in (None, ""):
        query = query.filter(models.Product.name.ilike(f"%{q}%"))
        return query.order_by(models.Product.name.asc()).limit(50).all()

    query = query.order_by(models.Product.name.asc()).limit(50)
    return query.all()

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
    has_returns = db.query(models.Return).filter(models.Return.product_id == product_id).first()

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

    validated_items: List[Dict[str, Any]] = []
    archived_column = getattr(models.Product, "is_archived", None)

    for product_id, data in aggregated.items():
        product_query = db.query(models.Product).filter(
            models.Product.id == product_id,
            models.Product.manager_id.is_(None),
            models.Product.is_return.is_(False),
        )
        if archived_column is not None:
            product_query = product_query.filter(archived_column.is_(False))

        product = product_query.first()
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product {product_id} not found in admin inventory",
            )

        validated_items.append(
            {
                "product_id": product_id,
                "quantity": data["quantity"],
                "price": data["price"],
            }
        )

    now = datetime.utcnow()

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

        accepted_at = datetime.utcnow()
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
@app.post("/returns")
def create_return(
    return_data: schemas.ReturnCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create returns")
    
    for item in return_data.items:
        # Get product info
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.manager_id == current_user.id
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found in your inventory")
        
        if product.quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient quantity for product {product.name}")
        
        # Deduct from manager's regular inventory
        product.quantity -= item.quantity
        
        # Find or create return product in manager's inventory
        return_product = db.query(models.Product).filter(
            models.Product.name == product.name,
            models.Product.manager_id == current_user.id,
            models.Product.is_return == True
        ).first()
        
        if return_product:
            return_product.quantity += item.quantity
        else:
            return_product = models.Product(
                name=product.name,
                quantity=item.quantity,
                price=product.price,
                manager_id=current_user.id,
                is_return=True
            )
            db.add(return_product)
        
        # Create return record for admin reports
        db_return = models.Return(
            manager_id=current_user.id,
            shop_id=return_data.shop_id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(db_return)
    
    db.commit()
    return {"message": "Return created successfully"}

# Incoming endpoints
@app.post("/incoming", response_model=schemas.IncomingCreated)
def create_incoming(
    incoming: schemas.IncomingCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create incoming")

    if not incoming.items:
        raise HTTPException(status_code=400, detail="Необходимо указать товары")

    now = datetime.utcnow()
    incoming_id: Optional[int] = None

    try:
        with db.begin():
            result = db.execute(
                text(
                    "INSERT INTO incoming (created_at, created_by_admin_id) "
                    "VALUES (:created_at, :created_by_admin_id) RETURNING id"
                ),
                {"created_at": now, "created_by_admin_id": current_user.id},
            )
            incoming_id = result.scalar_one()

            for item in incoming.items:
                if item.quantity <= 0:
                    raise HTTPException(status_code=400, detail="Количество должно быть больше нуля")

                product = (
                    db.query(models.Product)
                    .filter(
                        models.Product.id == item.product_id,
                        models.Product.manager_id.is_(None),
                    )
                    .with_for_update()
                    .first()
                )

                if not product:
                    raise HTTPException(status_code=400, detail=f"Товар {item.product_id} не найден")

                product.quantity += item.quantity

                db.execute(
                    text(
                        """
                        INSERT INTO incoming_items (incoming_id, product_id, quantity)
                        VALUES (:incoming_id, :product_id, :quantity)
                        """
                    ),
                    {
                        "incoming_id": incoming_id,
                        "product_id": item.product_id,
                        "quantity": item.quantity,
                    },
                )
    except HTTPException:
        raise
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Database constraint error")
    except SQLAlchemyError:
        raise HTTPException(status_code=400, detail="Database error")

    return {"id": incoming_id, "created_at": now}


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
    
    total_returns = db.query(models.Return).count()
    
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
    return_query = db.query(models.Return).filter(models.Return.manager_id == manager_id)
    
    if start_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at >= start_date)
        order_query = order_query.filter(models.Order.created_at >= start_date)
        return_query = return_query.filter(models.Return.created_at >= start_date)
    if end_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at <= end_date)
        order_query = order_query.filter(models.Order.created_at <= end_date)
        return_query = return_query.filter(models.Return.created_at <= end_date)
    
    dispatches = dispatch_query.all()
    orders = order_query.all()
    returns = return_query.all()
    
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
    
    return {
        "manager_id": manager_id,
        "total_received": sum(d.quantity for d in dispatches),
        "total_delivered": sum(o.quantity for o in orders),
        "total_returns": sum(r.quantity for r in returns),
        "dispatches": dispatches_with_names,
        "orders": orders,
        "returns": returns
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
        return_query = db.query(models.Return).filter(models.Return.manager_id == manager.id)
        
        if start_date:
            dispatch_query = dispatch_query.filter(models.Dispatch.created_at >= start_date)
            order_query = order_query.filter(models.Order.created_at >= start_date)
            return_query = return_query.filter(models.Return.created_at >= start_date)
        if end_date:
            dispatch_query = dispatch_query.filter(models.Dispatch.created_at <= end_date)
            order_query = order_query.filter(models.Order.created_at <= end_date)
            return_query = return_query.filter(models.Return.created_at <= end_date)
        
        dispatches = dispatch_query.all()
        orders = order_query.all()
        returns = return_query.all()
        
        summary.append({
            "manager_id": manager.id,
            "manager_name": manager.full_name,
            "total_received": sum(d.quantity for d in dispatches),
            "total_delivered": sum(o.quantity for o in orders),
            "total_returns": sum(r.quantity for r in returns)
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
    
    query = db.query(models.Return)
    
    if start_date:
        query = query.filter(models.Return.created_at >= start_date)
    if end_date:
        query = query.filter(models.Return.created_at <= end_date)
    if manager_id:
        query = query.filter(models.Return.manager_id == manager_id)
    
    returns = query.order_by(models.Return.created_at.desc()).all()
    result = []
    
    for return_item in returns:
        manager = db.query(models.User).filter(models.User.id == return_item.manager_id).first()
        shop = db.query(models.Shop).filter(models.Shop.id == return_item.shop_id).first()
        product = db.query(models.Product).filter(models.Product.id == return_item.product_id).first()
        
        result.append({
            "id": return_item.id,
            "created_at": return_item.created_at.isoformat(),
            "manager_name": manager.full_name if manager else "Unknown",
            "manager_username": manager.username if manager else "Unknown",
            "shop_name": shop.name if shop else "Unknown",
            "product_name": product.name if product else "Unknown",
            "quantity": return_item.quantity
        })
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
