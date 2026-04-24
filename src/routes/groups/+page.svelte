<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();

	let showJoinInput = $state(false);
	let joiningCode   = $state(false);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between gap-3 flex-wrap">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('groups_title')}
		</h1>
		<div class="flex items-center gap-2">
			<button
				onclick={() => (showJoinInput = !showJoinInput)}
				class="rounded-lg border border-wire hover:border-accent px-4 py-2 text-sm font-semibold text-muted hover:text-fg transition-colors cursor-pointer">
				{t('groups_join_code')}
			</button>
			<a href="/groups/new"
				class="rounded-lg bg-accent hover:bg-accent-hi px-4 py-2 text-sm font-bold text-canvas transition-colors">
				{t('groups_create')}
			</a>
		</div>
	</div>

	<!-- Join by code form -->
	{#if showJoinInput}
		<div class="rounded-xl bg-panel border border-wire p-4">
			<form method="POST" action="?/joinByCode" use:enhance={() => {
				joiningCode = true;
				return async ({ update }) => { joiningCode = false; await update(); showJoinInput = false; };
			}} class="flex gap-2">
				<input
					name="code" type="text" required maxlength="12"
					value={form?.code ?? ''}
					placeholder={t('groups_code_placeholder')}
					class="flex-1 rounded-lg bg-raised border border-wire px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none uppercase tracking-widest font-mono"
				/>
				<button type="submit" disabled={joiningCode}
					class="rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2 text-sm font-semibold text-canvas transition-colors">
					{joiningCode ? t('groups_joining') : t('groups_join')}
				</button>
			</form>

			{#if form?.joinSuccess}
				<p class="mt-2 text-sm text-accent">{t('groups_request_sent')}</p>
			{:else if form?.joinError === 'invalid_code'}
				<p class="mt-2 text-sm text-err">{t('groups_invalid_code')}</p>
			{:else if form?.joinError === 'already_member'}
				<p class="mt-2 text-sm text-muted">{t('groups_already_member')}</p>
			{:else if form?.joinError}
				<p class="mt-2 text-sm text-err">{form.joinError}</p>
			{/if}
		</div>
	{/if}

	<!-- Admin: pending join requests to approve -->
	{#if data.pendingRequests.length > 0}
		<div class="rounded-xl bg-panel border border-wire p-4">
			<h2 class="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
				{t('groups_pending_title')}
				<span class="rounded-full bg-err/15 text-err text-[10px] font-bold px-1.5 py-0.5 leading-none">
					{data.pendingRequests.length}
				</span>
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
							<p class="text-sm text-fg truncate">
								<span class="font-medium">{req.profiles?.display_name ?? req.profiles?.username ?? '?'}</span>
								<span class="text-faint"> {t('groups_wants_to_join')} </span>
								<span class="text-muted font-semibold">{req.group_name}</span>
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

	<!-- User's own pending requests (not yet a member) -->
	{#if data.myPendingRequests.length > 0}
		<div class="rounded-xl bg-panel border border-wire/60 p-4">
			<h2 class="text-sm font-semibold text-muted mb-3">{t('groups_my_requests')}</h2>
			<div class="space-y-2">
				{#each data.myPendingRequests as req}
					<div class="flex items-center gap-3 rounded-lg bg-raised px-3 py-2">
						<div class="flex-1">
							<p class="text-sm text-fg font-medium">{req.group_name}</p>
							<p class="text-xs text-faint">{t('groups_awaiting')}</p>
						</div>
						<span class="text-[10px] text-faint border border-wire rounded px-2 py-0.5 font-mono">
							{t('groups_request_pending')}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- User's pending group invites -->
	{#if data.myPendingInvites.length > 0}
		<div class="rounded-xl bg-panel border border-accent/30 p-4">
			<h2 class="text-sm font-semibold text-accent mb-3 flex items-center gap-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
				</svg>
				Invitations aux groupes
				<span class="rounded-full bg-accent/15 text-accent text-[10px] font-bold px-1.5 py-0.5 leading-none">
					{data.myPendingInvites.length}
				</span>
			</h2>
			<div class="space-y-3">
				{#each data.myPendingInvites as invite}
					<div class="rounded-lg bg-raised border border-wire p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<p class="text-base font-bold text-fg leading-tight">{invite.group_name}</p>
								{#if invite.group_description}
									<p class="text-sm text-muted mt-1 leading-snug">{invite.group_description}</p>
								{/if}
								<p class="text-xs text-faint mt-2 flex items-center gap-1">
									<svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
									</svg>
									Invité par <span class="text-muted font-medium ml-0.5">{invite.invited_by?.display_name ?? invite.invited_by?.username ?? '?'}</span>
								</p>
							</div>
						</div>
						<div class="flex gap-2 mt-3">
							<form method="POST" action="?/respondToInvite" use:enhance>
								<input type="hidden" name="invite_id" value={invite.id} />
								<button name="action" value="accepted" type="submit"
									class="rounded-lg bg-accent hover:bg-accent-hi px-4 py-1.5 text-sm font-semibold text-canvas transition-colors cursor-pointer">
									Accepter
								</button>
							</form>
							<form method="POST" action="?/respondToInvite" use:enhance>
								<input type="hidden" name="invite_id" value={invite.id} />
								<button name="action" value="declined" type="submit"
									class="rounded-lg bg-raised hover:bg-wire border border-wire px-4 py-1.5 text-sm text-muted transition-colors cursor-pointer">
									Refuser
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Groups list -->
	{#if data.groups.length === 0}
		<div class="rounded-xl bg-panel border border-wire p-8 text-center">
			<p class="text-muted mb-4">{t('groups_empty')}</p>
			<p class="text-sm text-faint">{t('groups_empty_hint')}</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each data.groups as group}
				<a href="/groups/{group.id}"
					class="rounded-xl bg-panel border border-wire hover:border-accent p-5 transition-colors block">
					<div class="flex items-start justify-between mb-2">
						<h3 class="font-semibold text-fg text-lg">{group.name}</h3>
						{#if group.role === 'admin'}
							<span class="text-xs bg-accent-lo text-accent rounded px-2 py-0.5">Admin</span>
						{/if}
					</div>
					{#if group.description}
						<p class="text-sm text-muted mb-3 line-clamp-2">{group.description}</p>
					{/if}
					<p class="text-xs text-faint font-mono tracking-wider">{group.invite_code}</p>
				</a>
			{/each}
		</div>
	{/if}
</div>
