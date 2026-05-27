"""WS server configuration via pydantic-settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    COGNITO_REGION: str = "us-east-1"
    COGNITO_USER_POOL_ID: str = ""
    COGNITO_APP_CLIENT_ID: str = ""
    AWS_REGION: str = "us-east-1"
    BEDROCK_MODEL_ID: str = "amazon.nova-sonic-v1:0"
    ENVIRONMENT: str = "development"
    INTERNAL_SECRET: str = ""
    REST_BASE_URL: str = "http://localhost:8000"
    WS_PORT: int = 8080

    model_config = {"env_file": "../.env", "extra": "ignore"}


settings = Settings()
