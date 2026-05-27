"""Domain exceptions raised by services; routes catch and convert to HTTPException."""


class DomainError(Exception):
    """Base class for all domain exceptions."""


class StudentNotFoundError(DomainError):
    def __init__(self, cognito_sub: str) -> None:
        super().__init__(f"Student not found: {cognito_sub}")


class SessionNotFoundError(DomainError):
    def __init__(self, session_id: int) -> None:
        super().__init__(f"Session not found: {session_id}")


class ModuleNotFoundError(DomainError):
    def __init__(self, module_id: int) -> None:
        super().__init__(f"Module not found: {module_id}")


class ClassNotFoundError(DomainError):
    def __init__(self, class_id: int) -> None:
        super().__init__(f"Class not found: {class_id}")


class TopicNotFoundError(DomainError):
    def __init__(self, topic_id: int) -> None:
        super().__init__(f"Playground topic not found: {topic_id}")


class LevelUpRejectedError(DomainError):
    """Raised when level-up validation fails."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(f"Level-up rejected: {reason}")


class PlacementAlreadyCompletedError(DomainError):
    def __init__(self) -> None:
        super().__init__("Placement already completed for this student")


class UnauthorizedError(DomainError):
    def __init__(self, detail: str = "Unauthorized") -> None:
        super().__init__(detail)
