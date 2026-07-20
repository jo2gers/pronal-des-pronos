<script lang="ts">
	import './layout.css';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import { getLang, setLang, t } from '$lib/i18n.svelte';
	import { getShowOdds, toggleOdds, loadPrefs } from '$lib/prefs.svelte';
	import { bannerById } from '$lib/banners';

	let { children, data } = $props();
	let menuOpen  = $state(false);
	let notifOpen = $state(false);
	let theme = $state<'dark' | 'light'>('dark');

	// Site-wide announcement banner — dismissible per message version. Keyed on
	// banner.updatedAt so an edited/new message re-appears even for users who
	// dismissed a previous one.
	let bannerDismissed = $state(false);
	$effect(() => {
		const b = data.banner;
		if (!b) { bannerDismissed = false; return; }
		bannerDismissed = localStorage.getItem('tifo_banner_dismissed') === (b.updatedAt ?? b.id);
	});
	function dismissBanner() {
		const b = data.banner;
		if (!b) return;
		localStorage.setItem('tifo_banner_dismissed', b.updatedAt ?? b.id);
		bannerDismissed = true;
	}

	const totalNotif = $derived((data.friendNotifCount ?? 0) + (data.groupNotifCount ?? 0) + (data.inviteCount ?? 0));

	// Keep an invite/deep link alive across the auth pages: when the current URL
	// carries ?next= (e.g. /auth/login?next=/leagues/join/abc), the nav's own
	// login/register links must forward it, or the link is lost on click.
	const authQS = $derived.by(() => {
		const next = page.url.searchParams.get('next');
		return next ? `?next=${encodeURIComponent(next)}` : '';
	});

	const navLinks = $derived([
		{ href: '/',            label: t('nav_home') },
		{ href: '/matches',     label: t('nav_matches') },
		{ href: '/leaderboard', label: t('nav_leaderboard') },
		// Feedback survey — proposed until this account has answered.
		...(data.surveyDone ? [] : [{ href: '/survey', label: t('nav_survey') }]),
	]);

	// Mobile tab bar — tournament over: archive mode, three destinations.
	const mobileTabs = $derived([
		{ href: '/',            label: t('nav_home') },
		{ href: '/matches',     label: t('nav_matches') },
		{ href: '/leaderboard', label: t('nav_leaderboard') },
	]);

	$effect(() => {
		const storedTheme = localStorage.getItem('theme') ?? 'dark';
		const storedLang  = localStorage.getItem('lang')  ?? 'fr';
		theme = storedTheme as 'dark' | 'light';
		setLang(storedLang as 'fr' | 'en');
		document.documentElement.classList.toggle('light', storedTheme === 'light');
		loadPrefs();
	});

	// ── Live notifications via Supabase Realtime ───────────────────────────────
	// Subscribe to the 3 notification-source tables. RLS gates which events
	// each client actually receives, so we don't need narrow column filters.
	// Bursts of identical changes are coalesced into a single invalidateAll.
	//
	// IMPORTANT: the effect must depend ONLY on the stable user id. If we
	// dereference `data.user` (object), the effect re-runs every time
	// invalidateAll() returns a new data snapshot — tearing down and
	// recreating the channel mid-handshake, which is what caused the
	// WebSocket "failed" reconnect storm in the browser console.
	let lastInvalidate = 0;
	function scheduleInvalidate() {
		const now = Date.now();
		if (now - lastInvalidate < 1000) return; // coalesce bursts
		lastInvalidate = now;
		invalidateAll();
	}

	const userId = $derived(data.user?.id ?? null);

	$effect(() => {
		if (!userId) return;
		// Only re-run when the actual user identity changes (login/logout),
		// not when the data object reference changes from invalidate.
		const uid = userId;

		let channel: ReturnType<typeof supabase.channel> | null = null;

		function connect() {
			if (channel) return;
			channel = supabase
				.channel(`notif-${uid}`)
				.on('postgres_changes', { event: '*', schema: 'public', table: 'friendships'         }, scheduleInvalidate)
				.on('postgres_changes', { event: '*', schema: 'public', table: 'group_invites'       }, scheduleInvalidate)
				.on('postgres_changes', { event: '*', schema: 'public', table: 'group_join_requests' }, scheduleInvalidate)
				.subscribe((status) => {
					if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
						console.warn('[realtime] channel status:', status);
					}
				});
		}

		function disconnect() {
			if (channel) {
				supabase.removeChannel(channel);
				channel = null;
			}
			// Close the socket so it stops auto-retrying — the "WebSocket failed"
			// console storm + battery drain — while we're offline or backgrounded.
			supabase.realtime.disconnect();
		}

		// Hold the realtime socket open ONLY while the tab is visible and the
		// device reports online. On a flaky mobile connection it would otherwise
		// reconnect-loop in the background. Re-evaluate on every signal; when we
		// come back online/foreground, refresh counts once to catch what was missed
		// while the socket was down (realtime delivers live events only, no replay).
		function sync(catchUp: boolean) {
			const active = navigator.onLine && document.visibilityState === 'visible';
			if (active) {
				const wasDown = channel === null;
				connect();
				if (catchUp && wasDown) scheduleInvalidate();
			} else {
				disconnect();
			}
		}

		const onChange = () => sync(true);
		sync(false);
		window.addEventListener('online', onChange);
		window.addEventListener('offline', onChange);
		document.addEventListener('visibilitychange', onChange);

		return () => {
			window.removeEventListener('online', onChange);
			window.removeEventListener('offline', onChange);
			document.removeEventListener('visibilitychange', onChange);
			disconnect();
		};
	});

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		localStorage.setItem('theme', theme);
		document.documentElement.classList.toggle('light', theme === 'light');
	}

	function toggleLang() {
		const next = getLang() === 'fr' ? 'en' : 'fr';
		setLang(next);
		localStorage.setItem('lang', next);
	}

	async function logout() {
		await supabase.auth.signOut();
		menuOpen = false;
		goto('/auth/login');
	}

	function closeMenu() { menuOpen = false; }
	function closeNotif() { notifOpen = false; }
</script>

<svelte:head>
	<title>Tifo — World Cup 2026 picks with your friends</title>
	<meta name="description" content="Tifo · friends · leagues · scoreboard. Designed and built by Devsigny." />
	<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=4" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32.png?v=4" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16.png?v=4" />
	<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon-180.png?v=4" />
	<meta name="theme-color" content="#0a0a0c" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<!-- Click-outside overlay for notif dropdown -->
{#if notifOpen}
	<div class="fixed inset-0 z-40" onclick={closeNotif} role="presentation"></div>
{/if}

<div class="min-h-screen flex flex-col bg-canvas text-fg" style="font-family: var(--font-body)">
	<nav class="sticky top-0 z-50 border-b border-wire/60 backdrop-blur-xl"
		style="background: color-mix(in srgb, var(--color-canvas) 70%, transparent)">
		<div class="mx-auto flex h-14 max-w-6xl items-center px-4 gap-4">
			<!-- Tifo · Mosaïque mark + wordmark. 5×5 stadium-tifo grid
			     forming a T, with the bottom cell as the lime accent dot. -->
			<a href="/" onclick={closeMenu} class="shrink-0 flex items-center gap-2.5" aria-label="Tifo">
				<svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true" class="shrink-0">
					{#each [[0,0,1],[1,0,1],[2,0,1],[3,0,1],[4,0,1],[2,1,1],[2,2,1],[2,3,1],[2,4,2]] as cell}
						<rect x={cell[0]*8 + 1} y={cell[1]*8 + 1} width="6" height="6"
							rx="0.5"
							fill={cell[2] === 2 ? 'var(--color-accent)' : 'var(--color-fg)'} />
					{/each}
				</svg>
				<span class="font-bold text-fg text-xl leading-none"
					style="font-family: var(--font-display); letter-spacing: -0.04em">tifo</span>
			</a>

			<!-- Desktop nav — active link gets a lime underline that bleeds
			     past the bottom border, design-system style -->
			<div class="hidden sm:flex flex-1 items-center gap-1 ml-6">
				{#each navLinks as link}
					{@const active = page.url.pathname === link.href}
					<a href={link.href}
						class="relative px-3 py-1.5 text-sm font-medium rounded transition-colors
							{active ? 'text-fg' : 'text-faint hover:text-fg'}">
						{link.label}
						{#if active}
							<span class="absolute left-3 right-3 -bottom-[15px] h-[2px] bg-accent" aria-hidden="true"></span>
						{/if}
					</a>
				{/each}
			</div>

			<!-- Controls: lang + theme + notif + auth -->
			<div class="hidden sm:flex items-center gap-3 ml-auto">
				<!-- Lang toggle -->
				<div class="flex items-center rounded-md border border-wire overflow-hidden text-xs font-semibold">
					<button onclick={toggleLang}
						class="px-2 py-1 transition-colors cursor-pointer {getLang() === 'fr' ? 'bg-accent text-canvas' : 'text-muted hover:text-fg'}">
						FR
					</button>
					<button onclick={toggleLang}
						class="px-2 py-1 transition-colors cursor-pointer {getLang() === 'en' ? 'bg-accent text-canvas' : 'text-muted hover:text-fg'}">
						EN
					</button>
				</div>

				<!-- Theme toggle -->
				<button onclick={toggleTheme} title="Toggle theme"
					class="w-7 h-7 flex items-center justify-center rounded-md border border-wire text-muted hover:text-fg hover:border-wire-hi transition-colors cursor-pointer">
					{#if theme === 'dark'}
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<circle cx="12" cy="12" r="5" stroke-width="2"/>
							<path stroke-width="2" stroke-linecap="round"
								d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
						</svg>
					{:else}
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-width="2" stroke-linecap="round"
								d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
						</svg>
					{/if}
				</button>

				<!-- Odds visibility toggle -->
				<button onclick={toggleOdds} title={t('odds_toggle_title')} aria-pressed={getShowOdds()}
					class="w-7 h-7 flex items-center justify-center rounded-md border transition-colors cursor-pointer
						{getShowOdds() ? 'border-wire text-muted hover:text-fg hover:border-wire-hi' : 'border-accent/50 text-accent'}">
					{#if getShowOdds()}
						<!-- eye open -->
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
							<circle cx="12" cy="12" r="3"/>
						</svg>
					{:else}
						<!-- eye off -->
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
						</svg>
					{/if}
				</button>

				<!-- Notification bell -->
				{#if data.user}
					<div class="relative">
						<button
							onclick={() => (notifOpen = !notifOpen)}
							class="relative w-7 h-7 flex items-center justify-center rounded-md border border-wire text-muted hover:text-fg hover:border-wire-hi transition-colors cursor-pointer"
							title={t('notif_title')}>
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
									d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
							</svg>
							{#if totalNotif > 0}
								<span class="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-err text-canvas text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
									{totalNotif}
								</span>
							{/if}
						</button>

						<!-- Dropdown -->
						{#if notifOpen}
							<div class="absolute right-0 top-9 w-64 rounded-xl bg-panel border border-wire shadow-lg z-50 overflow-hidden">
								<p class="text-xs font-semibold text-fg px-4 pt-3 pb-1">{t('notif_title')}</p>
								{#if totalNotif === 0}
									<p class="text-sm text-faint px-4 py-3">{t('notif_none')}</p>
								{:else}
									<div class="py-1">
										{#if (data.friendNotifCount ?? 0) > 0}
											<a href="/friends" onclick={closeNotif}
												class="flex items-center justify-between px-4 py-2.5 hover:bg-raised transition-colors">
												<span class="text-sm text-fg">{data.friendNotifCount} {t('notif_friend')}</span>
												<span class="text-xs text-accent">{t('notif_go_friends')}</span>
											</a>
										{/if}
										{#if (data.groupNotifCount ?? 0) > 0}
											<a href="/leagues" onclick={closeNotif}
												class="flex items-center justify-between px-4 py-2.5 hover:bg-raised transition-colors">
												<span class="text-sm text-fg">{data.groupNotifCount} {t('notif_group')}</span>
												<span class="text-xs text-accent">{t('notif_go_groups')}</span>
											</a>
										{/if}
										{#if (data.inviteCount ?? 0) > 0}
											<a href="/leagues" onclick={closeNotif}
												class="flex items-center justify-between px-4 py-2.5 hover:bg-raised transition-colors">
												<span class="text-sm text-fg">{data.inviteCount} {(data.inviteCount ?? 0) > 1 ? t('groups_invite_plural') : t('groups_invite_singular')}</span>
												<span class="text-xs text-accent">{t('notif_go_groups')}</span>
											</a>
										{/if}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Auth -->
				{#if data.user}
					<a href="/profile/{data.user?.id}"
					class="group inline-flex items-center gap-2 text-sm text-muted hover:text-fg transition-colors"
					title={t('nav_profile')}>
					{#if data.profile?.avatar_url}
						<img src={data.profile.avatar_url} alt=""
							class="w-7 h-7 rounded-full object-cover ring-1 ring-wire group-hover:ring-accent transition-all" />
					{:else}
						<span class="w-7 h-7 rounded-full bg-raised border border-wire group-hover:border-accent flex items-center justify-center text-xs font-bold text-muted transition-colors">
							{(data.profile?.display_name ?? data.profile?.username ?? '?')[0]?.toUpperCase()}
						</span>
					{/if}
					<span class="hidden lg:inline">{data.profile?.display_name ?? data.profile?.username ?? t('nav_profile')}</span>
				</a>
					<button onclick={logout} class="whitespace-nowrap text-sm text-faint hover:text-err transition-colors cursor-pointer">
						{t('nav_logout')}
					</button>
				{:else}
					<!-- Tournament over — no new sign-ups, login stays for existing players. -->
					<a href="/auth/login{authQS}" class="text-sm text-muted hover:text-fg transition-colors">{t('nav_login')}</a>
				{/if}
			</div>

			<!-- Mobile hamburger -->
			<button
				class="sm:hidden ml-auto p-2 text-muted hover:text-fg transition-colors cursor-pointer relative"
				onclick={() => (menuOpen = !menuOpen)} aria-label="Menu">
				{#if menuOpen}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				{:else}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
					</svg>
					{#if totalNotif > 0}
						<span class="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-err text-canvas text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
							{totalNotif}
						</span>
					{/if}
				{/if}
			</button>
		</div>

		<!-- Mobile dropdown -->
		{#if menuOpen}
			<div class="sm:hidden border-t border-wire bg-canvas px-4 py-3 space-y-0.5">
				{#each navLinks as link}
					<a href={link.href} onclick={closeMenu}
						class="block py-2.5 text-sm transition-colors hover:text-fg {page.url.pathname === link.href
							? 'text-fg font-semibold'
							: 'text-muted'}">{link.label}</a>
				{/each}

				<!-- Notifications section (mobile) -->
				{#if data.user && totalNotif > 0}
					<div class="border-t border-wire pt-2 mt-1 space-y-1">
						{#if (data.friendNotifCount ?? 0) > 0}
							<a href="/friends" onclick={closeMenu}
								class="flex items-center gap-2 py-2 text-sm text-fg">
								<span class="w-5 h-5 rounded-full bg-err text-canvas text-[9px] font-bold flex items-center justify-center shrink-0">{data.friendNotifCount}</span>
								{data.friendNotifCount} {t('notif_friend')}
							</a>
						{/if}
						{#if (data.groupNotifCount ?? 0) > 0}
							<a href="/leagues" onclick={closeMenu}
								class="flex items-center gap-2 py-2 text-sm text-fg">
								<span class="w-5 h-5 rounded-full bg-err text-canvas text-[9px] font-bold flex items-center justify-center shrink-0">{data.groupNotifCount}</span>
								{data.groupNotifCount} {t('notif_group')}
							</a>
						{/if}
						{#if (data.inviteCount ?? 0) > 0}
							<a href="/leagues" onclick={closeMenu}
								class="flex items-center gap-2 py-2 text-sm text-fg">
								<span class="w-5 h-5 rounded-full bg-err text-canvas text-[9px] font-bold flex items-center justify-center shrink-0">{data.inviteCount}</span>
								{data.inviteCount} {(data.inviteCount ?? 0) > 1 ? t('groups_invite_plural') : t('groups_invite_singular')}
							</a>
						{/if}
					</div>
				{/if}

				<div class="border-t border-wire pt-2 mt-2 flex items-center justify-between">
					<!-- Lang + theme -->
					<div class="flex items-center gap-2">
						<div class="flex items-center rounded border border-wire overflow-hidden text-xs font-semibold">
							<button onclick={toggleLang}
								class="px-2 py-1 cursor-pointer {getLang() === 'fr' ? 'bg-accent text-canvas' : 'text-muted'}">FR</button>
							<button onclick={toggleLang}
								class="px-2 py-1 cursor-pointer {getLang() === 'en' ? 'bg-accent text-canvas' : 'text-muted'}">EN</button>
						</div>
						<button onclick={toggleTheme}
							class="w-7 h-7 flex items-center justify-center rounded border border-wire text-muted cursor-pointer">
							{theme === 'dark' ? '☀' : '☾'}
						</button>
						<!-- Odds toggle -->
						<button onclick={toggleOdds} aria-pressed={getShowOdds()} title={t('odds_toggle_title')}
							class="inline-flex items-center gap-1.5 h-7 px-2 rounded border text-xs font-semibold transition-colors cursor-pointer
								{getShowOdds() ? 'border-wire text-muted' : 'border-accent/50 text-accent'}">
							{#if getShowOdds()}
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/><circle cx="12" cy="12" r="3"/></svg>
							{:else}
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59M21 21l-2.59-2.59"/></svg>
							{/if}
							{t('odds_label')}
						</button>
					</div>
					<!-- Auth -->
					<div class="flex items-center gap-3">
						{#if data.user}
							<a href="/profile/{data.user?.id}" onclick={closeMenu}
							class="inline-flex items-center gap-2 text-sm text-muted hover:text-fg transition-colors">
							{#if data.profile?.avatar_url}
								<img src={data.profile.avatar_url} alt="" class="w-6 h-6 rounded-full object-cover ring-1 ring-wire" />
							{:else}
								<span class="w-6 h-6 rounded-full bg-raised border border-wire flex items-center justify-center text-[10px] font-bold text-muted">
									{(data.profile?.display_name ?? data.profile?.username ?? '?')[0]?.toUpperCase()}
								</span>
							{/if}
							<span>{data.profile?.display_name ?? data.profile?.username ?? t('nav_profile')}</span>
						</a>
							<button onclick={logout} class="whitespace-nowrap text-sm text-faint hover:text-err transition-colors cursor-pointer">{t('nav_logout')}</button>
						{:else}
							<a href="/auth/login{authQS}" onclick={closeMenu} class="text-sm text-muted hover:text-fg transition-colors">{t('nav_login')}</a>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</nav>

	<!-- Site-wide announcement banner · admin-managed via /admin · translated -->
	{#if data.banner && !bannerDismissed}
		{@const def = bannerById(data.banner.id)}
		{#if def}
			<div class="border-b {def.tone === 'warn' ? 'border-err/30 bg-err/10' : 'border-accent/30 bg-accent-lo'}">
				<div class="mx-auto max-w-6xl px-4 py-2.5 flex items-start gap-2.5">
					<svg class="w-4 h-4 mt-0.5 shrink-0 {def.tone === 'warn' ? 'text-err' : 'text-accent'}"
						fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
						{#if def.tone === 'warn'}
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						{/if}
					</svg>
					<p class="flex-1 text-sm leading-snug {def.tone === 'warn' ? 'text-err' : 'text-fg'}">{t(def.i18n)}</p>
					<button onclick={dismissBanner} aria-label={t('banner_dismiss')} title={t('banner_dismiss')}
						class="shrink-0 -mr-1 w-6 h-6 flex items-center justify-center rounded text-faint hover:text-fg transition-colors cursor-pointer">
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>
		{/if}
	{/if}

	<main class="flex-1 w-full mx-auto max-w-6xl px-4 py-8 pb-24 sm:pb-8">
		{@render children()}

		<!-- Devsigny attribution · mobile — the desktop footer is hidden on
		     phones (the tab bar owns the lower edge), so credit lives at the
		     end of the page content instead. -->
		<div class="sm:hidden mt-14 pt-5 border-t border-wire/60 text-center">
			<a href="https://devsigny.com" target="_blank" rel="noopener noreferrer"
				class="inline-flex items-baseline gap-1.5 text-[11px] text-faint active:text-fg"
				aria-label="Devsigny — dev & AI consulting">
				<span>{t('footer_built_by')}</span>
				<span class="font-bold text-muted" style="font-family: var(--font-display); letter-spacing: 0.04em">Devsigny</span>
				<span aria-hidden="true">→</span>
			</a>
		</div>
	</main>

	<!-- ── Mobile bottom tab bar · primary navigation on small screens ─────
	     Mirrors the design canvas: 5 tabs with mosaic-icon active glyph,
	     outlined-square placeholder for inactive. Tap-friendly hit areas,
	     backdrop-blur so content shows through, safe-area padding for
	     iOS home-indicator. -->
	<nav class="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-wire/60 backdrop-blur-xl"
		style="background: color-mix(in srgb, var(--color-canvas) 92%, transparent); padding-bottom: env(safe-area-inset-bottom, 0px)">
		<div class="grid grid-cols-5 gap-0.5 px-2 pt-2 pb-2">
			{#each mobileTabs as link}
				{@const active = page.url.pathname === link.href}
				<a href={link.href}
					class="flex flex-col items-center gap-1 py-1.5 transition-colors
						{active ? 'text-accent' : 'text-faint hover:text-fg'}">
					{#if active}
						<!-- Mosaic icon · lime, signals active tab -->
						<svg width="16" height="16" viewBox="0 0 40 40" aria-hidden="true">
							{#each [[0,0,1],[1,0,1],[2,0,1],[3,0,1],[4,0,1],[2,1,1],[2,2,1],[2,3,1],[2,4,2]] as cell}
								<rect x={cell[0]*8 + 1} y={cell[1]*8 + 1} width="6" height="6" rx="0.5"
									fill="var(--color-accent)" opacity={cell[2] === 2 ? 1 : 0.55} />
							{/each}
						</svg>
					{:else}
						<!-- Inactive · outlined square placeholder -->
						<span class="w-4 h-4 border border-current rounded-[2px] opacity-60" aria-hidden="true"></span>
					{/if}
					<span class="text-[9.5px] uppercase tracking-[0.04em] leading-none"
						style="font-family: var(--font-mono)">{link.label}</span>
				</a>
			{/each}
		</div>
	</nav>

	<!-- Devsigny attribution — desktop only. On mobile the bottom tab bar
	     owns the lower edge, so the footer would either fight it for space
	     or sit weirdly above it after scroll. The /rules page already
	     credits Devsigny if mobile users want to find it. -->
	<footer class="mt-auto border-t border-wire hidden sm:block">
		<div class="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between gap-3 flex-wrap">
			<a href="https://devsigny.com" target="_blank" rel="noopener noreferrer"
				class="group inline-flex items-baseline gap-1.5 text-xs text-faint hover:text-fg transition-colors"
				aria-label="Devsigny — dev & AI consulting">
				<span>{t('footer_built_by')}</span>
				<span class="font-bold text-muted group-hover:text-accent transition-colors" style="font-family: var(--font-display); letter-spacing: 0.04em">
					Devsigny
				</span>
				<svg class="w-3 h-3 text-faint/60 group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
				</svg>
			</a>
			<a href="https://devsigny.com" target="_blank" rel="noopener noreferrer"
				class="text-[11px] text-faint hover:text-accent transition-colors">
				{t('footer_consulting')}
			</a>
		</div>
	</footer>
</div>
