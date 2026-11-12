from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict

Category = Literal["Cardio", "Strength", "Yoga"]
GoalType = Literal["Weight Loss", "Muscle Gain", "Steps"]

class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
class UserOut(BaseModel):
    id: int; username: str; email: EmailStr; created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class TokenOut(BaseModel):
    access_token: str; token_type: str = "bearer"; user: UserOut
class WorkoutIn(BaseModel):
    workout_name: str = Field(min_length=2, max_length=100)
    category: Category
    duration: int = Field(gt=0, le=1440)
    calories_burned: int = Field(ge=0, le=10000)
    workout_date: date
class WorkoutOut(WorkoutIn):
    id: int; user_id: int; created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class GoalIn(BaseModel):
    goal_type: GoalType; target_value: float = Field(gt=0); current_value: float = Field(ge=0); deadline: date
class GoalUpdate(BaseModel):
    current_value: float = Field(ge=0)
class GoalOut(GoalIn):
    id: int; user_id: int; status: str; created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class NotificationOut(BaseModel):
    id: int; title: str; message: str; is_read: bool; created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class PlanIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=1000)
    scheduled_date: date
class PlanOut(PlanIn):
    id: int; user_id: int; created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class ExerciseOut(BaseModel):
    id: int; name: str; category: Category; description: str; duration: int
    model_config = ConfigDict(from_attributes=True)
