-- Creates one database + role per bounded context (runs on first Postgres boot).
-- Passwords match the k8s Secret values in infrastructure/apps/*.
-- PostgreSQL 15+ revokes CREATE on schema "public" from non-owner roles, so each
-- application role is granted ownership of its database's public schema.
CREATE DATABASE users;
CREATE DATABASE cards;
CREATE DATABASE enrollment;
CREATE DATABASE identity;
CREATE DATABASE audit;
CREATE DATABASE keycloak;

CREATE USER users WITH PASSWORD '123456';
CREATE USER cards_user WITH PASSWORD '123456';
CREATE USER enrollment WITH PASSWORD 'change-me';
CREATE USER keycloak WITH PASSWORD 'keycloak';

GRANT ALL PRIVILEGES ON DATABASE users TO users;
GRANT ALL PRIVILEGES ON DATABASE cards TO cards_user;
GRANT ALL PRIVILEGES ON DATABASE enrollment TO enrollment;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;

\connect users
GRANT ALL ON SCHEMA public TO users;
ALTER SCHEMA public OWNER TO users;

\connect cards
GRANT ALL ON SCHEMA public TO cards_user;
ALTER SCHEMA public OWNER TO cards_user;

\connect enrollment
GRANT ALL ON SCHEMA public TO enrollment;
ALTER SCHEMA public OWNER TO enrollment;

\connect keycloak
GRANT ALL ON SCHEMA public TO keycloak;
ALTER SCHEMA public OWNER TO keycloak;
