CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ducks (
    id UUID PRIMARY KEY
);

CREATE TABLE quests (
    id             UUID PRIMARY KEY,
    title          TEXT,
    description    TEXT,
    due            TEXT,
    status         TEXT,
    done           BOOLEAN,
    created_on     TIMESTAMPTZ,
    quest_parent_id UUID REFERENCES quests(id),
    duck_id        UUID NOT NULL REFERENCES ducks(id)
);
