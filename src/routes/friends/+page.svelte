<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let searching = $state(false);

	function viewProfile(friendId: string) {
		goto(`/profile/${friendId}`);
	}
</script>

<div class="space-y-10">
	<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">{t('friends_title')}</h1>

	<!-- Search -->
	<section class="space-y-3">
		<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">{t('friends_find')}</h2>
		<form method="POST" action="?/search" use:enhance={() => {
			searching = true;
			return async ({ update }) => { searching = false; await update(); };
		}} class="flex gap-2">
			<input name="query" type="text" minlength="2" required
				class="flex-1 rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none text-sm"
				placeholder={t('friends_search_placeholder')}
				value={form?.query ?? ''} />
			<button type="submit" disabled={searching}
				class="rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2 text-sm font-semibold text-canvas transition-colors cursor-pointer">
				{searching ? '...' : t('friends_search')}
			</button>
		</form>

		{#if form?.searchError}
			<p class="text-sm text-err">{form.searchError}</p>
		{/if}

		{#if form?.searchResults}
			<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire mt-1">
				{#each form.searchResults as profile}
					<div class="flex items-center gap-3 px-4 py-2.5">
						<div class="flex-1 min-w-0">
							{#if profile.display_name}
								<p class="text-sm text-fg truncate">{profile.display_name}</p>
								<p class="text-xs text-faint">@{profile.username}</p>
							{:else}
								<p class="text-sm text-fg truncate">@{profile.username}</p>
							{/if}
						</div>
						<form method="POST" action="?/request" use:enhance>
							<input type="hidden" name="addressee_id" value={profile.id} />
							<button type="submit"
								class="rounded bg-accent hover:bg-accent-hi px-3 py-1 text-xs font-semibold text-canvas transition-colors cursor-pointer">
								{t('friends_add')}
							</button>
						</form>
					</div>
				{:else}
					<p class="text-sm text-faint px-4 py-3">{t('friends_no_results')}</p>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Pending received -->
	{#if data.pendingReceived.length > 0}
		<section class="space-y-3 border-t border-wire pt-8">
			<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">
				{t('friends_received')} <span class="text-faint font-normal tabular-nums normal-case tracking-normal">({data.pendingReceived.length})</span>
			</h2>
			<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire">
				{#each data.pendingReceived as req}
					<div class="flex items-center gap-3 px-4 py-2.5">
						<span class="flex-1 text-sm text-fg truncate">@{(req.from as any)?.username}</span>
						<form method="POST" action="?/respond" use:enhance class="flex gap-2">
							<input type="hidden" name="friendship_id" value={req.id} />
							<button name="action" value="accepted" type="submit"
								class="rounded bg-accent hover:bg-accent-hi px-3 py-1 text-xs font-semibold text-canvas transition-colors cursor-pointer">
								{t('friends_accept')}
							</button>
							<button name="action" value="declined" type="submit"
								class="rounded border border-wire px-3 py-1 text-xs text-muted hover:text-fg hover:border-wire-hi transition-colors cursor-pointer">
								{t('friends_decline')}
							</button>
						</form>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Friends list -->
	<section class="space-y-3 border-t border-wire pt-8">
		<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">
			{t('friends_my_friends')} <span class="text-faint font-normal tabular-nums normal-case tracking-normal">({data.accepted.length})</span>
		</h2>
		{#if data.accepted.length === 0}
			<div class="rounded-xl bg-panel border border-wire px-6 py-10 text-center">
				<p class="text-sm text-faint">{t('friends_empty')}</p>
			</div>
		{:else}
			<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire">
				{#each data.accepted as friend}
					<button
						type="button"
						onclick={() => viewProfile((friend as any).id)}
						class="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-raised/60 transition-colors cursor-pointer">
						{#if (friend as any)?.avatar_url}
							<img src={(friend as any).avatar_url} alt="" class="w-8 h-8 rounded-full object-cover" />
						{:else}
							<span class="w-8 h-8 rounded-full bg-raised border border-wire flex items-center justify-center text-sm text-faint font-bold">
								{(friend as any)?.username?.[0]?.toUpperCase() ?? '?'}
							</span>
						{/if}
						<div class="flex-1 min-w-0">
							<p class="text-sm text-fg truncate">{(friend as any)?.display_name ?? (friend as any)?.username}</p>
							<p class="text-xs text-faint truncate">@{(friend as any)?.username}</p>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</section>
</div>
