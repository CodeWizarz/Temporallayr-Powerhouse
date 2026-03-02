"""Base models for the SDK."""

from pydantic import BaseModel, ConfigDict


class TemporalLayrBaseModel(BaseModel):
    """Base class for all TemporalLayr Pydantic models with standard config."""

    model_config = ConfigDict(
        populate_by_name=True,
        str_strip_whitespace=True,
    )
