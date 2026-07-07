// Shared motion helpers — all honour prefers-reduced-motion (they no-op to an
// instant state when the user asks for less motion). Keep effects to opacity +
// transform only, with ease-out curves (no bounce), per the design system.
import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Staggered entrance: fade in with a slight rise. Use as `in:reveal={{ delay }}`
 * and stagger a list by multiplying the index. Instant under reduced motion.
 */
export function reveal(
	_node: Element,
	{ delay = 0, duration = 420, y = 8 }: { delay?: number; duration?: number; y?: number } = {}
): TransitionConfig {
	if (prefersReducedMotion()) return { duration: 0 };
	return {
		delay,
		duration,
		easing: cubicOut,
		css: (t) => `opacity: ${t}; transform: translateY(${(1 - t) * y}px);`
	};
}

/**
 * Tactile "stamp" for a value that just changed (stepper digit, saved check):
 * lands from a slight overshoot down to rest. Scale only, ease-out — reads as a
 * hit, not a bounce. No opacity change so the digit never blinks out.
 */
export function punch(
	_node: Element,
	{ duration = 220, from = 0.14 }: { duration?: number; from?: number } = {}
): TransitionConfig {
	if (prefersReducedMotion()) return { duration: 0 };
	return {
		duration,
		easing: cubicOut,
		css: (t) => `transform: scale(${1 + (1 - t) * from});`
	};
}

/**
 * Pop-in for emphasis (podium leader, badges): fade + subtle scale from 0.9.
 */
export function pop(
	_node: Element,
	{ delay = 0, duration = 480 }: { delay?: number; duration?: number } = {}
): TransitionConfig {
	if (prefersReducedMotion()) return { duration: 0 };
	return {
		delay,
		duration,
		easing: cubicOut,
		css: (t) => `opacity: ${t}; transform: scale(${0.9 + t * 0.1});`
	};
}
