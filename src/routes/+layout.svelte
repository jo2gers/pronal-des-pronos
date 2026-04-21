<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import { getLang, setLang, t } from '$lib/i18n.svelte';

	let { children, data } = $props();
	let menuOpen  = $state(false);
	let notifOpen = $state(false);
	let theme = $state<'dark' | 'light'>('dark');

	const totalNotif = $derived((data.friendNotifCount ?? 0) + (data.groupNotifCount ?? 0));

	const navLinks = $derived([
		{ href: '/',            label: t('nav_home') },
		{ href: '/matches',     label: t('nav_matches') },
		{ href: '/leaderboard', label: t('nav_leaderboard') },
		{ href: '/groups',      label: t('nav_groups') },
		{ href: '/friends',     label: t('nav_friends') },
		{ href: '/rules',       label: t('nav_rules') },
	]);

	$effect(() => {
		const storedTheme = localStorage.getItem('theme') ?? 'dark';
		const storedLang  = localStorage.getItem('lang')  ?? 'fr';
		theme = storedTheme as 'dark' | 'light';
		setLang(storedLang as 'fr' | 'en');
		document.documentElement.classList.toggle('light', storedTheme === 'light');
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
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<!-- Click-outside overlay for notif dropdown -->
{#if notifOpen}
	<div class="fixed inset-0 z-40" onclick={closeNotif} role="presentation"></div>
{/if}

<div class="min-h-screen bg-canvas text-fg" style="font-family: var(--font-body)">
	<nav class="sticky top-0 z-50 border-b border-wire bg-canvas/95 backdrop-blur-sm">
		<div class="mx-auto flex h-14 max-w-6xl items-center px-4 gap-4">
			<!-- Wordmark -->
			<a href="/" onclick={closeMenu}
				class="shrink-0 font-display text-xl font-bold tracking-wide text-accent"
				style="font-family: var(--font-display); letter-spacing: 0.04em">
				PRONAL
			</a>

			<!-- Desktop nav -->
			<div class="hidden sm:flex flex-1 items-center gap-5">
				{#each navLinks as link}
					<a href={link.href}
						class="text-sm transition-colors hover:text-fg {page.url.pathname === link.href
							? 'text-fg font-semibold'
							: 'text-muted'}">{link.label}</a>
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
								<p class="text-[11px] font-semibold text-faint uppercase tracking-wider px-4 pt-3 pb-1">{t('notif_title')}</p>
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
											<a href="/groups" onclick={closeNotif}
												class="flex items-center justify-between px-4 py-2.5 hover:bg-raised transition-colors">
												<span class="text-sm text-fg">{data.groupNotifCount} {t('notif_group')}</span>
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
					<a href="/profile/{data.user?.id}" class="text-sm text-muted hover:text-fg transition-colors">{t('nav_profile')}</a>
					<button onclick={logout} class="text-sm text-faint hover:text-err transition-colors cursor-pointer">
						{t('nav_logout')}
					</button>
				{:else}
					<a href="/auth/login" class="text-sm text-muted hover:text-fg transition-colors">{t('nav_login')}</a>
					<a href="/auth/register"
						class="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-canvas hover:bg-accent-hi transition-colors">
						{t('nav_register')}
					</a>
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
						<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-err"></span>
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
							<a href="/groups" onclick={closeMenu}
								class="flex items-center gap-2 py-2 text-sm text-fg">
								<span class="w-5 h-5 rounded-full bg-err text-canvas text-[9px] font-bold flex items-center justify-center shrink-0">{data.groupNotifCount}</span>
								{data.groupNotifCount} {t('notif_group')}
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
					</div>
					<!-- Auth -->
					<div class="flex items-center gap-3">
						{#if data.user}
							<a href="/profile/{data.user?.id}" onclick={closeMenu} class="text-sm text-muted hover:text-fg transition-colors">{t('nav_profile')}</a>
							<button onclick={logout} class="text-sm text-faint hover:text-err transition-colors cursor-pointer">{t('nav_logout')}</button>
						{:else}
							<a href="/auth/login" onclick={closeMenu} class="text-sm text-muted hover:text-fg transition-colors">{t('nav_login')}</a>
							<a href="/auth/register" onclick={closeMenu} class="text-sm text-accent font-semibold">{t('nav_register')}</a>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</nav>

	<main class="mx-auto max-w-6xl px-4 py-8">
		{@render children()}
	</main>
</div>
