from database import SessionLocal
from crud import create_user, get_users

db = SessionLocal()

create_user(
    db,
    "Sakshi",
    "sakshi@gmail.com",
    "123456"
)

users = get_users(db)

for user in users:
    print(user.name)

# from database import SessionLocal
# from models import User

# db = SessionLocal()

# users = db.query(User).all()

# for user in users:
#     print(user.id, user.name, user.email)