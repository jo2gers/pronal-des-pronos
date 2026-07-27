<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS, teamLabel } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let pending = $state(false);

	// Returns a real flag image URL (works everywhere, no emoji rendering issues)
	function flagUrl(teamName: string | undefined, size = 40): string {
		if (!teamName) return '';
		const team = WC2026_TEAMS.find((t) => t.name === teamName);
		return team ? `/flags/${team.flag.toLowerCase()}?w=${size}` : '';
	}

	function formatDate(dt: string) {
		return new Date(dt).toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short' });
	}

	function pointsColor(pts: number | null) {
		if (pts === null) return 'text-faint';
		if (pts >= 3) return 'text-accent font-bold';
		if (pts > 0)  return 'text-fg font-medium';
		return 'text-muted';
	}

	function resultLabel(p: typeof data.pronostics[number]) {
		const m = p.match as any;
		if (!m || m.home_score == null) return '';
		if (p.predicted_home === m.home_score && p.predicted_away === m.away_score) return 'exact';
		const predResult = Math.sign(p.predicted_home - p.predicted_away);
		const realResult = Math.sign(m.home_score - m.away_score);
		return predResult === realResult ? 'correct' : 'wrong';
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">

	<!-- Profile header card -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<div class="flex items-start gap-4">
			<!-- Avatar -->
			{#if data.profile.avatar_url}
				<img src={data.profile.avatar_url} alt=""
					class="w-16 h-16 rounded-full object-cover shrink-0" />
			{:else}
				<div class="w-16 h-16 rounded-full bg-raised border border-wire flex items-center justify-center text-2xl font-bold text-muted shrink-0">
					{(data.profile.display_name ?? data.profile.username ?? '?')[0]?.toUpperCase()}
				</div>
			{/if}

			<!-- Identity -->
			<div class="flex-1 min-w-0 pt-0.5">
				<h1 class="text-2xl font-bold text-fg truncate leading-tight" style="font-family: var(--font-display); letter-spacing: 0.02em">
					{data.profile.display_name ?? data.profile.username}
				</h1>
				<!-- @handle is the account-creation name: show it only on your own
				     profile (so you still see your login handle), hide it from other
				     viewers. The display name (or username fallback) remains the title. -->
				{#if data.isOwnProfile}
					<p class="text-sm text-muted mt-0.5">@{data.profile.username}</p>
				{/if}
				{#if data.profile.country}
					<p class="text-sm text-faint mt-1">{data.profile.country}</p>
				{/if}
			</div>

			<!-- Edit button (own profile only) -->
			{#if data.isOwnProfile}
				<a href="/profile"
					class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-wire hover:border-accent bg-raised hover:bg-accent-lo px-3 py-2 text-sm font-semibold text-muted hover:text-accent transition-colors">
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
					</svg>
					{t('profile_edit')}
				</a>
			{:else if data.friendStatus === 'accepted'}
				<span class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-lo px-3 py-2 text-sm font-semibold text-accent">
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
					</svg>
					{t('friends_already_friends')}
				</span>
			{:else if data.friendStatus === 'pending_sent'}
				<span class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-wire bg-raised px-3 py-2 text-sm font-medium text-muted">
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					{t('friends_request_sent')}
				</span>
			{:else if data.friendStatus === 'pending_received' && data.friendshipId}
				<form method="POST" action="?/respond" use:enhance={() => {
					pending = true;
					return async ({ update }) => { pending = false; await update({ reset: false }); };
				}} class="shrink-0 inline-flex items-center gap-1">
					<input type="hidden" name="friendship_id" value={data.friendshipId} />
					<button name="action" value="accepted" type="submit" disabled={pending}
						class="rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-3 py-2 text-sm font-semibold text-canvas transition-colors cursor-pointer">
						{t('friends_accept')}
					</button>
					<button name="action" value="declined" type="submit" disabled={pending}
						class="rounded-lg border border-wire hover:border-wire-hi disabled:opacity-50 px-3 py-2 text-sm text-muted hover:text-fg transition-colors cursor-pointer">
						{t('friends_decline')}
					</button>
				</form>
			{:else if data.friendStatus === 'none' || data.friendStatus === 'declined'}
				<form method="POST" action="?/request" use:enhance={() => {
					pending = true;
					return async ({ update }) => { pending = false; await update({ reset: false }); };
				}} class="shrink-0">
					<button type="submit" disabled={pending}
						class="inline-flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-3 py-2 text-sm font-semibold text-canvas transition-colors cursor-pointer">
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
						</svg>
						{pending ? '…' : t('friends_add')}
					</button>
				</form>
			{/if}
		</div>

		{#if form?.error}
			<p class="mt-3 text-xs text-err">{form.error}</p>
		{:else if form?.requestSent}
			<p class="mt-3 text-xs text-accent">{t('friends_request_sent_confirm')}</p>
		{/if}

		<!-- Game switcher — this profile is scoped to ONE game (PL / UCL). -->
		{#if data.activeComps.length > 1 && data.currentComp}
			<div class="mt-4 flex gap-1 rounded-lg bg-raised border border-wire p-1 w-fit">
				{#each data.activeComps as c (c.slug)}
					<a href="/profile/{data.profile.id}?comp={c.slug}"
						class="rounded px-3 py-1 text-xs font-semibold transition-colors
							{c.slug === data.currentComp.slug ? 'bg-panel text-fg' : 'text-muted hover:text-fg'}">
						{getLang() === 'fr' ? c.name_fr : c.name_en}
					</a>
				{/each}
			</div>
		{/if}

		<!-- Favourite CLUB in the current game (crest, not a country flag) -->
		{#if data.favTeam}
			<div class="mt-5 pt-5 border-t border-wire flex items-center gap-4">
				{#if data.favTeamCrest}
					<img src={data.favTeamCrest} alt={data.favTeam}
						class="w-12 h-12 object-contain shrink-0" />
				{/if}
				<div class="flex-1 min-w-0">
					<p class="text-xs text-faint mb-0.5">{t('fav_team')}</p>
					<p class="text-2xl font-bold text-fg leading-tight truncate" style="font-family: var(--font-display)">
						{data.favTeamShort ?? data.favTeam}
					</p>
				</div>
				{#if data.teamOdds != null}
					<div class="text-right shrink-0">
						<p class="text-2xl font-bold tabular-nums leading-none text-accent" style="font-family: var(--font-display)">
							{data.teamOdds.toFixed(2)}<span class="text-sm font-normal text-faint ml-0.5">×</span>
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Stats: flat horizontal strip, no hero number -->
		<dl class="mt-6 pt-5 border-t border-wire flex flex-wrap items-baseline gap-x-4 gap-y-1.5 text-sm">
			<div class="flex items-baseline gap-1.5">
				<dt class="text-faint">{t('lb_total')}</dt>
				<dd class="text-lg font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
					{data.totalPoints.toFixed(2)}
				</dd>
			</div>
			<span class="text-wire-hi hidden sm:inline">·</span>
			<div class="flex items-baseline gap-1.5">
				<dt class="text-faint">{t('points')}</dt>
				<dd class="font-semibold text-fg tabular-nums">{data.pronoPoints.toFixed(2)}</dd>
			</div>
			{#if data.teamBonus > 0}
				<span class="text-wire-hi hidden sm:inline">·</span>
				<div class="flex items-baseline gap-1.5">
					<dt class="text-faint">{t('team_bonus_short')}</dt>
					<dd class="font-semibold tabular-nums" style="color: var(--color-bonus)">+{data.teamBonus.toFixed(2)}</dd>
				</div>
			{/if}
			<span class="text-wire-hi hidden sm:inline">·</span>
			<div class="flex items-baseline gap-1.5">
				<dt class="text-faint">{t('profile_winners')}</dt>
				<dd class="font-semibold text-fg tabular-nums">{data.winners}</dd>
			</div>
			<span class="text-wire-hi hidden sm:inline">·</span>
			<div class="flex items-baseline gap-1.5">
				<dt class="text-faint">{t('profile_exact')}</dt>
				<dd class="font-semibold text-fg tabular-nums">{data.exactScores}</dd>
			</div>
			<span class="text-wire-hi hidden sm:inline">·</span>
			<div class="flex items-baseline gap-1.5">
				<dt class="text-faint">{t('profile_picks_played')}</dt>
				<dd class="font-semibold text-fg tabular-nums">{data.totalPronoCount}</dd>
			</div>
		</dl>
	</div>

	<!-- Picks on matches currently in play (locked, not yet scored) -->
	{#if (data.livePicks ?? []).length > 0}
		<section class="pt-2">
			<header class="flex items-center gap-2 border-t border-wire pt-5 mb-3">
				<span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse"></span>
				<h2 class="text-base font-semibold text-fg">{t('profile_live_picks')}</h2>
			</header>
			<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0">
				{#each data.livePicks as p}
					{@const match = p.match as any}
					<a href="/matches/{match?.id}"
						class="flex items-center gap-3 px-4 py-3 border-b border-wire/40 last:border-0 hover:bg-raised/40 transition-colors">
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-fg truncate">{match?.home_team} – {match?.away_team}</p>
							<p class="text-xs text-faint mt-0.5">
								{#if match?.status === 'live'}
									<span class="text-live font-semibold">LIVE</span>
									· {match?.home_score ?? 0}–{match?.away_score ?? 0}
								{:else}
									{formatDate(match?.match_datetime)}
								{/if}
							</p>
						</div>
						<span class="text-sm font-mono tabular-nums text-fg shrink-0">
							{p.predicted_home}–{p.predicted_away}
						</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Pronostics history — flat section, full-bleed table on mobile -->
	<section class="pt-2">
		<header class="flex items-baseline justify-between border-t border-wire pt-5 mb-4">
			<h2 class="text-base font-semibold text-fg">{t('profile_history')}</h2>
			<span class="text-xs text-faint tabular-nums">{data.pronostics.length}</span>
		</header>

		{#if data.pronostics.length === 0}
			<div class="py-10 text-center">
				<p class="text-muted">{t('profile_empty')}</p>
				<p class="text-faint text-sm mt-1">{t('profile_empty_hint')}</p>
			</div>
		{:else}
			<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-wire overflow-hidden">
				<table class="w-full">
					<thead>
						<tr class="border-b border-wire bg-raised/30">
							<th class="px-4 py-3 text-left text-[11px] text-faint font-semibold">{t('profile_col_match')}</th>
							<th class="px-4 py-3 text-center text-[11px] text-faint font-semibold hidden sm:table-cell">{t('profile_col_result')}</th>
							<th class="px-4 py-3 text-center text-[11px] text-faint font-semibold">{t('profile_col_pick')}</th>
							<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold">Pts</th>
						</tr>
					</thead>
					<tbody>
						{#each data.pronostics as p}
							{@const match = p.match as any}
							{@const label = resultLabel(p)}
							<tr class="border-b border-wire/40 last:border-0 hover:bg-raised/30 transition-colors">
								<td class="px-4 py-3">
									<a href="/matches/{match?.id}" class="hover:text-accent transition-colors group">
										<div class="flex items-center gap-1.5 text-sm">
											<span class="hidden sm:inline font-medium text-fg group-hover:text-accent truncate max-w-[80px]">{match?.home_team}</span>
											<span class="text-faint mx-0.5">–</span>
											<span class="hidden sm:inline font-medium text-fg group-hover:text-accent truncate max-w-[80px]">{match?.away_team}</span>
											<span class="sm:hidden text-xs text-muted">{match?.home_team?.slice(0,3)} – {match?.away_team?.slice(0,3)}</span>
										</div>
										<p class="text-xs text-faint mt-0.5">{formatDate(match?.match_datetime)}</p>
									</a>
								</td>
								<td class="px-4 py-3 text-center text-sm tabular-nums text-muted hidden sm:table-cell">
									{match?.home_score ?? '?'}–{match?.away_score ?? '?'}
								</td>
								<td class="px-4 py-3 text-center">
									<span class="text-sm tabular-nums font-medium
										{label === 'exact' ? 'text-accent font-bold' : label === 'correct' ? 'text-fg' : 'text-muted'}">
										{p.predicted_home}–{p.predicted_away}
									</span>
									{#if label === 'exact'}
										<span class="block text-[10px] text-accent mt-0.5">{t('profile_result_exact')}</span>
									{:else if label === 'correct'}
										<span class="block text-[10px] text-muted mt-0.5">{t('profile_result_correct')}</span>
									{:else if label === 'wrong'}
										<span class="block text-[10px] text-faint mt-0.5">{t('profile_result_wrong')}</span>
									{/if}
									{#if (p as any).teamBonus != null && (p as any).teamBonus > 0}
										<span class="inline-flex items-baseline gap-1 mt-1 text-[10px] font-semibold tabular-nums"
											style="color: var(--color-bonus)"
											title="Bonus équipe — {data.favTeamShort ?? data.favTeam} a gagné">
											<span class="uppercase tracking-widest text-[9px] opacity-80">{t('match_team_bonus_chip')}</span>
											+{(p as any).teamBonus.toFixed(2)}
										</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-right tabular-nums {pointsColor(p.points_earned)}">
									{p.points_earned?.toFixed(2) ?? '–'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
