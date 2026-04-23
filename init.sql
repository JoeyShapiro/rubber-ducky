CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_on  TIMESTAMPTZ,
    expires_on  TIMESTAMPTZ
);

CREATE TABLE badlings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT,
    description TEXT,
    created_on  TIMESTAMPTZ
);

CREATE TABLE ducks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT,
    description TEXT,
    created_on  TIMESTAMPTZ,
    badling_id  UUID REFERENCES badlings(id)
);

-- content is vectorized via text2VecTransformers
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "from"      TEXT,
    content     TEXT,
    embedding   vector(768),
    timestamp   TIMESTAMPTZ,
    duck_id     UUID NOT NULL REFERENCES ducks(id)
);

-- content is vectorized via text2VecTransformers
CREATE TABLE attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT,
    type        TEXT,
    content     TEXT,
    embedding   vector(768),
    message_id  UUID NOT NULL REFERENCES messages(id)
);

CREATE TABLE answers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promt       TEXT,
    content     TEXT,
    timestamp   TIMESTAMPTZ,
    messages    TEXT
);

-- content is vectorized via text2VecTransformers
CREATE TABLE notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content     TEXT,
    embedding   vector(768),
    duck_id     UUID NOT NULL REFERENCES ducks(id)
);

CREATE TABLE quests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT,
    description     TEXT,
    due             TEXT,
    status          TEXT,
    done            BOOLEAN,
    created_on      TIMESTAMPTZ,
    updated_on      TIMESTAMPTZ,
    quest_parent_id UUID REFERENCES quests(id),
    duck_id         UUID NOT NULL REFERENCES ducks(id)
);

-- Sample Data

INSERT INTO badlings (id, name, description, created_on) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Projects', 'My projects', NOW()),
    ('a0000000-0000-0000-0000-000000000002', 'Games', 'shrug', NOW()),
    ('a0000000-0000-0000-0000-000000000003', 'Misc', 'Misc (however you spell it) ideas and thoughts', NOW());

INSERT INTO ducks (id, name, description, created_on, badling_id) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'rubber-ducky', 'A rubber duck', NOW(), 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000002', 'coca', 'A coca', NOW(), 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000003', 'quake', 'A quake', NOW(), 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000004', 'dota', 'A dota', NOW(), 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000005', 'Ideas', 'random ideas i have', NOW(), 'a0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0000-000000000006', 'talk', 'random things to talk about', NOW(), 'a0000000-0000-0000-0000-000000000003');

INSERT INTO messages (id, "from", content, timestamp, duck_id) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'user', 'Hello world', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000002', 'user', 'vecdb', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000003', 'user', 'svelte', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000004', 'user', 'this is a very long message. i use weaviate as the db which is a vector db. svelte is the front end. of course i use bootstrap. svelte is also my backend... i think that is about it', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000005', 'user', 'fireship gave a tutorial on how to use this all', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000006', 'user', 'the docs have good data, but it isnt very helpful', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000007', 'user', '```c\ninclude <stdio.h>\nint main() {\nprintf("hello");\nreturn0;\n}```', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000008', 'user', '`test`', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000009', 'user', '`python test.py`', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000010', 'user', '`docker compose up --build -d`', NOW(), 'd0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000011', 'user', '`bun schema.ts`', NOW(), 'd0000000-0000-0000-0000-000000000001');

INSERT INTO quests (id, title, description, status, done, created_on, updated_on, quest_parent_id, duck_id) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'Add Quest persistence', 'Wire quests to Weaviate so they survive a page reload.', 'completed', true, NOW(), NOW(), NULL, 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000002', 'Support subtasks', 'Allow quests to have child quests via questParentId references.', 'completed', true, NOW(), NOW(), NULL, 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000003', 'Add due date picker', 'Replace the plain text due field with a real date input in the modal.', 'active', false, NOW(), NOW(), NULL, 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000004', 'Quest filtering', 'Add a filter bar to show only active, completed, or aborted quests.', 'inactive', false, NOW(), NOW(), NULL, 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000005', 'Design questParentId schema', 'Add questParentId text property to the Quest collection.', 'completed', true, NOW(), NOW(), 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000006', 'Update API endpoints', 'Pass quest_parent in POST body; return it in the response.', 'completed', true, NOW(), NOW(), 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000007', 'Build breadcrumb UI', 'Show a clickable breadcrumb trail when drilling into subquests.', 'completed', true, NOW(), NOW(), 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000008', 'Replace icon with count', 'Show child count on the icon when a quest has subquests.', 'completed', true, NOW(), NOW(), 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000009', 'Add date input to modal', 'Swap the plain text due field for an <input type="date">.', 'active', false, NOW(), NOW(), 'f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000010', 'Format date for display', 'Show a human-readable date string on the quest card.', 'inactive', false, NOW(), NOW(), 'f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001');
