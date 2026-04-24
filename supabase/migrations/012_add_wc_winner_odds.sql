-- WC2026 winner odds per team, used to scale favorite-team bonus points.
-- multiplier = ROUND(LN(odds), 1) — natural log gives a balanced 1.7× (Spain)
-- to 8.0× (Haiti) range without exploding for big underdogs.
-- team_name_fr bridges match.home/away_team (English) → profiles.favorite_team (French).

CREATE TABLE IF NOT EXISTS public.wc_winner_odds (
    team_name_en  TEXT PRIMARY KEY,
    team_name_fr  TEXT NOT NULL,
    odds          NUMERIC NOT NULL CHECK (odds > 0),
    multiplier    NUMERIC GENERATED ALWAYS AS (ROUND(LN(odds)::NUMERIC, 1)) STORED
);

ALTER TABLE public.wc_winner_odds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_wc_odds" ON public.wc_winner_odds FOR SELECT USING (true);

INSERT INTO public.wc_winner_odds (team_name_en, team_name_fr, odds) VALUES
-- ── From screenshot ────────────────────────────────────────────────────────────
('Spain',              'Espagne',                  5.50),
('France',             'France',                   6.50),
('England',            'Angleterre',               7.00),
('Brazil',             'Brésil',                   9.00),
('Argentina',          'Argentine',                9.00),
('Portugal',           'Portugal',                12.00),
('Germany',            'Allemagne',               13.00),
('Netherlands',        'Pays-Bas',                21.00),
('Norway',             'Norvège',                 26.00),
('Belgium',            'Belgique',                34.00),
('Colombia',           'Colombie',                34.00),
('Japan',              'Japon',                   51.00),
('Morocco',            'Maroc',                   51.00),
('USA',                'Etats-Unis',              67.00),
('Uruguay',            'Uruguay',                 67.00),
('Switzerland',        'Suisse',                  81.00),
('Mexico',             'Mexique',                 81.00),
('Croatia',            'Croatie',                 81.00),
('Turkey',             'Turquie',                 81.00),
('Ecuador',            'Equateur',               101.00),
('Senegal',            'Sénégal',                126.00),
('Canada',             'Canada',                 151.00),
('Paraguay',           'Paraguay',               151.00),
('Egypt',              'Egypte',                 301.00),
('Czech Republic',     'République tchèque',     301.00),
('South Korea',        'Corée du Sud',           501.00),
('Australia',          'Australie',              501.00),
('IR Iran',            'Iran',                   501.00),
('DR Congo',           'Congo RD',               751.00),
('Saudi Arabia',       'Arabie Saoudite',       1001.00),
('Panama',             'Panama',                1501.00),
('New Zealand',        'Nouvelle-Zélande',      1501.00),
('Iraq',               'Irak',                  1501.00),
-- Screenshot also includes these non-WC2026 teams
('Sweden',             'Suède',                  126.00),
('Austria',            'Autriche',               151.00),
('Scotland',           'Ecosse',                 251.00),
('Bosnia-Herzegovina', 'Bosnie-Herzégovine',     251.00),
('Ivory Coast',        'Côte d''Ivoire',         301.00),
('Ghana',              'Ghana',                  401.00),
('Algeria',            'Algérie',                401.00),
('Tunisia',            'Tunisie',                501.00),
('South Africa',       'Afrique du Sud',        1001.00),
('Qatar',              'Qatar',                 1001.00),
('Uzbekistan',         'Ouzbékistan',           1501.00),
('Cape Verde',         'Cap-Vert',              2001.00),
('Curacao',            'Curaçao',               2001.00),
('Jordan',             'Jordanie',              2501.00),
('Haiti',              'Haïti',                 3001.00),
-- ── WC2026 qualified teams absent from screenshot (estimated odds) ─────────────
('Italy',              'Italie',                  26.00),
('Chile',              'Chili',                  151.00),
('Peru',               'Pérou',                  251.00),
('Ukraine',            'Ukraine',                251.00),
('Nigeria',            'Nigéria',                301.00),
('Venezuela',          'Venezuela',              501.00),
('Slovakia',           'Slovaquie',              501.00),
('Costa Rica',         'Costa Rica',             751.00),
('Bolivia',            'Bolivie',               1001.00),
('Jamaica',            'Jamaïque',              1001.00),
('Honduras',           'Honduras',              1001.00),
('Bahrain',            'Bahreïn',               2001.00),
('Indonesia',          'Indonésie',             2001.00),
('Dominican Republic', 'République dominicaine',3001.00)
ON CONFLICT (team_name_en) DO UPDATE SET
    team_name_fr = EXCLUDED.team_name_fr,
    odds         = EXCLUDED.odds;
