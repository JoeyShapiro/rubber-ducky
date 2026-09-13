-- Collapse the three historical attachment encodings into the canonical one:
--   type    a bare mime type, eg  image/png
--   content a full data url,  eg  data:image/png;base64,...
--
-- Both legacy shapes are pure string rearrangements - no base64 is decoded here.
-- Rows that match neither are left untouched: if `content` holds a bare mime and `type` does
-- too, the payload was never written and there is nothing to recover.

-- 1. Old file picker: the constructor arguments were swapped, so the data url landed in `type`
--    and the mime type in `content`. Putting them back is the whole fix.
UPDATE attachments
SET type = content,
    content = type
WHERE type LIKE 'data:%;base64,%'
  AND content ~ '^[a-z]+/[a-z0-9.+-]+$';

-- 2. Old paste path: 'data:image/png' + 'base64,...' needs the two halves joined and the
--    prefix stripped off the mime. Postgres reads both right-hand sides from the old row, so
--    these can be set in one statement.
UPDATE attachments
SET content = type || ';' || content,
    type = substring(type FROM 6)
WHERE type LIKE 'data:%'
  AND type NOT LIKE '%;base64,%'
  AND content LIKE 'base64,%';
