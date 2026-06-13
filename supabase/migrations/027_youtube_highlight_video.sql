-- 027: Official FIFA WC highlights — the YouTube video id matched to each
-- match from the "2026 FIFA World Cup Match Highlights" playlist (by the team
-- names in the title). Embedded via youtube-nocookie on the match page. Set
-- once, when the highlight publishes (hours after the match).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS youtube_video_id text;
