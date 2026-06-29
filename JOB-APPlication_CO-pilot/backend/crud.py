from models import User
from utils.pdf_parser import extract_text
from models import Draft
from models import Application
from models import Resume
import os



# # creat user
def create_user(db, name, email, password):
    user = User(
        name=name,
        email=email,
        password=password
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# get all users
def get_users(db):
    return db.query(User).all()
# # get user by id
def get_user(db, user_id):
    return (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )




# create application CRUD

def create_application(
    db,
    user_id,
    resume_id,
    job_title,
    company,
    jd_text
):
    application = Application(
        user_id=user_id,
        resume_id=resume_id,
        job_title=job_title,
        company=company,
        jd_text=jd_text
    )

    db.add(application)
    db.commit()
    db.refresh(application)

    return application


# Get Applications for a User
def get_user_applications(db, user_id):
    return (
        db.query(Application)
        .filter(Application.user_id == user_id)
        .all()
    )
# get all applications
def get_applications(db):
    return db.query(Application).all()
# get application by id
def get_application(
    db,
    application_id
):
    return (
        db.query(Application)
        .filter(
            Application.id == application_id
        )
        .first()
    )


# Update Status
def update_status(
    db,
    application_id,
    new_status
):
    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )

    if application:
        application.status = new_status
        db.commit()

    return application

# save resume in database
def save_resume(db, user_id, pdf_path):
    extracted_text = extract_text(pdf_path)

    resume = Resume(
        user_id=user_id,
        filename=os.path.basename(pdf_path),
        file_path=pdf_path,
        resume_text=extracted_text
    )

    db.add(resume)
    db.commit()
    db.refresh(resume)

    return resume


def save_optimized_resume(
    db,
    user_id,
    original_resume,
    optimized_resume
):
    draft = Draft(
        user_id=user_id,
        original_resume=original_resume,
        optimized_resume=optimized_resume
    )

    db.add(draft)
    db.commit()
    db.refresh(draft)

    return draft

# Add a Draft Retrieval Function
def get_draft(db, draft_id):
    return (
        db.query(Draft)
        .filter(Draft.id == draft_id)
        .first()
    )