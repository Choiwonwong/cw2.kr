import type { DatabaseConnection } from "../db/connection.js";
import { booleanFromSqlite, booleanToSqlite } from "./row-mappers.js";

export type HousingPost = {
  id: number;
  sourceId: number;
  firstSeenRunId: number | null;
  sourceSeq: number | null;
  externalId: string | null;
  title: string;
  description: string | null;
  url: string;
  isNotice: boolean;
  postedAt: string | null;
  attachmentsJson: string | null;
  notifiedAt: string | null;
  isChecked: boolean;
  isSubmitted: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type HousingPostRow = {
  id: number;
  source_id: number;
  first_seen_run_id: number | null;
  source_seq: number | null;
  external_id: string | null;
  title: string;
  description: string | null;
  url: string;
  is_notice: number;
  posted_at: string | null;
  attachments_json: string | null;
  notified_at: string | null;
  is_checked: number;
  is_submitted: number;
  created_at: string;
  updated_at: string | null;
};

export type InsertHousingPostInput = {
  sourceId: number;
  firstSeenRunId?: number | null;
  sourceSeq?: number | null;
  externalId?: string | null;
  title: string;
  description?: string | null;
  url: string;
  isNotice?: boolean;
  postedAt?: string | null;
  attachmentsJson?: string | null;
};

export type InsertHousingPostResult = {
  inserted: boolean;
  updated: boolean;
  post: HousingPost;
};

export type HousingPostRepository = {
  insertIfNew(input: InsertHousingPostInput): InsertHousingPostResult;
  findById(id: number): HousingPost | null;
  findBySourceAndUrl(sourceId: number, url: string): HousingPost | null;
  findRecent(limit: number): HousingPost[];
  findUnnotified(limit: number): HousingPost[];
  markChecked(id: number): HousingPost;
  markSubmitted(id: number): HousingPost;
  markNotified(id: number): HousingPost;
};

function toHousingPost(row: HousingPostRow): HousingPost {
  return {
    id: row.id,
    sourceId: row.source_id,
    firstSeenRunId: row.first_seen_run_id,
    sourceSeq: row.source_seq,
    externalId: row.external_id,
    title: row.title,
    description: row.description,
    url: row.url,
    isNotice: booleanFromSqlite(row.is_notice),
    postedAt: row.posted_at,
    attachmentsJson: row.attachments_json,
    notifiedAt: row.notified_at,
    isChecked: booleanFromSqlite(row.is_checked),
    isSubmitted: booleanFromSqlite(row.is_submitted),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createHousingPostRepository(
  database: DatabaseConnection
): HousingPostRepository {
  const insertPost = database.prepare(`
    INSERT OR IGNORE INTO scraped_housing_posts (
      source_id,
      first_seen_run_id,
      source_seq,
      external_id,
      title,
      description,
      url,
      is_notice,
      posted_at,
      attachments_json
    ) VALUES (
      @sourceId,
      @firstSeenRunId,
      @sourceSeq,
      @externalId,
      @title,
      @description,
      @url,
      @isNotice,
      @postedAt,
      @attachmentsJson
    )
  `);

  const updateScrapedPostStatement = database.prepare(`
    UPDATE scraped_housing_posts
    SET
      external_id = @externalId,
      title = @title,
      description = @description,
      is_notice = @isNotice,
      posted_at = @postedAt,
      attachments_json = @attachmentsJson,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const findByIdStatement = database.prepare<number, HousingPostRow>(`
    SELECT *
    FROM scraped_housing_posts
    WHERE id = ?
  `);

  const findBySourceAndUrlStatement = database.prepare<[number, string], HousingPostRow>(`
    SELECT *
    FROM scraped_housing_posts
    WHERE source_id = ? AND url = ?
  `);

  const findRecentStatement = database.prepare<number, HousingPostRow>(`
    SELECT *
    FROM scraped_housing_posts
    ORDER BY id DESC
    LIMIT ?
  `);

  const findUnnotifiedStatement = database.prepare<number, HousingPostRow>(`
    SELECT *
    FROM scraped_housing_posts
    WHERE notified_at IS NULL
    ORDER BY id ASC
    LIMIT ?
  `);

  const markCheckedStatement = database.prepare(`
    UPDATE scraped_housing_posts
    SET is_checked = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const markSubmittedStatement = database.prepare(`
    UPDATE scraped_housing_posts
    SET is_submitted = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const markNotifiedStatement = database.prepare(`
    UPDATE scraped_housing_posts
    SET notified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  function requirePost(id: number): HousingPost {
    const post = findByIdStatement.get(id);

    if (!post) {
      throw new Error(`Housing post not found: ${id}`);
    }

    return toHousingPost(post);
  }

  function hasScrapedContentChanged(
    post: HousingPost,
    input: InsertHousingPostInput
  ): boolean {
    return (
      post.externalId !== (input.externalId ?? null) ||
      post.title !== input.title ||
      post.description !== (input.description ?? null) ||
      post.isNotice !== (input.isNotice ?? false) ||
      post.postedAt !== (input.postedAt ?? null) ||
      post.attachmentsJson !== (input.attachmentsJson ?? null)
    );
  }

  return {
    insertIfNew(input) {
      const result = insertPost.run({
        sourceId: input.sourceId,
        firstSeenRunId: input.firstSeenRunId ?? null,
        sourceSeq: input.sourceSeq ?? null,
        externalId: input.externalId ?? null,
        title: input.title,
        description: input.description ?? null,
        url: input.url,
        isNotice: booleanToSqlite(input.isNotice ?? false),
        postedAt: input.postedAt ?? null,
        attachmentsJson: input.attachmentsJson ?? null
      });

      let post = this.findBySourceAndUrl(input.sourceId, input.url);

      if (!post) {
        throw new Error("Failed to read inserted housing post");
      }

      let updated = false;

      if (result.changes === 0 && hasScrapedContentChanged(post, input)) {
        updateScrapedPostStatement.run({
          id: post.id,
          externalId: input.externalId ?? null,
          title: input.title,
          description: input.description ?? null,
          isNotice: booleanToSqlite(input.isNotice ?? false),
          postedAt: input.postedAt ?? null,
          attachmentsJson: input.attachmentsJson ?? null
        });
        post = requirePost(post.id);
        updated = true;
      }

      return {
        inserted: result.changes === 1,
        updated,
        post
      };
    },

    findById(id) {
      const row = findByIdStatement.get(id);

      return row ? toHousingPost(row) : null;
    },

    findBySourceAndUrl(sourceId, url) {
      const row = findBySourceAndUrlStatement.get(sourceId, url);

      return row ? toHousingPost(row) : null;
    },

    findRecent(limit) {
      return findRecentStatement.all(limit).map(toHousingPost);
    },

    findUnnotified(limit) {
      return findUnnotifiedStatement.all(limit).map(toHousingPost);
    },

    markChecked(id) {
      markCheckedStatement.run(id);

      return requirePost(id);
    },

    markSubmitted(id) {
      markSubmittedStatement.run(id);

      return requirePost(id);
    },

    markNotified(id) {
      markNotifiedStatement.run(id);

      return requirePost(id);
    }
  };
}
