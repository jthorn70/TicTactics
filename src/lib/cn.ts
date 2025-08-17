import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

type ClassValue = string | undefined | null | boolean | number | ClassValue[] | { [key: string]: any };
