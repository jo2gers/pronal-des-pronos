<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';

	let { children, data } = $props();

	const navLinks = [
		{ href: '/', label: 'Accueil' },
		{ href: '/matches', label: 'Matchs' },
		{ href: '/leaderboard', label: 'Classement' },
		{ href: '/groups', label: 'Groupes' },
		{ href: '/friends', label: 'Amis' }
	];

	async function logout() {
		await supabase.auth.signOut();
		goto('/auth/login');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-gray-950 text-white">
	<nav class="sticky top-0 z-50 border-b border-green-800 bg-green-950">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
			<a href="/" class="text-lg font-bold text-yellow-400">⚽ Pronal</a>
			<div class="flex flex-1 gap-5">
				{#each navLinks as link}
					<a
						href={link.href}
						class="text-sm transition-colors hover:text-yellow-400 {page.url.pathname === link.href
							? 'font-semibold text-yellow-400'
							: 'text-green-200'}">{link.label}</a
					>
				{/each}
			</div>
			{#if data.user}
				<a href="/profile" class="text-sm text-green-200 hover:text-yellow-400 transition-colors">
					Mon profil
				</a>
				<button
					onclick={logout}
					class="text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer"
				>
					Déconnexion
				</button>
			{:else}
				<a href="/auth/login" class="text-sm text-green-200 hover:text-yellow-400 transition-colors"
					>Connexion</a
				>
				<a
					href="/auth/register"
					class="rounded bg-yellow-500 px-3 py-1 text-sm font-semibold text-black hover:bg-yellow-400 transition-colors"
					>S'inscrire</a
				>
			{/if}
		</div>
	</nav>

	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
