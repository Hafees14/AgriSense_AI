from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

LocationSource = Literal["manual", "gps", "geocoded"]


class FarmCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_source: LocationSource | None = None
    address: str | None = Field(default=None, max_length=255)
    land_size_ha: float | None = None
    region: str | None = None
    farm_type: str | None = Field(default=None, max_length=80)
    main_crops: str | None = Field(default=None, max_length=255)


class FarmUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_source: LocationSource | None = None
    address: str | None = Field(default=None, max_length=255)
    land_size_ha: float | None = None
    region: str | None = None
    farm_type: str | None = Field(default=None, max_length=80)
    main_crops: str | None = Field(default=None, max_length=255)


class FarmOut(BaseModel):
    id: str
    name: str
    latitude: float | None
    longitude: float | None
    location_source: LocationSource | None = None
    address: str | None = None
    land_size_ha: float | None
    region: str | None
    farm_type: str | None = None
    main_crops: str | None = None
    image_url: str | None = None
    created_at: datetime
    updated_at: datetime

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