/**
 * Navigation Stack Manager
 *
 * Solves the core architectural problem: TUI views were using recursive callbacks
 * which caused:
 * - Async operations after screen.destroy() → terminal corruption
 * - Call stack buildup without cleanup → memory leaks
 * - Race conditions between promise resolution and screen lifecycle
 *
 * This navigation manager uses a simple state machine approach instead:
 * - Views return a NavigationResult indicating where to go next
 * - No callbacks, no recursion
 * - Clean screen transitions
 */

export type NavigationTarget =
	| { type: "quit" }
	| { type: "back" }
	| { type: "stay" }
	| { type: "goto"; view: string; params?: Record<string, unknown> };

/**
 * Result returned by a view when it closes
 */
export interface NavigationResult {
	target: NavigationTarget;
}

/**
 * Create a quit result
 */
export function quit(): NavigationResult {
	return { target: { type: "quit" } };
}

/**
 * Create a back result (return to previous view)
 */
export function back(): NavigationResult {
	return { target: { type: "back" } };
}

/**
 * Create a stay result (re-render current view)
 */
export function stay(): NavigationResult {
	return { target: { type: "stay" } };
}

/**
 * Create a goto result (navigate to specific view)
 */
export function goto(view: string, params?: Record<string, unknown>): NavigationResult {
	return { target: { type: "goto", view, params } };
}

/**
 * Navigation stack entry
 */
interface StackEntry {
	view: string;
	params: Record<string, unknown>;
}

/**
 * Navigation stack for managing view history
 */
export class NavigationStack {
	private stack: StackEntry[] = [];

	push(view: string, params: Record<string, unknown> = {}): void {
		this.stack.push({ view, params });
	}

	pop(): StackEntry | undefined {
		return this.stack.pop();
	}

	peek(): StackEntry | undefined {
		return this.stack[this.stack.length - 1];
	}

	clear(): void {
		this.stack = [];
	}

	get length(): number {
		return this.stack.length;
	}
}
