import type { ScrapedHousingPost } from "../services/scrape-service.js";

export const THE_PODIUM_830_NOTICE_SOURCE_URL =
  "https://thepodium830.com/center/notice?isNotice=false&searchKey=all&searchValue&page=1";

const THE_PODIUM_830_ORIGIN = "https://thepodium830.com";
const THE_PODIUM_830_NOTICE_API_URL =
  "https://thepodium830.com/api/v1/center/notifications?isNotice=false&searchKey=all&searchValue=";

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "statusText" | "json">>;

type ThePodium830Notification = {
  _id: string;
  subject: string;
  content?: string | null;
  createdAt?: string | null;
  upload?: string | null;
  isNotice?: boolean;
};

type ThePodium830NotificationsResponse = {
  notifications?: ThePodium830Notification[];
};

export type ThePodium830ScraperOptions = {
  fetchImplementation?: FetchLike;
  limit?: number;
};

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(value: string): string {
  return new URL(value, THE_PODIUM_830_ORIGIN).toString();
}

export function mapThePodium830Notification(
  notification: ThePodium830Notification,
  index: number
): ScrapedHousingPost {
  return {
    sourceSeq: index + 1,
    externalId: notification._id,
    title: notification.subject,
    description: notification.content ? stripHtml(notification.content) : null,
    url: `${THE_PODIUM_830_ORIGIN}/center/notice/${notification._id}`,
    isNotice: notification.isNotice ?? false,
    postedAt: notification.createdAt ?? null,
    attachmentsJson: notification.upload
      ? JSON.stringify([
          {
            name: notification.upload.split("/").pop() ?? "attachment",
            url: toAbsoluteUrl(notification.upload)
          }
        ])
      : null
  };
}

export function createThePodium830Scraper({
  fetchImplementation = fetch,
  limit = 10
}: ThePodium830ScraperOptions = {}) {
  return {
    async scrape(): Promise<ScrapedHousingPost[]> {
      const response = await fetchImplementation(THE_PODIUM_830_NOTICE_API_URL, {
        headers: {
          skip: "0",
          limit: String(limit)
        }
      });

      if (!response.ok) {
        throw new Error(
          `The Podium 830 notice API failed: ${response.status} ${response.statusText}`
        );
      }

      const payload = (await response.json()) as ThePodium830NotificationsResponse;

      return (payload.notifications ?? []).map(mapThePodium830Notification);
    }
  };
}
