import type {
  HousingPost,
  HousingPostRepository
} from "../repositories/housing-post-repository.js";
import type {
  NotificationAdapter,
  NotificationMessage
} from "./notification-adapter.js";

export type HousingPostNotifierOptions = {
  adapter: NotificationAdapter;
  posts?: Pick<HousingPostRepository, "markNotified">;
};

export type HousingPostNotificationResult = {
  attemptedCount: number;
  sentCount: number;
  skippedCount: number;
};

export type HousingPostNotifier = {
  notifyNewPosts(posts: HousingPost[]): Promise<HousingPostNotificationResult>;
};

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

export function buildHousingPostMessage(post: HousingPost): NotificationMessage {
  const fields = [];

  if (post.postedAt) {
    fields.push({
      name: "게시일",
      value: post.postedAt,
      inline: true
    });
  }

  if (post.isNotice) {
    fields.push({
      name: "분류",
      value: "공지",
      inline: true
    });
  }

  return {
    content: "새 청약/주거 공고가 발견됐습니다.",
    username: "cw2.kr housing alert",
    embeds: [
      {
        title: truncate(post.title, 256),
        url: post.url,
        description: post.description
          ? truncate(post.description, 1200)
          : undefined,
        fields,
        timestamp: new Date().toISOString()
      }
    ]
  };
}

export function createHousingPostNotifier({
  adapter,
  posts: postRepository
}: HousingPostNotifierOptions): HousingPostNotifier {
  return {
    async notifyNewPosts(posts) {
      let sentCount = 0;
      let skippedCount = 0;

      for (const post of posts) {
        if (post.notifiedAt) {
          skippedCount += 1;
          continue;
        }

        await adapter.send(buildHousingPostMessage(post));
        postRepository?.markNotified(post.id);
        sentCount += 1;
      }

      return {
        attemptedCount: posts.length,
        sentCount,
        skippedCount
      };
    }
  };
}
