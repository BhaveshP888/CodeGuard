import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  boolean,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * 768-dimension vector type for Google Gemini text-embedding-004.
 * Stores vectors as PostgreSQL pgvector `vector(768)`.
 */
export const vector768 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        // Fallback if returned in bracket format '[0.1, 0.2]'
        return value
          .replace(/[\[\]]/g, '')
          .split(',')
          .map((v) => parseFloat(v.trim()))
          .filter((v) => !isNaN(v));
      }
    }
    return value as unknown as number[];
  },
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  githubId: text('github_id').notNull().unique(),
  username: text('username').notNull(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  accessTokenIv: text('access_token_iv').notNull(),
  accessTokenTag: text('access_token_tag').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    githubRepoId: integer('github_repo_id').notNull().unique(),
    fullName: text('full_name').notNull(), // 'owner/repo'
    defaultBranch: text('default_branch').default('main').notNull(),
    isIndexed: boolean('is_indexed').default(false).notNull(),
    indexingStatus: text('indexing_status').default('idle').notNull(), // 'idle' | 'indexing' | 'completed' | 'failed'
    lastIndexedAt: timestamp('last_indexed_at'),
    webhookInstalled: boolean('webhook_installed').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('repo_user_idx').on(table.userId),
    index('repo_fullname_idx').on(table.fullName),
  ]
);

export const architectureRules = pgTable(
  'architecture_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repositoryId: uuid('repository_id')
      .references(() => repositories.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    category: text('category').notNull(), // 'security' | 'architecture' | 'performance' | 'style'
    severity: text('severity').notNull(), // 'critical' | 'high' | 'medium' | 'low'
    content: text('content').notNull(),
    sourceType: text('source_type').notNull(), // 'markdown' | 'pdf' | 'manual'
    storageKey: text('storage_key'), // S3 / R2 object key
    scopePattern: text('scope_pattern'), // e.g. "src/auth/**", "api/**/*.ts"
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('rules_repo_idx').on(table.repositoryId),
  ]
);

export const ruleEmbeddings = pgTable(
  'rule_embeddings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ruleId: uuid('rule_id')
      .references(() => architectureRules.id, { onDelete: 'cascade' })
      .notNull(),
    repositoryId: uuid('repository_id')
      .references(() => repositories.id, { onDelete: 'cascade' })
      .notNull(),
    chunkContent: text('chunk_content').notNull(),
    embedding: vector768('embedding').notNull(),
    metadata: jsonb('metadata').notNull(), // { category, severity, scopePattern, ruleTitle }
  },
  (table) => [
    index('rule_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('rule_embed_repo_idx').on(table.repositoryId),
  ]
);

export const codebaseEmbeddings = pgTable(
  'codebase_embeddings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repositoryId: uuid('repository_id')
      .references(() => repositories.id, { onDelete: 'cascade' })
      .notNull(),
    filePath: text('file_path').notNull(),
    language: text('language').notNull(),
    symbolName: text('symbol_name'),
    chunkContent: text('chunk_content').notNull(),
    startLine: integer('start_line').notNull(),
    endLine: integer('end_line').notNull(),
    embedding: vector768('embedding').notNull(),
    commitSha: text('commit_sha').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('codebase_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('codebase_repo_filepath_idx').on(table.repositoryId, table.filePath),
  ]
);

export const pullRequestReviews = pgTable(
  'pull_request_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repositoryId: uuid('repository_id')
      .references(() => repositories.id, { onDelete: 'cascade' })
      .notNull(),
    prNumber: integer('pr_number').notNull(),
    prTitle: text('pr_title').notNull(),
    authorUsername: text('author_username').notNull(),
    baseSha: text('base_sha').notNull(),
    headSha: text('head_sha').notNull(),
    status: text('status').default('analyzing').notNull(), // 'analyzing' | 'completed' | 'failed'
    summary: text('summary'),
    riskScore: integer('risk_score'), // 0 - 100
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('pr_review_repo_pr_idx').on(table.repositoryId, table.prNumber),
  ]
);

export const reviewComments = pgTable(
  'review_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .references(() => pullRequestReviews.id, { onDelete: 'cascade' })
      .notNull(),
    filePath: text('file_path').notNull(),
    lineNumber: integer('line_number').notNull(),
    side: text('side').default('RIGHT').notNull(), // 'LEFT' | 'RIGHT'
    category: text('category').notNull(), // 'security' | 'architecture' | 'performance' | 'style'
    severity: text('severity').notNull(), // 'critical' | 'high' | 'medium' | 'low'
    title: text('title').notNull(),
    message: text('message').notNull(),
    ruleCited: text('rule_cited'),
    suggestedPatch: text('suggested_patch'),
    isResolved: boolean('is_resolved').default(false).notNull(),
    githubCommentId: text('github_comment_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('comment_review_idx').on(table.reviewId),
    index('comment_resolved_idx').on(table.isResolved),
  ]
);
