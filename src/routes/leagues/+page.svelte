<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, getLang } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const fr = $derived(getLang() === 'fr');

	let showJoinInput = $state(false);
	let joiningCode   = $state(false);
	let showActivity  = $state(false);

	const myActivityCount = $derived(
		(data.myPendingRequests?.length ?? 0) + (data.myPendingInvites?.length ?? 0)
	);
</script>

<div class="space-y-8">
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
			<a href="/leagues/new"
				class="rounded-lg bg-accent hover:bg-accent-hi px-4 py-2 text-sm font-bold text-canvas transition-colors">
				{t('groups_create')}
			</a>
		</div>
	</div>

	<!-- Join by code form (inline, no chassis) -->
	{#if showJoinInput}
		<form method="POST" action="?/joinByCode" use:enhance={() => {
			joiningCode = true;
			return async ({ result, update }) => { joiningCode = false; await update(); if (result.type === 'redirect' || result.type === 'success') showJoinInput = false; };
		}} class="space-y-2">
			<div class="flex gap-2">
				<input
					name="code" type="text" required maxlength="12"
					value={form?.code ?? ''}
					placeholder={t('groups_code_placeholder')}
					class="flex-1 rounded-lg bg-raised border border-wire px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none lowercase tracking-widest font-mono"
				/>
				<button type="submit" disabled={joiningCode}
					class="rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2 text-sm font-semibold text-canvas transition-colors cursor-pointer">
					{joiningCode ? t('groups_joining') : t('groups_join')}
				</button>
			</div>

			{#if form?.joinSuccess}
				<p class="text-sm text-accent">{t('groups_request_sent')}</p>
			{:else if form?.joinError === 'invalid_code'}
				<p class="text-sm text-err">{t('groups_invalid_code')}</p>
			{:else if form?.joinError === 'already_member'}
				<p class="text-sm text-muted">{t('groups_already_member')}</p>
			{:else if form?.joinError}
				<div>
					<p class="text-sm text-err">{t('groups_join_generic_error')}</p>
					<details class="mt-1">
						<summary class="text-[11px] text-faint hover:text-muted cursor-pointer select-none transition-colors">
							{t('join_error_details')}
						</summary>
						<p class="mt-1 text-[11px] text-faint font-mono break-all">{form.joinError}</p>
					</details>
				</div>
			{/if}
		</form>
	{/if}

	<!-- Admin: pending join requests to approve -->
	{#if data.pendingRequests.length > 0}
		<section class="space-y-3">
			<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs flex items-baseline gap-2">
				{t('groups_pending_title')}
				<span class="text-xs text-faint font-normal tabular-nums normal-case tracking-normal">{data.pendingRequests.length}</span>
			</h2>
			<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire">
				{#each data.pendingRequests as req}
					<div class="flex items-center gap-3 px-4 py-2.5">
						{#if req.profiles?.avatar_url}
							<img src={req.profiles.avatar_url} alt="" class="w-8 h-8 rounded-full object-cover shrink-0" />
						{:else}
							<span class="w-8 h-8 rounded-full bg-raised border border-wire flex items-center justify-center text-sm text-faint font-bold shrink-0">
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
									class="rounded bg-accent hover:bg-accent-hi px-3 py-1 text-xs font-semibold text-canvas transition-colors cursor-pointer">
									{t('groups_approve')}
								</button>
							</form>
							<form method="POST" action="?/declineRequest" use:enhance>
								<input type="hidden" name="request_id" value={req.id} />
								<button type="submit"
									class="rounded border border-wire px-3 py-1 text-xs text-muted hover:text-fg hover:border-wire-hi transition-colors cursor-pointer">
									{t('groups_decline')}
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Personal activity: subtle accent-bordered banner with hairline content -->
	{#if myActivityCount > 0}
		<div class="rounded-lg border border-accent/30 overflow-hidden">
			<button
				type="button"
				onclick={() => (showActivity = !showActivity)}
				aria-expanded={showActivity}
				class="w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-raised/30 transition-colors cursor-pointer">
				<span class="text-sm font-semibold text-accent" style="font-family: var(--font-display)">
					{t('leagues_activity_label')}
					<span class="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent text-canvas text-[10px] font-bold px-1 leading-none">
						{myActivityCount}
					</span>
				</span>
				<svg class="w-3.5 h-3.5 text-accent/70 transition-transform duration-200 {showActivity ? 'rotate-180' : ''}"
					fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
				</svg>
			</button>

			{#if showActivity}
				<div class="border-t border-wire/60 px-4 py-3 space-y-4">
					<!-- My own pending requests -->
					{#if data.myPendingRequests.length > 0}
						<div>
							<p class="text-[11px] text-faint uppercase tracking-widest mb-2">{t('groups_my_requests')}</p>
							<div class="divide-y divide-wire/40 border-y border-wire/40">
								{#each data.myPendingRequests as req}
									<div class="flex items-center gap-3 py-2.5">
										<div class="flex-1 min-w-0">
											<p class="text-sm text-fg font-medium truncate">{req.group_name}</p>
											<p class="text-xs text-faint">
												{t('groups_awaiting')}
												{#if req.invite_code}
													· <span class="font-mono text-muted select-all">{req.invite_code}</span>
												{/if}
											</p>
										</div>
										<span class="text-[10px] text-faint border border-wire rounded px-2 py-0.5 font-mono shrink-0">
											{t('groups_request_pending')}
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Invites to accept/decline -->
					{#if data.myPendingInvites.length > 0}
						<div>
							<p class="text-[11px] text-faint uppercase tracking-widest mb-2">{t('groups_invitations')}</p>
							<div class="divide-y divide-wire/40 border-y border-wire/40">
								{#each data.myPendingInvites as invite}
									<div class="py-3">
										<p class="text-base font-bold text-fg leading-tight">{invite.group_name}</p>
										{#if invite.group_description}
											<p class="text-sm text-muted mt-1 leading-snug">{invite.group_description}</p>
										{/if}
										<p class="text-xs text-faint mt-1.5">
											{t('groups_invited_by')} <span class="text-muted font-medium">{invite.invited_by?.display_name ?? invite.invited_by?.username ?? '?'}</span>
										</p>
										<div class="flex gap-2 mt-2.5">
											<form method="POST" action="?/respondToInvite" use:enhance>
												<input type="hidden" name="invite_id" value={invite.id} />
												<button name="action" value="accepted" type="submit"
													class="rounded-lg bg-accent hover:bg-accent-hi px-4 py-1.5 text-sm font-semibold text-canvas transition-colors cursor-pointer">
													{t('groups_accept')}
												</button>
											</form>
											<form method="POST" action="?/respondToInvite" use:enhance>
												<input type="hidden" name="invite_id" value={invite.id} />
												<button name="action" value="declined" type="submit"
													class="rounded-lg border border-wire px-4 py-1.5 text-sm text-muted hover:text-fg hover:border-wire-hi transition-colors cursor-pointer">
													{t('groups_decline')}
												</button>
											</form>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Leagues list — kept as cards (genuinely distinct entities the user navigates into) -->
	{#if data.groups.length === 0}
		<div class="border-t border-wire pt-10 text-center">
			<p class="text-muted mb-2">{t('groups_empty')}</p>
			<p class="text-sm text-faint">{t('groups_empty_hint')}</p>
		</div>
	{:else}
		<section>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each data.groups as group}
					<a href="/leagues/{group.id}"
						class="group rounded-lg bg-panel border border-wire hover:border-accent p-4 transition-colors block">
						<div class="flex items-start justify-between gap-2 mb-1.5">
							<h3 class="font-bold text-fg text-base truncate group-hover:text-accent transition-colors" style="font-family: var(--font-display); letter-spacing: 0.01em">
								{group.name}
							</h3>
							{#if group.role === 'admin'}
								<span class="text-[10px] bg-accent-lo text-accent rounded px-1.5 py-0.5 font-semibold uppercase tracking-widest shrink-0">{t('role_admin')}</span>
							{/if}
						</div>
						{#if group.description}
							<p class="text-sm text-muted mb-2 line-clamp-2">{group.description}</p>
						{/if}
						<div class="flex items-center justify-between gap-2">
							<p class="text-[11px] text-faint font-mono tracking-wider">{group.invite_code}</p>
							{#if group.competitions}
								<span class="text-[10px] text-muted border border-wire rounded px-1.5 py-0.5 shrink-0">
									{fr ? group.competitions.name_fr : group.competitions.name_en}
								</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
