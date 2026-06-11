-- 022: A user with a pending join request can read the group row (name + code).
-- Before this, groups RLS only allowed members and invitees, so the requester's
-- own "pending request" card showed neither the league name nor the code they
-- used. They necessarily knew the invite code already — they used it to create
-- the request — so this only restores information they had at request time.
CREATE POLICY groups_select_requested ON groups FOR SELECT USING (
	id IN (
		SELECT group_id FROM group_join_requests
		WHERE user_id = auth.uid() AND status = 'pending'
	)
);
