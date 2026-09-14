"""
Run with: python -m apps.api.db.seed
"""
from apps.api.db.session import SessionLocal
from apps.api.models.plant import Disease, Pest, Plant
from apps.api.models.user import Role

ROLES = ["farmer", "officer", "researcher", "admin"]

PLANTS = [
    {"scientific_name": "Solanum lycopersicum", "common_name": "Tomato", "category": "vegetable"},
    {"scientific_name": "Oryza sativa", "common_name": "Rice", "category": "grain"},
    {"scientific_name": "Manihot esculenta", "common_name": "Cassava", "category": "root crop"},
]

DISEASES = [
    {
        "name": "Early Blight",
        "causes": "Fungal pathogen Alternaria solani, favored by warm, humid conditions.",
        "organic_treatment": "Remove affected leaves; apply copper-based fungicide or neem oil.",
        "chemical_treatment": "Chlorothalonil or mancozeb-based fungicide per label instructions.",
        "prevention_tips": "Crop rotation, adequate plant spacing, avoid overhead watering.",
        "severity_scale": "moderate",
    },
    {
        "name": "Rice Blast",
        "causes": "Fungal pathogen Magnaporthe oryzae.",
        "organic_treatment": "Silicon-based soil amendments; resistant varieties.",
        "chemical_treatment": "Tricyclazole-based fungicide.",
        "prevention_tips": "Balanced nitrogen fertilization; avoid dense planting.",
        "severity_scale": "high",
    },
]

PESTS = [
    {
        "name": "Tomato Fruitworm",
        "risk_level": "high",
        "life_cycle": "Egg -> larva (damaging stage) -> pupa -> moth, ~30 days.",
        "damage_description": "Larvae bore into fruit, causing direct crop loss.",
        "treatment": "Bacillus thuringiensis (Bt) spray or approved insecticide.",
    },
]


def seed():
    db = SessionLocal()
    try:
        for role_name in ROLES:
            if not db.query(Role).filter(Role.name == role_name).first():
                db.add(Role(name=role_name))
        for p in PLANTS:
            if not db.query(Plant).filter(Plant.common_name == p["common_name"]).first():
                db.add(Plant(**p))
        for d in DISEASES:
            if not db.query(Disease).filter(Disease.name == d["name"]).first():
                db.add(Disease(**d))
        for pest in PESTS:
            if not db.query(Pest).filter(Pest.name == pest["name"]).first():
                db.add(Pest(**pest))
        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
