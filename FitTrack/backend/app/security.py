
import os
import bcrypt

from pathlib import Path
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import jwt, JWTError

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.orm import Session

from .database import get_db
from .models import User


# Load environment variables from backend/.env
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


# JWT configuration
SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "local-dev-only-change-this-secret"
)

ALGORITHM = "HS256"

TOKEN_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)


# Prevent use of the default secret in production
if (
    SECRET_KEY == "local-dev-only-change-this-secret"
    and os.getenv("ENVIRONMENT") == "production"
):
    raise RuntimeError(
        "Set a strong SECRET_KEY in backend/.env before production."
    )


# Swagger OAuth2 configuration
# Must match the endpoint in main.py
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/token"
)


# Password hashing
def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty.")

    if len(password.encode("utf-8")) > 72:
        raise ValueError(
            "Password cannot be longer than 72 bytes."
        )

    hashed_password = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    )

    return hashed_password.decode("utf-8")


# Password verification
def verify_password(
    password: str,
    hashed: str
) -> bool:

    if not password or not hashed:
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            hashed.encode("utf-8")
        )

    except (ValueError, TypeError):
        return False


# Create JWT access token
def create_access_token(user_id: int) -> str:

    expires = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token


# Get currently authenticated user
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={
            "WWW-Authenticate": "Bearer"
        }
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = int(payload.get("sub", ""))

    except (JWTError, ValueError, TypeError):
        raise credentials_error

    user = db.get(User, user_id)

    if user is None:
        raise credentials_error

    return user
