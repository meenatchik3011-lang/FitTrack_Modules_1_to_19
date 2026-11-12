
from datetime import date, datetime, timedelta
from datetime import date as Date

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Query
)
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import Base, engine, get_db
from . import models, schemas
from .security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)


# --------------------------------------------------
# DATABASE AND APPLICATION
# --------------------------------------------------

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FitTrack API",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# --------------------------------------------------
# DEFAULT EXERCISES AND BADGES
# --------------------------------------------------

DEFAULT_EXERCISES = [
    ("Running", "Cardio", "Steady outdoor or treadmill running.", 30),
    ("Cycling", "Cardio", "Ride at a comfortable, consistent pace.", 30),
    ("Jump Rope", "Cardio", "Short intervals of skipping.", 15),
    ("Push-ups", "Strength", "Bodyweight upper-body pushing exercise.", 10),
    ("Squats", "Strength", "Bodyweight lower-body strength exercise.", 15),
    ("Plank", "Strength", "Core stability hold.", 5),
    ("Sun Salutation", "Yoga", "Flow through a sequence of yoga poses.", 15),
    ("Child's Pose", "Yoga", "Restorative yoga stretch.", 5),
    ("Warrior Pose", "Yoga", "Standing balance and strength pose.", 8),
]

DEFAULT_BADGES = [
    ("First Workout", "Log your first workout.", "🏁"),
    ("Workout Explorer", "Complete 10 workouts.", "💪"),
    ("Consistency 3", "Maintain a 3-day workout streak.", "🔥"),
    ("Consistency 7", "Maintain a 7-day workout streak.", "🏆"),
    ("Goal Achiever", "Complete a fitness goal.", "🎯"),
]


def seed_reference_data(db: Session):
    for name, category, description, duration in DEFAULT_EXERCISES:
        if not db.query(models.Exercise).filter_by(name=name).first():
            db.add(
                models.Exercise(
                    name=name,
                    category=category,
                    description=description,
                    duration=duration
                )
            )

    for name, description, icon in DEFAULT_BADGES:
        if not db.query(models.Badge).filter_by(name=name).first():
            db.add(
                models.Badge(
                    name=name,
                    description=description,
                    icon=icon
                )
            )

    db.commit()


@app.on_event("startup")
def startup_seed():
    db = next(get_db())
    try:
        seed_reference_data(db)
    finally:
        db.close()


# --------------------------------------------------
# COMMON FUNCTIONS
# --------------------------------------------------

def notify(db, user_id, title, message):
    db.add(
        models.Notification(
            user_id=user_id,
            title=title,
            message=message
        )
    )


def award_badge(db, user_id, name):
    badge = db.query(models.Badge).filter_by(name=name).first()

    if not badge:
        return

    exists = db.query(models.UserBadge).filter_by(
        user_id=user_id,
        badge_id=badge.id
    ).first()

    if not exists:
        db.add(
            models.UserBadge(
                user_id=user_id,
                badge_id=badge.id
            )
        )

        notify(
            db,
            user_id,
            "Achievement unlocked",
            f"{badge.icon} {badge.name}: {badge.description}"
        )


def refresh_streak(db, user_id):
    workout_dates = [
        r[0]
        for r in db.query(
            models.Workout.workout_date
        )
        .filter_by(user_id=user_id)
        .distinct()
        .order_by(models.Workout.workout_date)
        .all()
    ]

    current = 0
    longest = 0
    previous = None

    for workout_day in workout_dates:
        if previous and workout_day == previous + timedelta(days=1):
            current += 1
        else:
            current = 1

        longest = max(longest, current)
        previous = workout_day

    today = date.today()

    if not workout_dates or workout_dates[-1] < today - timedelta(days=1):
        current = 0

    last = workout_dates[-1] if workout_dates else None

    row = db.query(models.Streak).filter_by(
        user_id=user_id
    ).first()

    if not row:
        row = models.Streak(user_id=user_id)
        db.add(row)

    row.current_streak = current
    row.longest_streak = longest
    row.last_workout_date = last

    if len(workout_dates) >= 1:
        award_badge(db, user_id, "First Workout")

    # Count every saved workout record, not only distinct workout dates.
    total_workouts = db.query(models.Workout).filter_by(
        user_id=user_id
    ).count()

    if total_workouts >= 10:
        award_badge(db, user_id, "Workout Explorer")

    # Also award this badge if the user already has a completed goal.
    completed_goal = db.query(models.Goal).filter_by(
        user_id=user_id,
        status="COMPLETED"
    ).first()

    if completed_goal:
        award_badge(db, user_id, "Goal Achiever")

    if current >= 3:
        award_badge(db, user_id, "Consistency 3")

    if current >= 7:
        award_badge(db, user_id, "Consistency 7")

    db.commit()

    return row


# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "FitTrack API is running",
        "version": "2.0.0",
        "docs": "/docs"
    }


# ==================================================
# MODULE 1 - AUTHENTICATION
# ==================================================

@app.post(
    "/api/auth/register",
    response_model=schemas.UserOut,
    status_code=201
)
def register(
    data: schemas.RegisterIn,
    db: Session = Depends(get_db)
):
    existing = db.query(models.User).filter(
        (models.User.email == data.email) |
        (models.User.username == data.username)
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Email or username already registered"
        )

    user = models.User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password)
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# Existing React JSON login - retained
@app.post(
    "/api/auth/login",
    response_model=schemas.TokenOut
)
def login(
    data: schemas.LoginIn,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter_by(
        email=data.email
    ).first()

    if not user or not verify_password(
        data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    return {
        "access_token": create_access_token(user.id),
        "user": user
    }


# Separate Swagger OAuth2 login
@app.post("/api/auth/token")
def swagger_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter_by(
        email=form_data.username
    ).first()

    if not user or not verify_password(
        form_data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer"
    }


@app.get(
    "/api/auth/me",
    response_model=schemas.UserOut
)
def me(user=Depends(get_current_user)):
    return user


# ==================================================
# MODULE 2 - WORKOUT MANAGEMENT
# ==================================================

@app.post(
    "/api/workouts",
    response_model=schemas.WorkoutOut,
    status_code=201
)
def add_workout(
    data: schemas.WorkoutIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    item = models.Workout(
        **data.model_dump(),
        user_id=user.id
    )

    db.add(item)
    db.commit()

    refresh_streak(db, user.id)

    db.refresh(item)

    return item


@app.get(
    "/api/workouts",
    response_model=list[schemas.WorkoutOut]
)
def list_workouts(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return (
        db.query(models.Workout)
        .filter_by(user_id=user.id)
        .order_by(models.Workout.workout_date.desc())
        .all()
    )


@app.put(
    "/api/workouts/{workout_id}",
    response_model=schemas.WorkoutOut
)
def edit_workout(
    workout_id: int,
    data: schemas.WorkoutIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    item = db.query(models.Workout).filter_by(
        id=workout_id,
        user_id=user.id
    ).first()

    if not item:
        raise HTTPException(404, "Workout not found")

    for key, value in data.model_dump().items():
        setattr(item, key, value)

    db.commit()

    refresh_streak(db, user.id)

    db.refresh(item)

    return item


@app.delete("/api/workouts/{workout_id}")
def delete_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    item = db.query(models.Workout).filter_by(
        id=workout_id,
        user_id=user.id
    ).first()

    if not item:
        raise HTTPException(404, "Workout not found")

    db.delete(item)
    db.commit()

    refresh_streak(db, user.id)

    return {"message": "Workout deleted"}


# ==================================================
# MODULE 3 - DAILY PROGRESS
# ==================================================

@app.get("/api/progress/daily")
def daily_progress(
    day: date | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    selected_day = day or date.today()

    query = db.query(models.Workout).filter_by(
        user_id=user.id,
        workout_date=selected_day
    )

    return {
        "date": selected_day,
        "total_workouts": query.count(),
        "total_calories": query.with_entities(
            func.coalesce(
                func.sum(models.Workout.calories_burned), 0
            )
        ).scalar(),
        "total_duration": query.with_entities(
            func.coalesce(
                func.sum(models.Workout.duration), 0
            )
        ).scalar()
    }


# ==================================================
# MODULE 4 - GOALS
# ==================================================

@app.post(
    "/api/goals",
    response_model=schemas.GoalOut,
    status_code=201
)
def create_goal(
    data: schemas.GoalIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    status_value = (
        "COMPLETED"
        if data.current_value >= data.target_value
        else "IN_PROGRESS"
    )

    goal = models.Goal(
        **data.model_dump(),
        user_id=user.id,
        status=status_value
    )

    db.add(goal)
    db.commit()
    db.refresh(goal)

    if status_value == "COMPLETED":
        notify(
            db,
            user.id,
            "Goal completed",
            f"You completed your {goal.goal_type} goal!"
        )

        award_badge(db, user.id, "Goal Achiever")
        db.commit()

    return goal


@app.get(
    "/api/goals",
    response_model=list[schemas.GoalOut]
)
def list_goals(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return (
        db.query(models.Goal)
        .filter_by(user_id=user.id)
        .order_by(models.Goal.deadline)
        .all()
    )


@app.patch(
    "/api/goals/{goal_id}",
    response_model=schemas.GoalOut
)
def update_goal(
    goal_id: int,
    data: schemas.GoalUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    goal = db.query(models.Goal).filter_by(
        id=goal_id,
        user_id=user.id
    ).first()

    if not goal:
        raise HTTPException(404, "Goal not found")

    was_completed = goal.status == "COMPLETED"

    goal.current_value = data.current_value

    goal.status = (
        "COMPLETED"
        if goal.current_value >= goal.target_value
        else "IN_PROGRESS"
    )

    db.commit()
    db.refresh(goal)

    if goal.status == "COMPLETED" and not was_completed:
        notify(
            db,
            user.id,
            "Goal completed",
            f"You completed your {goal.goal_type} goal!"
        )

        award_badge(db, user.id, "Goal Achiever")
        db.commit()

    return goal


@app.delete("/api/goals/{goal_id}")
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    goal = db.query(models.Goal).filter_by(
        id=goal_id,
        user_id=user.id
    ).first()

    if not goal:
        raise HTTPException(404, "Goal not found")

    db.delete(goal)
    db.commit()

    return {"message": "Goal deleted"}


# ==================================================
# MODULE 5 - REPORTS
# ==================================================

@app.get("/api/reports/weekly")
def weekly_report(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    start = date.today() - timedelta(days=6)

    rows = (
        db.query(
            models.Workout.workout_date,
            func.count(models.Workout.id),
            func.coalesce(
                func.sum(models.Workout.calories_burned), 0
            )
        )
        .filter(
            models.Workout.user_id == user.id,
            models.Workout.workout_date >= start
        )
        .group_by(models.Workout.workout_date)
        .all()
    )

    values = {
        row[0].isoformat(): {
            "workouts": row[1],
            "calories": row[2]
        }
        for row in rows
    }

    return [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            **values.get(
                (start + timedelta(days=i)).isoformat(),
                {"workouts": 0, "calories": 0}
            )
        }
        for i in range(7)
    ]


@app.get("/api/reports/monthly")
def monthly_report(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    today = date.today()

    year = year or today.year
    month = month or today.month

    if month < 1 or month > 12:
        raise HTTPException(
            422,
            "Month must be between 1 and 12"
        )

    row = db.query(
        func.count(models.Workout.id),
        func.coalesce(
            func.sum(models.Workout.calories_burned), 0
        ),
        func.coalesce(
            func.sum(models.Workout.duration), 0
        )
    ).filter(
        models.Workout.user_id == user.id,
        func.strftime(
            "%Y", models.Workout.workout_date
        ) == str(year),
        func.strftime(
            "%m", models.Workout.workout_date
        ) == f"{month:02d}"
    ).first()

    return {
        "year": year,
        "month": month,
        "total_workouts": row[0],
        "total_calories": row[1],
        "total_duration": row[2]
    }


# ==================================================
# MODULE 6 - NOTIFICATIONS
# ==================================================

@app.get(
    "/api/notifications",
    response_model=list[schemas.NotificationOut]
)
def notifications(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    today = date.today()

    old = db.query(models.Notification).filter_by(
        user_id=user.id,
        title="Daily workout reminder"
    ).filter(
        func.date(models.Notification.created_at) == today.isoformat()
    ).first()

    did_workout = db.query(models.Workout).filter_by(
        user_id=user.id,
        workout_date=today
    ).first()

    if not old and not did_workout:
        notify(
            db,
            user.id,
            "Daily workout reminder",
            "You have not logged a workout today. A short session can help you stay consistent."
        )
        db.commit()

    return (
        db.query(models.Notification)
        .filter_by(user_id=user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )


@app.get("/api/notifications/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    count = db.query(models.Notification).filter_by(
        user_id=user.id,
        is_read=False
    ).count()

    return {"unread_count": count}


@app.patch("/api/notifications/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    notification = db.query(models.Notification).filter_by(
        id=notification_id,
        user_id=user.id
    ).first()

    if not notification:
        raise HTTPException(404, "Notification not found")

    notification.is_read = True
    db.commit()

    return {"message": "Notification marked as read"}


@app.patch("/api/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    (
        db.query(models.Notification)
        .filter_by(user_id=user.id, is_read=False)
        .update({"is_read": True})
    )

    db.commit()

    return {"message": "All notifications marked as read"}


# ==================================================
# MODULE 7 - WORKOUT PLANS
# ==================================================

@app.post(
    "/api/plans",
    response_model=schemas.PlanOut,
    status_code=201
)
def create_plan(
    data: schemas.PlanIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    plan = models.WorkoutPlan(
        **data.model_dump(),
        user_id=user.id
    )

    db.add(plan)
    db.commit()
    db.refresh(plan)

    return plan


@app.get(
    "/api/plans",
    response_model=list[schemas.PlanOut]
)
def list_plans(
    upcoming_only: bool = False,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    query = db.query(models.WorkoutPlan).filter_by(
        user_id=user.id
    )

    if upcoming_only:
        query = query.filter(
            models.WorkoutPlan.scheduled_date >= date.today()
        )

    return query.order_by(
        models.WorkoutPlan.scheduled_date
    ).all()


@app.delete("/api/plans/{plan_id}")
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    plan = db.query(models.WorkoutPlan).filter_by(
        id=plan_id,
        user_id=user.id
    ).first()

    if not plan:
        raise HTTPException(404, "Workout plan not found")

    db.delete(plan)
    db.commit()

    return {"message": "Plan deleted"}


# ==================================================
# MODULE 8 - EXERCISE LIBRARY
# ==================================================

@app.get(
    "/api/exercises",
    response_model=list[schemas.ExerciseOut]
)
def exercises(
    search: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    query = db.query(models.Exercise)

    if search:
        query = query.filter(
            models.Exercise.name.ilike(
                f"%{search.strip()}%"
            )
        )

    if category:
        if category not in ("Cardio", "Strength", "Yoga"):
            raise HTTPException(422, "Invalid category")

        query = query.filter_by(category=category)

    return query.order_by(
        models.Exercise.category,
        models.Exercise.name
    ).all()


@app.post(
    "/api/exercises/{exercise_id}/add-to-workouts",
    response_model=schemas.WorkoutOut,
    status_code=201
)
def add_exercise_to_workout(
    exercise_id: int,
    workout_date: date | None = None,
    calories_burned: int | None = Query(
        default=None,
        ge=0,
        le=10000
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    exercise = db.get(models.Exercise, exercise_id)

    if not exercise:
        raise HTTPException(
            status_code=404,
            detail="Exercise not found"
        )

    # Approximate calorie rates per minute.
    # These are estimates, not measured calorie values.
    calorie_rates = {
        "Running": 10,
        "Cycling": 8,
        "Jump Rope": 12,
        "Push-ups": 5,
        "Squats": 6,
        "Plank": 4,
        "Sun Salutation": 4,
        "Child's Pose": 2,
        "Warrior Pose": 3
    }

    # Estimate only when the frontend/API did not supply calories.
    if calories_burned is None:
        rate = calorie_rates.get(exercise.name, 5)
        calories_burned = rate * exercise.duration

    workout = models.Workout(
        user_id=user.id,
        workout_name=exercise.name,
        category=exercise.category,
        duration=exercise.duration,
        calories_burned=calories_burned,
        workout_date=workout_date or date.today()
    )

    db.add(workout)
    db.commit()

    refresh_streak(db, user.id)

    db.refresh(workout)

    return workout


# ==================================================
# MODULE 9 - PROGRESS COMPARISON
# ==================================================

@app.get("/api/comparison/weekly")
def compare_weekly(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    today = date.today()

    this_start = today - timedelta(days=6)
    prev_start = this_start - timedelta(days=7)
    prev_end = this_start - timedelta(days=1)

    def totals(start, end):
        result = db.query(
            func.count(models.Workout.id),
            func.coalesce(
                func.sum(models.Workout.calories_burned), 0
            ),
            func.coalesce(
                func.sum(models.Workout.duration), 0
            )
        ).filter(
            models.Workout.user_id == user.id,
            models.Workout.workout_date >= start,
            models.Workout.workout_date <= end
        ).first()

        return {
            "workouts": result[0],
            "calories": result[1],
            "duration": result[2]
        }

    current = totals(this_start, today)
    previous = totals(prev_start, prev_end)

    return {
        "current_period": {
            "start": str(this_start),
            "end": str(today),
            **current
        },
        "previous_period": {
            "start": str(prev_start),
            "end": str(prev_end),
            **previous
        },
        "change": {
            "workouts": current["workouts"] - previous["workouts"],
            "calories": current["calories"] - previous["calories"],
            "duration": current["duration"] - previous["duration"]
        }
    }


@app.get("/api/comparison/monthly")
def compare_monthly(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    today = date.today()

    def totals(year, month):
        result = db.query(
            func.count(models.Workout.id),
            func.coalesce(
                func.sum(models.Workout.calories_burned), 0
            ),
            func.coalesce(
                func.sum(models.Workout.duration), 0
            )
        ).filter(
            models.Workout.user_id == user.id,
            func.strftime(
                "%Y", models.Workout.workout_date
            ) == str(year),
            func.strftime(
                "%m", models.Workout.workout_date
            ) == f"{month:02d}"
        ).first()

        return {
            "workouts": result[0],
            "calories": result[1],
            "duration": result[2]
        }

    if today.month == 1:
        previous_year = today.year - 1
        previous_month = 12
    else:
        previous_year = today.year
        previous_month = today.month - 1

    current = totals(today.year, today.month)
    previous = totals(previous_year, previous_month)

    return {
        "current_period": {
            "year": today.year,
            "month": today.month,
            **current
        },
        "previous_period": {
            "year": previous_year,
            "month": previous_month,
            **previous
        },
        "change": {
            "workouts": current["workouts"] - previous["workouts"],
            "calories": current["calories"] - previous["calories"],
            "duration": current["duration"] - previous["duration"]
        }
    }


# ==================================================
# MODULE 10 - STREAK TRACKING
# ==================================================

@app.get("/api/streak")
def get_streak(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    row = refresh_streak(db, user.id)

    return {
        "current_streak": row.current_streak,
        "longest_streak": row.longest_streak,
        "last_workout_date": row.last_workout_date
    }


# ==================================================
# MODULE 11 - ACHIEVEMENT BADGES
# ==================================================

@app.get("/api/badges")
def list_badges(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    # Recalculate achievement eligibility whenever badges are requested.
    refresh_streak(db, user.id)

    earned = db.query(models.UserBadge).filter_by(
        user_id=user.id
    ).all()

    earned_ids = {item.badge_id for item in earned}

    all_badges = (
        db.query(models.Badge)
        .order_by(models.Badge.id)
        .all()
    )

    return [
        {
            "id": badge.id,
            "name": badge.name,
            "description": badge.description,
            "icon": badge.icon,
            "earned": badge.id in earned_ids,
            "earned_at": next(
                (
                    item.earned_at
                    for item in earned
                    if item.badge_id == badge.id
                ),
                None
            )
        }
        for badge in all_badges
    ]


# ==================================================
# MODULE 12 - PERSONALIZED DASHBOARD
# ==================================================

@app.get("/api/dashboard")
def personalized_dashboard(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    today = date.today()

    workouts = db.query(models.Workout).filter_by(
        user_id=user.id,
        workout_date=today
    ).all()

    goals = (
        db.query(models.Goal)
        .filter_by(user_id=user.id)
        .order_by(models.Goal.deadline)
        .all()
    )

    plans = (
        db.query(models.WorkoutPlan)
        .filter(
            models.WorkoutPlan.user_id == user.id,
            models.WorkoutPlan.scheduled_date >= today
        )
        .order_by(models.WorkoutPlan.scheduled_date)
        .limit(5)
        .all()
    )

    streak = refresh_streak(db, user.id)

    badge_count = db.query(models.UserBadge).filter_by(
        user_id=user.id
    ).count()

    return {
        "user": {
            "username": user.username
        },
        "daily_summary": {
            "workouts": len(workouts),
            "calories": sum(
                workout.calories_burned
                for workout in workouts
            ),
            "duration": sum(
                workout.duration
                for workout in workouts
            )
        },
        "upcoming_workouts": [
            {
                "id": plan.id,
                "title": plan.title,
                "description": plan.description,
                "scheduled_date": plan.scheduled_date
            }
            for plan in plans
        ],
        "goals": [
            {
                "id": goal.id,
                "goal_type": goal.goal_type,
                "current_value": goal.current_value,
                "target_value": goal.target_value,
                "status": goal.status,
                "deadline": goal.deadline
            }
            for goal in goals
        ],
        "streak": {
            "current_streak": streak.current_streak,
            "longest_streak": streak.longest_streak,
            "last_workout_date": streak.last_workout_date
        },
        "earned_badges": badge_count
    }


# ==================================================
# PHASE 3 - MODULE 13: NUTRITION & MEAL TRACKING
# ==================================================

class MealCreate(BaseModel):
    meal_type: str = Field(pattern="^(Breakfast|Lunch|Dinner|Snacks)$")
    food_name: str = Field(min_length=2, max_length=120)
    calories: int = Field(ge=0, le=10000)
    protein: float = Field(default=0, ge=0, le=500)
    carbs: float = Field(default=0, ge=0, le=1000)
    fats: float = Field(default=0, ge=0, le=500)

@app.post("/api/meals", status_code=201)
def add_meal(data: MealCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    meal = models.Meal(user_id=user.id, **data.model_dump())
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal

@app.get("/api/meals")
def list_meals(day: date | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    selected = day or date.today()
    start = datetime.combine(selected, datetime.min.time())
    end = start + timedelta(days=1)
    return db.query(models.Meal).filter(
        models.Meal.user_id == user.id,
        models.Meal.created_at >= start,
        models.Meal.created_at < end
    ).order_by(models.Meal.created_at.desc()).all()

@app.get("/api/nutrition/summary")
def nutrition_summary(day: date | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    selected = day or date.today()
    start = datetime.combine(selected, datetime.min.time())
    end = start + timedelta(days=1)
    rows = db.query(models.Meal).filter(
        models.Meal.user_id == user.id,
        models.Meal.created_at >= start,
        models.Meal.created_at < end
    ).all()
    return {
        "date": selected,
        "meal_count": len(rows),
        "calories": sum(x.calories for x in rows),
        "protein": round(sum(x.protein for x in rows), 1),
        "carbs": round(sum(x.carbs for x in rows), 1),
        "fats": round(sum(x.fats for x in rows), 1),
        "meals": rows
    }

@app.put("/api/meals/{meal_id}")
def update_meal(
    meal_id: int,
    data: MealCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    # Only allow the logged-in user to update their own meal.
    item = db.query(models.Meal).filter_by(
        id=meal_id,
        user_id=user.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Meal not found")

    for field, value in data.model_dump().items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/meals/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(models.Meal).filter_by(id=meal_id, user_id=user.id).first()
    if not item:
        raise HTTPException(404, "Meal not found")
    db.delete(item)
    db.commit()
    return {"message": "Meal deleted"}


# ==================================================
# MODULE 14: WATER INTAKE TRACKER
# ==================================================

class WaterCreate(BaseModel):
    quantity: int = Field(gt=0, le=5000)
    date: Date = Field(default_factory=Date.today)

@app.post("/api/water", status_code=201)
def add_water(data: WaterCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = models.WaterTracking(user_id=user.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.get("/api/water")
def water_summary(day: date | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    selected = day or date.today()
    entries = db.query(models.WaterTracking).filter_by(user_id=user.id, date=selected).order_by(models.WaterTracking.id.desc()).all()
    total = sum(x.quantity for x in entries)
    goal = 2000
    return {
        "date": selected, "goal_ml": goal, "total_ml": total,
        "remaining_ml": max(goal-total, 0),
        "progress_percent": min(round(total/goal*100), 100),
        "entries": entries
    }

@app.delete("/api/water/{entry_id}")
def delete_water(entry_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(models.WaterTracking).filter_by(id=entry_id, user_id=user.id).first()
    if not item:
        raise HTTPException(404, "Water entry not found")
    db.delete(item)
    db.commit()
    return {"message": "Water entry deleted"}


# ==================================================
# MODULE 15: SMART WORKOUT RECOMMENDATIONS
# Rule-based personalized suggestions; no external AI API required.
# ==================================================

@app.get("/api/recommendations")
def workout_recommendations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    recent = db.query(models.Workout).filter_by(user_id=user.id).order_by(
        models.Workout.workout_date.desc(), models.Workout.id.desc()
    ).limit(10).all()
    goals = db.query(models.Goal).filter_by(user_id=user.id).all()
    streak = db.query(models.Streak).filter_by(user_id=user.id).first()
    recent_categories = {w.category for w in recent[:5]}
    goal_types = {g.goal_type for g in goals if g.status != "COMPLETED"}
    all_exercises = db.query(models.Exercise).order_by(models.Exercise.name).all()
    if "Weight Loss" in goal_types:
        preferred = ["Cardio", "Strength"]
        reason = "Supports your active weight-loss goal."
    elif "Muscle Gain" in goal_types:
        preferred = ["Strength", "Cardio"]
        reason = "Supports your muscle-building goal."
    elif "Steps" in goal_types:
        preferred = ["Cardio", "Yoga"]
        reason = "Supports your activity and movement goal."
    else:
        preferred = ["Yoga", "Cardio", "Strength"]
        reason = "A balanced mix can help maintain overall fitness."
    suggestions = [e for e in all_exercises if e.category in preferred and e.category not in recent_categories]
    if not suggestions:
        suggestions = all_exercises
    return {
        "approach": "rule_based_personalization",
        "note": "Suggestions are generated from your recent workouts and active goals; they are not medical advice.",
        "current_streak": streak.current_streak if streak else 0,
        "reason": reason,
        "suggestions": [
            {"id": e.id, "name": e.name, "category": e.category, "duration": e.duration,
             "description": e.description, "reason": reason}
            for e in suggestions[:6]
        ]
    }


# ==================================================
# MODULE 16: WORKOUT TIMER & LIVE TRACKING
# ==================================================

class TimerStart(BaseModel):
    workout_name: str = Field(default="Timed Workout", min_length=2, max_length=100)

@app.post("/api/timer/start", status_code=201)
def start_timer(data: TimerStart, db: Session = Depends(get_db), user=Depends(get_current_user)):
    active = db.query(models.WorkoutSession).filter_by(user_id=user.id, status="RUNNING").first()
    if active:
        raise HTTPException(409, "A workout timer is already running")
    item = models.WorkoutSession(user_id=user.id, workout_name=data.workout_name, started_at=datetime.utcnow())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.get("/api/timer/active")
def active_timer(db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(models.WorkoutSession).filter_by(user_id=user.id, status="RUNNING").first()
    if not item:
        return {"active": False}
    elapsed = max(0, int((datetime.utcnow() - item.started_at).total_seconds()))
    return {"active": True, "id": item.id, "workout_name": item.workout_name,
            "started_at": item.started_at, "elapsed_seconds": elapsed}

@app.post("/api/timer/{session_id}/stop")
def stop_timer(session_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(models.WorkoutSession).filter_by(id=session_id, user_id=user.id, status="RUNNING").first()
    if not item:
        raise HTTPException(404, "Active workout session not found")
    ended = datetime.utcnow()
    seconds = max(1, int((ended-item.started_at).total_seconds()))
    minutes = max(1, round(seconds/60))
    item.ended_at = ended
    item.duration_minutes = minutes
    # Approximate generic estimate: 5 kcal/min. Users can edit workout details later.
    item.calories_burned = minutes * 5
    item.status = "COMPLETED"
    workout = models.Workout(
        user_id=user.id, workout_name=item.workout_name, category="Cardio",
        duration=minutes, calories_burned=item.calories_burned, workout_date=date.today()
    )
    db.add(workout)
    db.commit()
    db.refresh(item)
    refresh_streak(db, user.id)
    return {"session": item, "workout": workout, "elapsed_seconds": seconds,
            "calorie_estimate_note": "Estimated at 5 kcal/min; actual burn varies by person and intensity."}

@app.get("/api/timer/history")
def timer_history(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.WorkoutSession).filter_by(user_id=user.id).order_by(models.WorkoutSession.started_at.desc()).limit(20).all()


# ==================================================
# MODULE 17: THIRD-PARTY ACTIVITY INTEGRATION
# Optional provider OAuth is not configured in this starter.
# Manual import endpoint is provided for safe testing.
# ==================================================

class ActivityImport(BaseModel):
    provider: str = Field(default="MANUAL", pattern="^(MANUAL|GOOGLE_FIT|APPLE_HEALTH)$")
    steps: int = Field(default=0, ge=0, le=100000)
    active_minutes: int = Field(default=0, ge=0, le=1440)

@app.get("/api/integrations/status")
def integration_status(user=Depends(get_current_user)):
    return {
        "google_fit": {"available": False, "message": "OAuth client credentials and provider approval are required."},
        "apple_health": {"available": False, "message": "Apple Health requires an iOS app and HealthKit permissions."},
        "manual_import": {"available": True, "message": "Use the manual activity import endpoint for development/testing."}
    }

@app.post("/api/integrations/manual-sync", status_code=201)
def manual_activity_sync(data: ActivityImport, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = models.ActivitySync(user_id=user.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.get("/api/integrations/activity")
def list_synced_activity(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.ActivitySync).filter_by(user_id=user.id).order_by(models.ActivitySync.synced_at.desc()).limit(30).all()


# ==================================================
# MODULE 18: ADVANCED ANALYTICS
# ==================================================

@app.get("/api/analytics/overview")
def advanced_analytics(db: Session = Depends(get_db), user=Depends(get_current_user)):
    today = date.today()
    workouts = db.query(models.Workout).filter_by(user_id=user.id).all()
    goals = db.query(models.Goal).filter_by(user_id=user.id).all()
    completed = sum(1 for g in goals if g.status == "COMPLETED")
    days = {w.workout_date for w in workouts}
    last_7 = [w for w in workouts if w.workout_date >= today-timedelta(days=6)]
    return {
        "total_workouts": len(workouts),
        "total_calories": sum(w.calories_burned for w in workouts),
        "total_active_minutes": sum(w.duration for w in workouts),
        "goal_count": len(goals),
        "completed_goals": completed,
        "goal_completion_rate": round(completed/len(goals)*100, 1) if goals else 0,
        "active_workout_days": len(days),
        "workouts_last_7_days": len(last_7),
        "consistency_percent_last_7_days": round(len({w.workout_date for w in last_7})/7*100, 1)
    }

@app.get("/api/analytics/trends")
def analytics_trends(days: int = Query(default=30, ge=7, le=90), db: Session = Depends(get_db), user=Depends(get_current_user)):
    start = date.today()-timedelta(days=days-1)
    rows = db.query(models.Workout.workout_date, func.count(models.Workout.id),
                    func.coalesce(func.sum(models.Workout.calories_burned), 0),
                    func.coalesce(func.sum(models.Workout.duration), 0)).filter(
        models.Workout.user_id == user.id, models.Workout.workout_date >= start
    ).group_by(models.Workout.workout_date).all()
    indexed = {r[0]: {"workouts": r[1], "calories": r[2], "minutes": r[3]} for r in rows}
    return [{"date": start+timedelta(days=i), **indexed.get(start+timedelta(days=i), {"workouts":0,"calories":0,"minutes":0})} for i in range(days)]


# ==================================================
# MODULE 18 - MONTHLY PERFORMANCE COMPARISON
# Compares the same elapsed calendar days in the current and previous months.

@app.get("/api/analytics/monthly-comparison")
def monthly_comparison(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    today = date.today()

    current_start = today.replace(day=1)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end.replace(day=1)

    previous_comparison_end = min(
        previous_start + timedelta(days=today.day - 1),
        previous_end
    )

    def get_stats(start_date, end_date):
        result = db.query(
            func.count(models.Workout.id),
            func.coalesce(
                func.sum(models.Workout.calories_burned), 0
            ),
            func.coalesce(
                func.sum(models.Workout.duration), 0
            )
        ).filter(
            models.Workout.user_id == user.id,
            models.Workout.workout_date >= start_date,
            models.Workout.workout_date <= end_date
        ).one()

        return {
            "workouts": result[0],
            "calories": result[1],
            "minutes": result[2]
        }

    return {
        "current_month": get_stats(current_start, today),
        "previous_month": get_stats(
            previous_start,
            previous_comparison_end
        ),
        "comparison_period": {
            "current_start": current_start,
            "current_end": today,
            "previous_start": previous_start,
            "previous_end": previous_comparison_end
        }
    }


# MODULE 19: IN-APP REMINDERS & ALERTS
# Reminders are checked when the due endpoint is requested.
# For unattended delivery, add a background scheduler in deployment.
# ==================================================

class ReminderCreate(BaseModel):
    reminder_type: str
    message: str = Field(min_length=2, max_length=300)
    remind_at: datetime

    @field_validator("reminder_type", mode="before")
    @classmethod
    def normalize_reminder_type(cls, value):
        if not isinstance(value, str):
            raise ValueError("Reminder type must be Workout, Meal, or Water")
        normalized = value.strip().capitalize()
        if normalized not in {"Workout", "Meal", "Water"}:
            raise ValueError("Reminder type must be Workout, Meal, or Water")
        return normalized

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Reminder message must contain at least 2 characters")
        return value

    @field_validator("remind_at")
    @classmethod
    def normalize_reminder_datetime(cls, value):
        # Store timestamps as local naive datetimes because the existing SQLite
        # Reminder column and due-check query use naive local datetimes.
        if value.tzinfo is not None:
            value = value.astimezone().replace(tzinfo=None)
        return value


@app.post("/api/reminders", status_code=201)
def create_reminder(
    data: ReminderCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    item = models.Reminder(
        user_id=user.id,
        reminder_type=data.reminder_type,
        message=data.message,
        remind_at=data.remind_at,
        is_active=True
    )
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except Exception:
        db.rollback()
        raise


@app.get("/api/reminders")
def list_reminders(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return (
        db.query(models.Reminder)
        .filter_by(user_id=user.id)
        .order_by(models.Reminder.remind_at)
        .all()
    )


@app.get("/api/reminders/check-due")
def check_due_reminders(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    now = datetime.now()
    due = db.query(models.Reminder).filter(
        models.Reminder.user_id == user.id,
        models.Reminder.is_active.is_(True),
        models.Reminder.remind_at <= now
    ).all()

    for item in due:
        notify(db, user.id, f"{item.reminder_type} reminder", item.message)
        item.is_active = False

    db.commit()
    return {
        "created_notifications": len(due),
        "reminders": due
    }


@app.delete("/api/reminders/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    item = db.query(models.Reminder).filter_by(
        id=reminder_id,
        user_id=user.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Reminder not found")

    db.delete(item)
    db.commit()
    return {"message": "Reminder deleted"}
