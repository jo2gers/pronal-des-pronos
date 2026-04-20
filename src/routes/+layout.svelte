<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';

	let { children, data } = $props();
	let menuOpen = $state(false);

	const navLinks = [
		{ href: '/', label: 'Accueil' },
		{ href: '/matches', label: 'Matchs' },
		{ href: '/leaderboard', label: 'Classement' },
		{ href: '/groups', label: 'Groupes' },
		{ href: '/friends', label: 'Amis' }
	];

	async function logout() {
		await supabase.auth.signOut();
		menuOpen = false;
		goto('/auth/login');
	}

	function closeMenu() { menuOpen = false; }
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<div class="min-h-screen bg-canvas text-fg" style="font-family: var(--font-body)">
	<nav class="sticky top-0 z-50 border-b border-wire bg-canvas/95 backdrop-blur-sm">
		<div class="mx-auto flex h-14 max-w-6xl items-center px-4">
			<!-- Wordmark — no emoji chrome -->
			<a href="/" onclick={closeMenu}
				class="mr-6 shrink-0 font-display text-xl font-bold tracking-wide text-accent"
				style="font-family: var(--font-display); letter-spacing: 0.04em">
				PRONAL
			</a>

			<!-- Desktop nav -->
			<div class="hidden sm:flex flex-1 items-center gap-6">
				{#each navLinks as link}
					<a href={link.href}
						class="text-sm transition-colors hover:text-fg {page.url.pathname === link.href
							? 'text-fg font-semibold'
							: 'text-muted'}">{link.label}</a>
				{/each}
			</div>

			<!-- Desktop auth -->
			<div class="hidden sm:flex items-center gap-4 ml-auto">
				{#if data.user}
					<a href="/profile" class="text-sm text-muted hover:text-fg transition-colors">Profil</a>
					<button onclick={logout} class="text-sm text-faint hover:text-err transition-colors cursor-pointer">
						Déconnexion
					</button>
				{:else}
					<a href="/auth/login" class="text-sm text-muted hover:text-fg transition-colors">Connexion</a>
					<a href="/auth/register"
						class="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-canvas hover:bg-accent-hi transition-colors">
						S'inscrire
					</a>
				{/if}
			</div>

			<!-- Mobile hamburger -->
			<button
				class="sm:hidden ml-auto p-2 text-muted hover:text-fg transition-colors cursor-pointer"
				onclick={() => (menuOpen = !menuOpen)}
				aria-label="Menu"
			>
				{#if menuOpen}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				{:else}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
					</svg>
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
				<div class="border-t border-wire pt-2 mt-2">
					{#if data.user}
						<a href="/profile" onclick={closeMenu} class="block py-2.5 text-sm text-muted hover:text-fg transition-colors">
							Profil
						</a>
						<button onclick={logout} class="block py-2.5 text-sm text-faint hover:text-err transition-colors cursor-pointer w-full text-left">
							Déconnexion
						</button>
					{:else}
						<a href="/auth/login" onclick={closeMenu} class="block py-2.5 text-sm text-muted hover:text-fg transition-colors">
							Connexion
						</a>
						<a href="/auth/register" onclick={closeMenu} class="block py-2.5 text-sm text-accent font-semibold hover:text-accent-hi transition-colors">
							S'inscrire
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</nav>

	<main class="mx-auto max-w-6xl px-4 py-8">
		{@render children()}
	</main>
</div>
