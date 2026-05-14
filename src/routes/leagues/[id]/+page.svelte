<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let copied = $state(false);
	let codeCopied = $state(false);
	let showAddFriend = $state(false);
	let addingId = $state<string | null>(null);
	let confirmLeave = $state(false);

	const inviteUrl = $derived(`${typeof window !== 'undefined' ? window.location.origin : ''}/leagues/join/${data.group.invite_code}`);

	function copyInvite() {
		navigator.clipboard.writeText(inviteUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function copyCode() {
		navigator.clipboard.writeText(data.group.invite_code);
		codeCopied = true;
		setTimeout(() => (codeCopied = false), 2000);
	}

	const canAddMembers = $derived(
		data.isAdmin || (data.group.is_public !== false)
	);
</script>

<div class="space-y-6">
	<div>
		<div class="flex items-baseline gap-2 flex-wrap">
			<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">{data.group.name}</h1>
			<span class="text-xs border border-wire rounded px-1.5 py-0.5 text-faint">
				{data.group.is_public === false ? t('group_private') : t('group_public')}
			</span>
		</div>
		{#if data.group.description}
			<p class="text-muted text-sm mt-1">{data.group.description}</p>
		{/if}
	</div>

	<!-- Pending join requests (admin only) -->
	{#if data.isAdmin && data.pendingRequests.length > 0}
		<div class="rounded-xl bg-panel border border-accent/30 p-4">
			<h2 class="text-base font-semibold text-accent mb-3 flex items-baseline gap-2" style="font-family: var(--font-display)">
				{t('groups_pending_title')}
				<span class="text-xs text-accent/70 font-normal tabular-nums">{data.pendingRequests.length}</span>
			</h2>
			<div class="space-y-2">
				{#each data.pendingRequests as req}
					<div class="flex items-center gap-3 rounded-lg bg-raised px-3 py-2">
						{#if req.profiles?.avatar_url}
							<img src={req.profiles.avatar_url} alt="" class="w-8 h-8 rounded-full object-cover shrink-0" />
						{:else}
							<span class="w-8 h-8 rounded-full bg-wire flex items-center justify-center text-sm text-faint font-bold shrink-0">
								{req.profiles?.username?.[0]?.toUpperCase() ?? '?'}
							</span>
						{/if}
						<div class="flex-1 min-w-0">
							<p class="text-sm text-fg font-medium truncate">
								{req.profiles?.display_name ?? req.profiles?.username ?? '?'}
							</p>
							<p class="text-xs text-faint">@{req.profiles?.username}</p>
						</div>
						<div class="flex gap-2 shrink-0">
							<form method="POST" action="?/approveRequest" use:enhance>
								<input type="hidden" name="request_id" value={req.id} />
								<button type="submit"
									class="rounded bg-accent hover:bg-accent-hi px-3 py-1 text-xs text-canvas transition-colors cursor-pointer">
									{t('groups_approve')}
								</button>
							</form>
							<form method="POST" action="?/declineRequest" use:enhance>
								<input type="hidden" name="request_id" value={req.id} />
								<button type="submit"
									class="rounded bg-raised hover:bg-wire border border-wire px-3 py-1 text-xs text-muted transition-colors cursor-pointer">
									{t('groups_decline')}
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Invite — single row with two copy actions -->
	<div class="rounded-xl bg-panel border border-wire p-4">
		<p class="text-sm text-muted mb-2">{t('group_invite_link')}</p>
		<div class="flex flex-wrap items-center gap-2">
			<code class="flex-1 min-w-0 rounded bg-raised px-3 py-2 text-sm text-muted font-mono truncate">{inviteUrl}</code>
			<div class="inline-flex rounded border border-wire overflow-hidden shrink-0">
				<button onclick={copyInvite}
					class="bg-raised hover:bg-wire px-3 py-2 text-xs text-fg transition-colors cursor-pointer whitespace-nowrap border-r border-wire">
					{copied ? t('group_copied') : t('group_copy_link')}
				</button>
				<button onclick={copyCode}
					class="bg-raised hover:bg-wire px-3 py-2 text-xs text-fg transition-colors cursor-pointer whitespace-nowrap font-mono tracking-widest">
					{codeCopied ? t('group_copied') : data.group.invite_code}
				</button>
			</div>
		</div>
	</div>

	<!-- Add a friend -->
	{#if canAddMembers && data.friendsNotInGroup.length > 0}
		<div class="rounded-xl bg-panel border border-wire p-4">
			<button
				onclick={() => showAddFriend = !showAddFriend}
				class="w-full flex items-center justify-between text-sm font-semibold text-fg">
				<span>{t('group_add_friend')}</span>
				<span class="text-faint text-xs">{showAddFriend ? '▲' : '▼'}</span>
			</button>

			{#if showAddFriend}
				<div class="mt-3 space-y-2">
					{#if form?.error}
						<p class="text-sm text-err">{form.error}</p>
					{/if}
					{#if form?.inviteSent}
						<p class="text-sm text-accent">{t('group_invite_sent')}</p>
					{/if}
					{#each data.friendsNotInGroup as friend}
						<div class="flex items-center gap-3 rounded-lg bg-raised px-3 py-2">
							{#if friend.avatar_url}
								<img src={friend.avatar_url} alt="" class="w-7 h-7 rounded-full object-cover shrink-0" />
							{:else}
								<span class="w-7 h-7 rounded-full bg-wire flex items-center justify-center text-xs font-bold text-faint shrink-0">
									{(friend.display_name ?? friend.username ?? '?')[0]?.toUpperCase()}
								</span>
							{/if}
							<span class="flex-1 text-sm text-fg">{friend.display_name ?? friend.username}</span>
							<form method="POST" action="?/addFriend" use:enhance={() => {
								addingId = friend.id;
								return async ({ update }) => { addingId = null; await update({ reset: false }); };
							}}>
								<input type="hidden" name="friend_id" value={friend.id} />
								<button type="submit" disabled={addingId === friend.id}
									class="rounded bg-accent hover:bg-accent-hi disabled:opacity-40 px-3 py-1 text-xs text-canvas transition-colors cursor-pointer">
									{addingId === friend.id ? '...' : t('group_add')}
								</button>
							</form>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Scoreboard — flat section, full-bleed table on mobile -->
	<section class="border-t border-wire pt-5">
		<header class="flex items-baseline justify-between mb-4 px-1">
			<h2 class="text-base font-semibold text-fg" style="font-family: var(--font-display)">{t('group_scoreboard')}</h2>
			<span class="text-xs text-faint tabular-nums">{data.scoreboard.length}</span>
		</header>
		<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:bg-panel/40 sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0">
		<table class="w-full">
			<thead>
				<tr class="text-[11px] text-faint font-semibold border-b border-wire uppercase tracking-widest">
					<th class="px-3 py-2.5 text-left w-10">#</th>
					<th class="px-3 py-2.5 text-left">{t('group_player')}</th>
					<th class="px-2 py-2.5 text-right hidden md:table-cell">{t('group_col_picks')}</th>
					<th class="px-2 py-2.5 text-right hidden md:table-cell">{t('group_col_winner')}</th>
					<th class="px-2 py-2.5 text-right hidden sm:table-cell">{t('group_col_exact')}</th>
					<th class="px-2 py-2.5 text-right hidden sm:table-cell">{t('group_col_team_bonus')}</th>
					<th class="px-3 py-2.5 text-right">{t('group_col_total')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.scoreboard as entry, i}
					{@const p = entry.profile as any}
					{@const isMe = p?.id === data.user.id}
					{@const name = p?.display_name ?? p?.username ?? p?.id?.slice(0, 6) ?? '—'}
					<tr class="border-b border-wire/50 {isMe ? 'bg-accent-lo/60' : 'hover:bg-raised/30'} transition-colors">
						<td class="px-3 py-3 text-sm text-faint tabular-nums">{i + 1}</td>
						<td class="px-3 py-3">
							<a href="/profile/{p?.id}" class="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
								{#if p?.avatar_url}
									<img src={p.avatar_url} alt="" class="w-7 h-7 rounded-full object-cover shrink-0 {isMe ? 'ring-1 ring-accent' : ''}" />
								{:else}
									<span class="w-7 h-7 rounded-full bg-raised border border-wire flex items-center justify-center text-xs font-bold text-muted shrink-0">
										{name[0]?.toUpperCase()}
									</span>
								{/if}
								<span class="{isMe ? 'text-accent font-semibold' : 'text-fg'} text-sm truncate">
									{name}
								</span>
								{#if entry.role === 'admin'}
									<span class="text-xs text-accent" title="admin">★</span>
								{/if}
							</a>
						</td>
						<td class="px-2 py-3 text-right text-sm text-muted tabular-nums hidden md:table-cell">{entry.picks}</td>
						<td class="px-2 py-2 text-right text-sm text-muted tabular-nums hidden md:table-cell">{entry.winners}</td>
						<td class="px-2 py-2 text-right text-sm text-accent font-semibold tabular-nums hidden sm:table-cell">{entry.exact}</td>
						<td class="px-2 py-2 text-right text-sm tabular-nums hidden sm:table-cell">
							{#if entry.teamBonus > 0}
								<span class="font-semibold" style="color: var(--color-bonus)">+{entry.teamBonus.toFixed(2)}</span>
							{:else}
								<span class="text-faint">—</span>
							{/if}
						</td>
						<td class="px-3 py-3 text-right font-bold text-accent tabular-nums" style="font-family: var(--font-display)">{entry.points.toFixed(2)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		</div>
	</section>

	<!-- Leave group — danger zone, bottom of page -->
	<section class="border-t border-wire pt-5 flex items-center justify-end flex-wrap gap-3">
		{#if confirmLeave}
			<div class="flex items-center gap-3">
				<span class="text-xs text-faint">{t('group_confirm_question')}</span>
				<form method="POST" action="?/leave" use:enhance>
					<button type="submit"
						class="rounded bg-err/10 border border-err/40 hover:bg-err/20 px-3 py-1.5 text-xs text-err transition-colors cursor-pointer">
						{t('group_yes_leave')}
					</button>
				</form>
				<button onclick={() => confirmLeave = false}
					class="text-xs text-muted hover:text-fg transition-colors cursor-pointer">
					{t('cancel')}
				</button>
			</div>
		{:else}
			<button onclick={() => confirmLeave = true}
				class="rounded border border-err/30 hover:border-err/60 px-3 py-1.5 text-xs text-err/70 hover:text-err transition-colors cursor-pointer">
				{t('group_leave')}
			</button>
		{/if}
	</section>
</div>
