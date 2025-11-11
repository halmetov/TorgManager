import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency: RUB -> KZT conversion
export const RUB_TO_KZT: number = Number(import.meta.env.VITE_RUB_TO_KZT ?? 5);
export function rubToKzt(rub: number): number {
  if (Number.isNaN(rub)) return 0;
  return Math.round(rub * RUB_TO_KZT);
}
