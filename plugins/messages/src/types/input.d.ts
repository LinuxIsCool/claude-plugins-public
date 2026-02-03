/**
 * Type declarations for the 'input' npm module
 * @see https://www.npmjs.com/package/input
 */
declare module "input" {
  /**
   * Prompt for text input
   */
  export function text(prompt: string, options?: { default?: string }): Promise<string>;

  /**
   * Prompt for password input (hidden)
   */
  export function password(prompt: string): Promise<string>;

  /**
   * Prompt for confirmation (yes/no)
   */
  export function confirm(prompt: string, options?: { default?: boolean }): Promise<boolean>;

  /**
   * Prompt for selection from a list
   */
  export function select<T>(
    prompt: string,
    choices: Array<{ name: string; value: T }>
  ): Promise<T>;

  /**
   * Prompt for multiple selections
   */
  export function checkboxes<T>(
    prompt: string,
    choices: Array<{ name: string; value: T; checked?: boolean }>
  ): Promise<T[]>;
}
