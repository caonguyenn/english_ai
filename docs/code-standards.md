# EnglishAI Code Standards & Architecture

**Last Updated:** May 29, 2026

This document defines the coding standards, architectural patterns, and conventions used across the EnglishAI platform.

---

## Table of Contents

1. [Repository Structure](#repository-structure)
2. [Backend Standards (Python)](#backend-standards-python)
3. [Frontend Standards (TypeScript/React)](#frontend-standards-typescriptreact)
4. [WebSocket Server Standards](#websocket-server-standards)
5. [Database & ORM Patterns](#database--orm-patterns)
6. [API Design Conventions](#api-design-conventions)
7. [Testing Standards](#testing-standards)
8. [Error Handling](#error-handling)
9. [Security Practices](#security-practices)
10. [Performance Optimization](#performance-optimization)

---

## Repository Structure

```
english-ai-platform/
├── backend/                    # REST API (FastAPI, port 8000)
│   ├── app/
│   │   ├── main.py            # FastAPI app factory
│   │   ├── core/
│   │   │   ├── config.py      # pydantic-settings, all env vars
│   │   │   ├── cognito.py     # JWKS + token verification
│   │   │   ├── dependencies.py # FastAPI dependency injection
│   │   │   ├── logging.py
│   │   │   └── exceptions.py  # domain exceptions
│   │   ├── db/
│   │   │   ├── session.py     # async engine + session factory
│   │   │   ├── base.py        # declarative base
│   │   │   ├── models/        # SQLAlchemy ORM models
│   │   │   └── migrations/    # Alembic versioning
│   │   ├── schemas/           # Pydantic v2 schemas
│   │   ├── api/v1/
│   │   │   ├── router.py      # route aggregation
│   │   │   └── routes/        # endpoint implementations
│   │   ├── services/          # business logic
│   │   │   ├── analysis/      # Phase 1: Learning Intelligence
│   │   │   └── {service}.py
│   │   └── tasks/             # Celery async jobs
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── requirements.txt
│   └── Dockerfile
│
├── ws/                        # WebSocket server (FastAPI, port 8080)
│   ├── main.py               # FastAPI app factory
│   ├── app/
│   │   ├── routes/
│   │   └── services/
│   └── requirements.txt
│
├── frontend/                  # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # router + auth guard
│   │   ├── types/index.ts    # shared TypeScript types
│   │   ├── services/         # API + WebSocket clients
│   │   ├── store/            # Zustand stores
│   │   ├── hooks/            # React custom hooks
│   │   ├── components/       # React components
│   │   │   ├── ui/           # reusable UI components
│   │   │   ├── layout/       # layout wrappers
│   │   │   └── session/      # session-specific components
│   │   ├── pages/            # route pages
│   │   └── utils/            # helpers
│   └── vite.config.ts
│
├── docs/                     # documentation
├── plans/                    # development plans + reports
└── docker-compose.yml        # local: Postgres + Redis
```

---

## Backend Standards (Python)

### Code Style

- **Python Version:** 3.12+
- **Style Guide:** Follow PEP 8, but prioritize readability over strict compliance
- **Type Hints:** Required everywhere. Use `from typing import ...` or `collections.abc.Sequence` for compatibility
- **Line Length:** 100 characters (pragmatic limit, not dogmatic)

### Imports

```python
# Standard library first
import asyncio
from typing import Optional

# Third-party
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession

# Local
from app.core.config import settings
from app.db.models import Student
```

### Async/Await

- Use `async`/`await` throughout — zero blocking I/O on the event loop
- Database queries: always `AsyncSession`, never sync engine
- HTTP calls: use `aiohttp` or `httpx` (not `requests`)
- Celery tasks: use sync SQLAlchemy engine (separate worker process, blocking is OK)

```python
# Good
async def get_student(session: AsyncSession, student_id: UUID) -> Student:
    stmt = select(Student).where(Student.id == student_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# Bad
def get_student(student_id: UUID):  # blocking, wrong
    return db.query(Student).get(student_id)
```

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Modules | snake_case | `config.py`, `student_service.py` |
| Classes | PascalCase | `Student`, `SessionOrchestrator` |
| Functions | snake_case | `get_student()`, `create_session()` |
| Constants | UPPER_SNAKE_CASE | `MAX_SESSIONS = 100` |
| Private | prefix `_` | `_validate_token()` |
| Protected | prefix `_` | `_internal_calculation()` |

### Functions & Services

- Keep functions focused (single responsibility)
- Aim for <30 lines per function
- Extract business logic into service classes
- Services should be instantiated once and reused

```python
class StudentService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_profile(self, student_id: UUID) -> StudentResponse:
        student = await self._fetch_student(student_id)
        profile = await self._enrich_with_profile(student)
        return StudentResponse.from_orm(profile)

    async def _fetch_student(self, student_id: UUID) -> Student:
        # private implementation detail
        ...
```

### Pydantic v2

- Use Pydantic v2 for all schemas
- Define `model_config = ConfigDict(...)` for custom settings
- Use `.from_orm()` for ORM → schema conversion (requires `ConfigDict(from_attributes=True)`)
- Leverage validators for custom validation

```python
from pydantic import BaseModel, ConfigDict, field_validator

class StudentRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    name: str
    email: str
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if '@' not in v:
            raise ValueError('Invalid email')
        return v.lower()
```

---

## Frontend Standards (TypeScript/React)

### Code Style

- **TypeScript:** `"strict": true` in `tsconfig.json` — no `any`, use `unknown` if needed
- **Line Length:** 100 characters (pragmatic)
- **Component Files:** PascalCase (e.g., `StudentCard.tsx`)
- **Hook Files:** camelCase with `use` prefix (e.g., `useAuth.ts`, `useNovaSonic.ts`)

### Component Architecture

**Functional components only**, hooks for state:

```typescript
// Good: functional + hooks
const StudentCard: React.FC<StudentCardProps> = ({ student }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="card" onClick={() => setExpanded(!expanded)}>
      {student.name}
      {expanded && <StudentDetails student={student} />}
    </div>
  );
};

// Bad: class components (legacy)
class StudentCard extends React.Component { ... }
```

### State Management

- **Global State (auth, user profile):** Zustand stores
- **Server State (sessions, modules):** React Query (`@tanstack/react-query`)
- **Local State (form inputs, UI toggles):** `useState`

```typescript
// authStore.ts (Zustand)
interface AuthStore {
  tokens: Tokens | null;
  student: Student | null;
  setTokens: (tokens: Tokens) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  tokens: null,
  student: null,
  setTokens: (tokens) => set({ tokens }),
  logout: () => set({ tokens: null, student: null }),
}));
```

### Animations

- **All animations:** GSAP (`gsap` npm package)
- **Never use:** Framer Motion, CSS keyframes, inline `@keyframes`
- **React cleanup:** Always use `gsap.context()` for component-scoped animations

```typescript
import gsap from 'gsap';

const AnimatedComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to('.slide-in', { 
        duration: 0.6, 
        x: 0, 
        opacity: 1,
        stagger: 0.1,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return <div ref={containerRef}>{/* children */}</div>;
};
```

### API Integration

**Single source of truth:** `services/api.ts`

```typescript
// services/api.ts
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

// Request interceptor: add Authorization header
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 with refresh queue
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // refresh token + retry queue
      ...
    }
    return Promise.reject(err);
  }
);

export const getStudent = (id: string) => api.get<StudentResponse>(`/students/${id}`);
```

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Components | PascalCase | `StudentCard.tsx`, `Dashboard.tsx` |
| Hooks | camelCase with `use` | `useAuth.ts`, `useNovaSonic.ts` |
| Stores | camelCase with `use` | `useAuthStore`, `useSessionStore` |
| Types/Interfaces | PascalCase | `Student`, `SessionResponse` |
| Enums | PascalCase | `SessionType`, `SkillType` |
| Constants | UPPER_SNAKE_CASE | `MAX_SESSIONS`, `DEFAULT_TIMEOUT` |
| Functions/Utils | camelCase | `formatXP()`, `secondsToMinutes()` |
| CSS classes | kebab-case | `.student-card`, `.session-header` |

---

## WebSocket Server Standards

### Structure

- Separate FastAPI process from REST API (different ports: 8000 vs. 8080)
- Single WebSocket endpoint: `WS /ws/session`
- Query params: `?type={class|playground|placement}&ref_id={id}`
- Auth: token sent in first JSON frame (browser limitation)

```python
@router.websocket("/ws/session")
async def session_websocket(
    websocket: WebSocket,
    type: Literal["class", "playground", "placement"],
    ref_id: str,
):
    await websocket.accept()
    
    # First message must be auth
    try:
        auth_msg = await websocket.receive_json()
        token = auth_msg.get("token")
        student = await verify_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    # Business logic follows
    ...
```

### Message Protocol

**Binary frames** = PCM audio (16-bit mono, 16kHz from client, 24kHz from server)  
**JSON frames** = control events and tool calls

```typescript
// Client → Server
interface AudioMessage {
  type: "audio";
  data: ArrayBuffer; // 16-bit PCM
}

interface AuthMessage {
  type: "auth";
  token: string;
}

// Server → Client
interface TranscriptEvent {
  type: "transcript";
  speaker: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface AudioEvent {
  type: "audio";
  data: ArrayBuffer; // 24-bit PCM
}
```

---

## Database & ORM Patterns

### SQLAlchemy 2.x Async

```python
# models/student.py
from sqlalchemy import Column, String, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class Student(Base):
    __tablename__ = "students"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    cognito_sub = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    current_module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id"))

# Query pattern
from sqlalchemy import select

async def get_student(session: AsyncSession, student_id: UUID) -> Student | None:
    stmt = select(Student).where(Student.id == student_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# Mutation pattern
async def create_student(session: AsyncSession, data: StudentRequest) -> Student:
    student = Student(**data.dict())
    session.add(student)
    await session.commit()
    await session.refresh(student)
    return student
```

### Migrations

- Use Alembic for all schema changes
- Commit `.py` migration files (never skip)
- Test migrations locally before pushing

```bash
# Generate migration
alembic revision --autogenerate -m "add student learning profiles table"

# Apply migration
alembic upgrade head
```

---

## API Design Conventions

### REST Endpoints

- **Base path:** `/api/v1`
- **Resource names:** plural, lowercase (e.g., `/students`, `/modules`)
- **Actions on resources:** POST (create), GET (read), PUT/PATCH (update), DELETE (delete)
- **Nested resources:** `/students/{id}/sessions`, `/sessions/{id}/scores`
- **Query params:** pagination, filtering (e.g., `?limit=20&offset=0`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check (no auth) |
| GET | `/students/{id}` | Get student profile (auth required) |
| POST | `/students` | Create student (admin only) |
| PATCH | `/students/{id}` | Update student (own record or admin) |
| GET | `/students/{id}/progress` | Get XP, module, completion % |
| GET | `/modules` | List all modules |
| GET | `/modules/{id}/classes` | Classes in module |
| POST | `/sessions` | Create session |
| PATCH | `/sessions/{id}` | Update session (end time, transcript, XP) |
| POST | `/sessions/{id}/scores` | Add skill scores |

### Request/Response Format

```python
# Request: Pydantic schema
class CreateSessionRequest(BaseModel):
    class_id: UUID | None = None
    topic_id: UUID | None = None
    session_type: Literal["class", "playground", "placement"]

# Response: Pydantic schema
class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    student_id: UUID
    session_type: str
    started_at: datetime
    ended_at: datetime | None
    xp_awarded: int = 0

# HTTP Responses
@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    request: CreateSessionRequest,
    session: AsyncSession = Depends(get_session),
    student: Student = Depends(get_current_student),
) -> SessionResponse:
    new_session = Session(
        student_id=student.id,
        session_type=request.session_type,
        **request.dict(exclude_unset=True),
    )
    session.add(new_session)
    await session.commit()
    await session.refresh(new_session)
    return SessionResponse.from_orm(new_session)
```

### Status Codes

- `200 OK` — successful GET, PATCH
- `201 Created` — successful POST
- `204 No Content` — successful DELETE
- `400 Bad Request` — validation error
- `401 Unauthorized` — auth token missing/invalid
- `403 Forbidden` — insufficient permissions
- `404 Not Found` — resource doesn't exist
- `409 Conflict` — state conflict (e.g., duplicate placement)
- `422 Unprocessable Entity` — semantic validation error
- `500 Internal Server Error` — unexpected server error
- `503 Service Unavailable` — external service down (AWS Bedrock, etc.)

---

## Testing Standards

### Test Organization

```
tests/
├── unit/
│   ├── test_student_service.py
│   ├── test_analysis_schema.py
│   └── ...
└── integration/
    ├── test_auth_flow.py
    ├── test_session_lifecycle.py
    └── ...
```

### Unit Tests (pytest)

```python
import pytest
from app.services.student_service import StudentService
from app.schemas.student import StudentResponse

@pytest.mark.asyncio
async def test_get_student_returns_correct_profile():
    # Arrange
    mock_session = AsyncMock()
    service = StudentService(mock_session)
    student_id = uuid7()
    
    # Act
    result = await service.get_profile(student_id)
    
    # Assert
    assert result is not None
    assert result.id == student_id
```

### Integration Tests

- Use real database (PostgreSQL in Docker)
- Test full request/response cycle
- Clean up test data after each test

```python
@pytest.mark.asyncio
async def test_create_session_and_add_scores(
    client: AsyncClient,
    test_student: Student,
    test_class: Class,
):
    # Create session
    response = await client.post(
        "/api/v1/sessions",
        json={
            "class_id": str(test_class.id),
            "session_type": "class",
        },
        headers={"Authorization": f"Bearer {test_token}"},
    )
    assert response.status_code == 201
    session_id = response.json()["id"]
    
    # Add scores
    response = await client.post(
        f"/api/v1/sessions/{session_id}/scores",
        json=[
            {"skill": "speaking", "score": 75},
            {"skill": "grammar", "score": 82},
        ],
    )
    assert response.status_code == 200
```

### Coverage Requirements

- Aim for >80% code coverage on services
- 100% on critical paths (auth, level-up, XP calculation)
- Use `pytest-cov` to measure

```bash
pytest --cov=app --cov-report=term-missing
```

---

## Error Handling

### Domain Exceptions

Define custom exceptions for expected error conditions:

```python
# app/core/exceptions.py
class EnglishAIException(Exception):
    """Base exception for all domain errors."""
    pass

class StudentNotFound(EnglishAIException):
    """Student record not found."""
    pass

class InvalidLevelUp(EnglishAIException):
    """Level-up validation failed."""
    pass

class AudioFormatError(EnglishAIException):
    """Audio format invalid (not 16-bit PCM 16kHz)."""
    pass
```

### Error Responses

Routes catch domain exceptions and raise `HTTPException`:

```python
@router.get("/students/{student_id}", response_model=StudentResponse)
async def get_student(student_id: UUID, service: StudentService = Depends()):
    try:
        student = await service.get_profile(student_id)
    except StudentNotFound:
        raise HTTPException(status_code=404, detail="Student not found")
    return student
```

### Async Error Handling

- Always use try/except in async tasks (Celery workers, WebSocket handlers)
- Log errors with full traceback
- Gracefully degrade if non-critical (e.g., analysis pipeline failure doesn't crash session)

```python
@shared_task(bind=True, max_retries=3)
def summarize_session(self, session_id: str):
    try:
        # Core summarization
        summary = _summarize_transcript(session_id)
        db.session.update(...)
        
        # Optional: analysis (non-fatal)
        try:
            analysis = analyze_session(session_id)
            db.session.update(analysis)
        except Exception as e:
            logger.warning(f"Analysis failed for session {session_id}: {e}")
            # Continue without analysis
        
    except Exception as exc:
        # Retry on transient errors
        raise self.retry(exc=exc, countdown=60)
```

---

## Security Practices

### Authentication

- **Frontend:** Store AccessToken in memory only, RefreshToken in HttpOnly cookie
- **Backend:** Validate JWT via Cognito JWKS (cached at startup)
- **WebSocket:** Send token in first JSON frame, validate before opening stream

```python
# Validate token on startup
@app.on_event("startup")
async def load_jwks():
    global JWKS
    JWKS = await fetch_cognito_jwks()

# Verify token on every protected request
def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            JWKS,
            algorithms=["RS256"],
            audience=COGNITO_APP_CLIENT_ID,
        )
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### Authorization

- Use Cognito groups for role-based access control (admin, student)
- Verify resource ownership (student can only access own records)

```python
async def get_current_student(token: dict = Depends(verify_token)) -> Student:
    student = await db.get_student(token["sub"])
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@router.get("/students/{student_id}")
async def get_student_profile(
    student_id: UUID,
    current_student: Student = Depends(get_current_student),
):
    # Verify ownership
    if current_student.id != student_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # Return profile
    ...
```

### Data Protection

- Never log sensitive data (passwords, tokens, SSNs)
- Use HTTPS only (enforced at infrastructure level)
- Sanitize user inputs (Pydantic handles most cases)
- Use parameterized queries (SQLAlchemy ORM prevents SQL injection)

### Environment Secrets

- Store in `.env` (local) or AWS Secrets Manager (production)
- Never commit `.env` to git
- Use `pydantic-settings` for validation

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    cognito_user_pool_id: str
    aws_access_key_id: str
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
```

---

## Performance Optimization

### Database

- Use indexes on frequently queried columns (PK, FK, session lookup)
- Batch queries where possible (avoid N+1)
- Use `select()` with `.scalars()` for cleaner results

```python
# Avoid N+1: load students and their sessions in one query
from sqlalchemy.orm import selectinload

async def get_students_with_sessions():
    stmt = select(Student).options(selectinload(Student.sessions))
    return await session.execute(stmt)
```

### Caching

- Cache Cognito JWKS at startup (don't fetch per request)
- Redis for session state + rate limiting (optional for MVP)
- Consider caching module data (changes rarely)

### WebSocket Performance

- Send compressed audio where possible (PCM is already dense)
- Batch transcript events (don't send every character)
- Close stale connections (45-min max session)

### Frontend

- Code split pages with React Router lazy loading
- Use `React.memo` for expensive components
- Debounce user input (e.g., transcript search)
- Lazy load images and non-critical assets

---

## Tools & Commands

### Backend

```bash
# Format
black app/ tests/

# Lint
ruff check app/ tests/

# Type check
mypy app/

# Test
pytest tests/ -v

# Run migrations
alembic upgrade head

# Seed data
python scripts/seed.py
```

### Frontend

```bash
# Format
prettier --write src/

# Lint
eslint src/ --fix

# Type check
tsc --noEmit

# Test
npm run test

# Build
npm run build
```

### Docker

```bash
# Start local services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

---

## References

- **Python**: [PEP 8](https://pep8.org/), [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy 2.x](https://docs.sqlalchemy.org/)
- **TypeScript**: [TypeScript Handbook](https://www.typescriptlang.org/docs/), [React Docs](https://react.dev/)
- **WebSocket**: [ASGI WS Spec](https://asgi.readthedocs.io/)
- **Testing**: [pytest](https://docs.pytest.org/), [React Testing Library](https://testing-library.com/react)
