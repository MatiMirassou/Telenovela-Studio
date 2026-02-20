"""
State machine mixin for SQLAlchemy models.
Provides validated state transitions across all entities.
"""


class InvalidTransitionError(ValueError):
    """Raised when an invalid state transition is attempted."""

    def __init__(self, entity_type, current_state, target_state):
        self.entity_type = entity_type
        self.current_state = current_state
        self.target_state = target_state
        super().__init__(
            f"{entity_type}: cannot transition from "
            f"'{current_state.value}' to '{target_state.value}'"
        )


class StateMachineMixin:
    """
    Mixin for SQLAlchemy models that use state enums.

    Subclasses must define:
      VALID_TRANSITIONS: dict mapping source_state -> set of allowed target_states
    """

    VALID_TRANSITIONS = {}

    def transition_to(self, new_state):
        """
        Validate and perform a state transition.
        Raises InvalidTransitionError if transition is not allowed.
        """
        current = self.state
        allowed = self.VALID_TRANSITIONS.get(current, set())

        if new_state not in allowed:
            raise InvalidTransitionError(
                self.__class__.__name__, current, new_state
            )

        self.state = new_state
        return True

    def can_transition_to(self, new_state):
        """Check if transition is valid without performing it."""
        allowed = self.VALID_TRANSITIONS.get(self.state, set())
        return new_state in allowed
