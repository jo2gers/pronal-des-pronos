-- 021: Pronostics visibility + 5-minute lock hardening
--
-- Visibility rule requested for launch: your own picks are always readable;
-- EVERYONE's picks become readable once a match is locked (5 minutes before
-- kickoff). Before the lock, nobody can read anyone else's pick — this also
-- closes the old loophole where league-mates could read each other's picks
-- pre-kickoff and copy them.
--
-- Write rules are aligned on the same 5-minute cutoff (the server actions
-- already enforce it; RLS is the belt-and-suspenders layer).

DROP POLICY IF EXISTS pronostics_select ON pronostics;
CREATE POLICY pronostics_select ON pronostics FOR SELECT USING (
	auth.uid() = user_id
	OR EXISTS (
		SELECT 1 FROM matches m
		WHERE m.id = pronostics.match_id
			AND m.match_datetime - interval '5 minutes' <= now()
	)
);

DROP POLICY IF EXISTS pronostics_insert_own ON pronostics;
CREATE POLICY pronostics_insert_own ON pronostics FOR INSERT WITH CHECK (
	auth.uid() = user_id
	AND EXISTS (
		SELECT 1 FROM matches m
		WHERE m.id = pronostics.match_id
			AND m.match_datetime - interval '5 minutes' > now()
	)
);

DROP POLICY IF EXISTS pronostics_update_own ON pronostics;
CREATE POLICY pronostics_update_own ON pronostics FOR UPDATE USING (
	auth.uid() = user_id
	AND EXISTS (
		SELECT 1 FROM matches m
		WHERE m.id = pronostics.match_id
			AND m.match_datetime - interval '5 minutes' > now()
	)
);
