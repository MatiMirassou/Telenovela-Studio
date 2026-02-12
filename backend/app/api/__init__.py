"""
Shared API utilities
"""

from typing import Optional, List


def parse_state_filter(state_param: Optional[str]) -> Optional[List[str]]:
    """Parse comma-separated state query param into a list of state strings.
    Returns None if no filter was provided (meaning: return all).
    """
    if not state_param:
        return None
    return [s.strip().lower() for s in state_param.split(",") if s.strip()]
