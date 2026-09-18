from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None
    role: str = Field(default="farmer", pattern="^(farmer|officer|researcher)$")
    # en = English, si = Sinhala, ta = Tamil. Drives both the UI language on
    # subsequent logins (via GET /auth/me) and the language the chat
    # assistant / diagnosis treatment text respond in.
    language: str = Field(default="en", pattern="^(en|si|ta)$")


class LanguageUpdateRequest(BaseModel):
    language: str = Field(pattern="^(en|si|ta)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    language_pref: str

    model_config = {"from_attributes": True}