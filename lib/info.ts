import { DEFAULT_INFO_URL } from "@/lib/constants";

export const INFO_PAGE_TITLE = "Research overview";
export const INFO_PAGE_LAST_UPDATED = "29 May 2026";
export const INFO_URL = process.env.NEXT_PUBLIC_INFO_URL || DEFAULT_INFO_URL;

export function isExternalInfoUrl(url: string) {
  return /^https?:\/\//.test(url);
}
