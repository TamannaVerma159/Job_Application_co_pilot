from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/login")
def login(user: LoginRequest):

    if (
        user.email == "admin@gmail.com"
        and
        user.password == "admin123"
    ):

        return {

            "access_token": "sample_jwt_token",

            "user": {

                "id": 1,

                "name": "Tamanna",

                "email": user.email

            }

        }

    raise HTTPException(
        status_code=401,
        detail="Invalid email or password"
    )