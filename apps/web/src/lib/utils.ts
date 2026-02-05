import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency
 */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(0)}`;
}

/**
 * Format a percentage (0-1 scale to display)
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format a stat value with appropriate precision
 */
export function formatStat(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}
