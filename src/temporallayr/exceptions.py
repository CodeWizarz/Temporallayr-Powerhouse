"""
Core exceptions for TemporalLayr SDK.
"""


class TemporalLayrError(Exception):
    """Base exception for all TemporalLayr errors."""

    pass


class ConfigurationError(TemporalLayrError):
    """Raised when there is a configuration-related error."""

    pass
