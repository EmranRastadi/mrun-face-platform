-- Creates one database per bounded context (runs on first Postgres boot).
CREATE DATABASE users;
CREATE DATABASE cards;
CREATE DATABASE enrollment;
CREATE DATABASE identity;
CREATE DATABASE audit;
