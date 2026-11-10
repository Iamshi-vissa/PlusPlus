-- Phase 1: extensions every later migration depends on.
-- PostGIS: geography points, KNN search, "inside Karnataka?" checks.
-- pg_trgm: typo-tolerant place-name search.
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
