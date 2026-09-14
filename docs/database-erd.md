# Database Schema (MySQL)

All primary keys are CHAR(36) UUIDs, utf8mb4.

roles -> users -> sessions
users -> farms -> fields -> sensor_readings (future/IoT)
farms -> weather_cache, recommendations
users -> diagnoses -> plants/diseases/pests (via result_id, app-level)
users -> chat_history, notifications
plants <-> diseases (disease_plants)
fields -> plants (crop_id)

Notes:
- diagnoses.result_id is polymorphic (resolved at app layer, not DB constraint)
- diagnoses.progress_group_id links successive uploads for disease progress tracking
- sensor_readings exists but is unused by the MVP (IoT integration point)
- diagnoses.needs_expert_review is set automatically below the confidence threshold
