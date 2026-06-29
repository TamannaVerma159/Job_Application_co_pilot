from database import engine, SessionLocal
from models import Base, User, Application

# Create tables
Base.metadata.create_all(bind=engine)

print("Database tables created!")

db = SessionLocal()

# Insert single user
user = User(
    name="Tamanna",
    email="tamanna@gmail.com",
    password="123456"
)

db.add(user)
db.commit()

print("User added")

# Insert multiple users
users = [
    User(
        name="Rishabh",
        email="rishabh@gmail.com",
        password="pass123"
    ),
    User(
        name="Rahul",
        email="rahul@gmail.com",
        password="pass456"
    ),
    User(
        name="Priya",
        email="priya@gmail.com",
        password="pass789"
    )
]

db.add_all(users)
db.commit()

print("Users inserted successfully!")

# Insert applications
applications = [
    Application(
        user_id=1,
        job_title="Python Developer",
        company="Google",
        status="applied"
    ),
    Application(
        user_id=1,
        job_title="Backend Engineer",
        company="Microsoft",
        status="interviewing"
    ),
    Application(
        user_id=2,
        job_title="Full Stack Developer",
        company="Amazon",
        status="not_applied"
    )
]

db.add_all(applications)
db.commit()

print("Applications inserted!")

# Verify users
users = db.query(User).all()

for user in users:
    print(user.id, user.name, user.email)

db.close()