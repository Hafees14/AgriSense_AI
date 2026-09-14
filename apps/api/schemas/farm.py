from datetime import date, datetime

from pydantic import BaseModel, Field


class FarmCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    latitude: float | None = None
    longitude: float | None = None
    land_size_ha: float | None = None
    region: str | None = None


class FarmUpdate(BaseModel):
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    land_size_ha: float | None = None
    region: str | None = None


class FarmOut(BaseModel):
    id: str
    name: str
    latitude: float | None
    longitude: float | None
    land_size_ha: float | None
    region: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FieldCreate(BaseModel):
    crop_id: str | None = None
    planting_date: date | None = None
    expected_harvest_date: date | None = None
    area_ha: float | None = None


class FieldOut(BaseModel):
    id: str
    farm_id: str
    crop_id: str | None
    planting_date: date | None
    expected_harvest_date: date | None
    area_ha: float | None
    status: str

    model_config = {"from_attributes": True}
