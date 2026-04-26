<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let copied = $state(false);
	let codeCopied = $state(false);
	let showAddFriend = $state(false);
	let addingId = $state<string | null>(null);
	let confirmLeave = $state(false);

	const inviteUrl = $derived(`${typeof window !== 'undefined' ? window.location.origin : ''}/groups/join/${data.group.invite_code}`);

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
	<div class="flex items-start justify-between">
		<div>
			<div class="flex items-center gap-2">
				<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">{data.group.name}</h1>
				<span class="text-xs border border-wire rounded px-1.5 py-0.5 text-faint">
					{data.group.is_public === false ? t('group_private') : t('group_public')}
				</span>
			</div>
			{#if data.group.description}
				<p class="text-muted text-sm mt-1">{data.group.description}</p>
			{/if}
		</div>
		{#if confirmLeave}
			<div class="flex items-center gap-2">
				<span class="text-xs text-faint">{t('group_confirm_question')}</span>
				<form method="POST" action="?/leave" use:enhance>
					<button type="submit" class="text-xs text-err font-semibold hover:opacity-80 transition-opacity cursor-pointer">
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
				class="text-sm text-faint hover:text-err transition-colors cursor-pointer">
				{t('group_leave')}
			</button>
		{/if}
	</div>

	<!-- Invite link + code -->
	<div class="rounded-xl bg-panel border border-wire p-4 space-y-3">
		<div>
			<p class="text-sm text-muted mb-2">{t('group_invite_link')}</p>
			<div class="flex gap-2">
				<code class="flex-1 rounded bg-raised px-3 py-2 text-sm text-muted font-mono truncate">
					{inviteUrl}
				</code>
				<button onclick={copyInvite}
					class="rounded bg-raised hover:bg-wire px-3 py-2 text-sm text-fg transition-colors cursor-pointer whitespace-nowrap">
					{copied ? t('group_copied') : t('group_copy')}
				</button>
			</div>
		</div>
		<div>
			<p class="text-sm text-muted mb-2">Code</p>
			<div class="flex gap-2">
				<code class="flex-1 rounded bg-raised px-3 py-2 text-sm text-fg font-mono tracking-widest font-semibold">
					{data.group.invite_code}
				</code>
				<button onclick={copyCode}
					class="rounded bg-raised hover:bg-wire px-3 py-2 text-sm text-fg transition-colors cursor-pointer whitespace-nowrap">
					{codeCopied ? t('group_copied') : t('group_copy')}
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
				<tr class="text-[11px] text-faint font-semibold border-b border-wire">
					<th class="px-4 py-2 text-left w-10">#</th>
					<th class="px-4 py-2 text-left">{t('group_player')}</th>
					<th class="px-4 py-2 text-right">{t('points')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.scoreboard as entry, i}
					{@const isMe = (entry.profile as any)?.id === data.user.id}
					<tr class="border-b border-wire/50 {isMe ? 'bg-accent-lo/60' : 'hover:bg-raised/30'} transition-colors">
						<td class="px-4 py-3 text-sm text-faint">{i + 1}</td>
						<td class="px-4 py-3">
							<a href="/profile/{(entry.profile as any)?.id}" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
								<span class="{isMe ? 'text-accent font-semibold' : 'text-fg'} text-sm">
									{(entry.profile as any)?.display_name ?? (entry.profile as any)?.username ?? '?'}
								</span>
								{#if entry.role === 'admin'}
									<span class="text-xs text-accent">★</span>
								{/if}
							</a>
						</td>
						<td class="px-4 py-3 text-right font-bold text-accent">{entry.points.toFixed(2)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		</div>
	</section>
</div>
