from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://englishai:password@localhost:5432/englishai"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AWS
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # Cognito
    COGNITO_USER_POOL_ID: str = "us-east-1_XXXXXXXXX"
    COGNITO_APP_CLIENT_ID: str = ""
    COGNITO_REGION: str = "us-east-1"

    # Bedrock
    BEDROCK_MODEL_ID: str = "amazon.nova-sonic-v1:0"

    # S3
    S3_BUCKET_NAME: str = ""

    # App
    ENVIRONMENT: str = "development"
    REST_PORT: int = 8000
    WS_PORT: int = 8080
    LOG_LEVEL: str = "INFO"

    # Level-up thresholds
    LEVELUP_MIN_SESSIONS: int = 5
    LEVELUP_MIN_AVG_SCORE: int = 70
    LEVELUP_COOLDOWN_HOURS: int = 24

    # Playground XP cap
    PLAYGROUND_XP_DAILY_CAP_PCT: int = 60

    # Internal service-to-service secret (WS → REST level-up endpoint)
    INTERNAL_SECRET: str = "change-me-in-production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
