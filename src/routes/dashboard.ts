import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { HousingPost } from "../repositories/housing-post-repository.js";
import type { AppRepositories } from "../repositories/app-repositories.js";
import type { ScrapeRun } from "../repositories/scrape-run-repository.js";
import type { ScrapeSource } from "../repositories/scrape-source-repository.js";
import { createScrapeService, type SourceHealth } from "../services/scrape-service.js";

type MarkPostParams = {
  id: string;
};

const statusLabels: Record<SourceHealth, string> = {
  unknown: "이력 없음",
  healthy: "정상",
  degraded: "주의",
  unhealthy: "장애"
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return value.slice(0, 10);
}

function parsePostId(params: MarkPostParams): number {
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid housing post id: ${params.id}`);
  }

  return id;
}

function redirectBack(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const referer = request.headers.referer;
  const location =
    typeof referer === "string" && referer.startsWith("/")
      ? referer
      : "/housing-posts";

  return reply.code(303).header("Location", location).send();
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · cw2.kr</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #2563eb;
      --ok: #059669;
      --warn: #d97706;
      --bad: #dc2626;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    header {
      background: #0f172a;
      color: white;
      padding: 28px max(24px, calc((100vw - 1120px) / 2));
    }
    header h1 { margin: 0 0 6px; font-size: 28px; }
    header p { margin: 0; color: #cbd5e1; }
    nav {
      display: flex;
      gap: 14px;
      margin-top: 18px;
      flex-wrap: wrap;
    }
    nav a {
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 14px;
    }
    main {
      max-width: 1120px;
      margin: 28px auto 64px;
      padding: 0 24px;
    }
    .grid { display: grid; gap: 16px; }
    .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 10px 24px rgb(15 23 42 / 5%);
    }
    .card h2, .card h3 { margin: 0 0 12px; }
    .metric { color: var(--muted); font-size: 13px; }
    .metric strong { display: block; color: var(--text); font-size: 30px; line-height: 1.1; }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 12px 8px;
      text-align: left;
      vertical-align: top;
    }
    th { color: var(--muted); font-size: 13px; font-weight: 600; }
    .muted { color: var(--muted); }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 650;
      background: #e2e8f0;
      color: #334155;
      white-space: nowrap;
    }
    .badge.healthy, .badge.success, .badge.done { background: #dcfce7; color: var(--ok); }
    .badge.degraded, .badge.running { background: #fef3c7; color: var(--warn); }
    .badge.unhealthy, .badge.failed, .badge.todo { background: #fee2e2; color: var(--bad); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button {
      border: 0;
      border-radius: 10px;
      background: var(--accent);
      color: white;
      cursor: pointer;
      font: inherit;
      padding: 7px 10px;
    }
    button.secondary { background: #475569; }
    .section { margin-top: 22px; }
    .empty { color: var(--muted); padding: 18px 0; }
    @media (max-width: 860px) {
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
      table { font-size: 14px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>cw2.kr Housing Dashboard</h1>
    <p>더포디엄830 공고 수집, 확인, 신청 상태를 보는 내부 대시보드</p>
    <nav>
      <a href="/">Overview</a>
      <a href="/housing-posts">Housing posts</a>
      <a href="/runs">Scrape runs</a>
      <a href="/health">Health</a>
    </nav>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function renderPostRows(posts: HousingPost[]): string {
  if (posts.length === 0) {
    return `<tr><td colspan="6" class="empty">공고가 없습니다.</td></tr>`;
  }

  return posts
    .map(
      (post) => `<tr>
        <td>
          <a href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer">${escapeHtml(post.title)}</a>
          ${post.isNotice ? `<span class="badge">고정/공지</span>` : ""}
          ${post.description ? `<div class="muted">${escapeHtml(post.description.slice(0, 140))}</div>` : ""}
        </td>
        <td>${formatDate(post.postedAt)}</td>
        <td>${post.notifiedAt ? `<span class="badge done">알림 완료</span>` : `<span class="badge todo">미알림</span>`}</td>
        <td>${post.isChecked ? `<span class="badge done">확인</span>` : `<span class="badge todo">미확인</span>`}</td>
        <td>${post.isSubmitted ? `<span class="badge done">신청</span>` : `<span class="badge">미신청</span>`}</td>
        <td>
          <div class="actions">
            ${
              post.isChecked
                ? ""
                : `<form method="post" action="/api/housing-posts/${post.id}/mark-checked"><button type="submit">확인</button></form>`
            }
            ${
              post.isSubmitted
                ? ""
                : `<form method="post" action="/api/housing-posts/${post.id}/mark-submitted"><button type="submit" class="secondary">신청</button></form>`
            }
          </div>
        </td>
      </tr>`
    )
    .join("");
}

function renderRunRows(runs: ScrapeRun[], sourcesById: Map<number, ScrapeSource>): string {
  if (runs.length === 0) {
    return `<tr><td colspan="5" class="empty">실행 이력이 없습니다.</td></tr>`;
  }

  return runs
    .map((run) => {
      const sourceName = sourcesById.get(run.sourceId)?.name ?? `source #${run.sourceId}`;

      return `<tr>
        <td>#${run.id}</td>
        <td>${escapeHtml(sourceName)}</td>
        <td><span class="badge ${run.status}">${escapeHtml(run.status)}</span></td>
        <td>${formatDate(run.startedAt)}</td>
        <td>${run.errorMessage ? escapeHtml(run.errorMessage) : "—"}</td>
      </tr>`;
    })
    .join("");
}

export async function registerDashboardRoutes(
  app: FastifyInstance,
  repositories: AppRepositories
): Promise<void> {
  const service = createScrapeService(repositories);

  app.get("/", async (_request, reply) => {
    const sources = repositories.sources.findEnabled();
    const recentPosts = repositories.housingPosts.findRecent(5);
    const uncheckedPosts = repositories.housingPosts.findUnchecked(5);
    const runs = repositories.runs.findRecent(5);
    const sourcesById = new Map(sources.map((source) => [source.id, source]));

    return reply.type("text/html").send(
      layout(
        "Overview",
        `<section class="grid grid-3">
          <div class="card metric"><strong>${sources.length}</strong>enabled sources</div>
          <div class="card metric"><strong>${uncheckedPosts.length}</strong>unchecked recent posts</div>
          <div class="card metric"><strong>${runs.length}</strong>recent runs shown</div>
        </section>
        <section class="grid grid-2 section">
          <div class="card">
            <h2>Source status</h2>
            ${
              sources.length === 0
                ? `<p class="empty">활성 source가 없습니다. <code>npm run sources:seed:thepodium</code>을 먼저 실행하세요.</p>`
                : sources
                    .map((source) => {
                      const health = service.getSourceHealth(source.id);

                      return `<p><span class="badge ${health}">${statusLabels[health]}</span> ${escapeHtml(source.name)}</p>`;
                    })
                    .join("")
            }
          </div>
          <div class="card">
            <h2>Recent runs</h2>
            <table><thead><tr><th>ID</th><th>Source</th><th>Status</th><th>Started</th><th>Error</th></tr></thead><tbody>${renderRunRows(runs, sourcesById)}</tbody></table>
          </div>
        </section>
        <section class="card section">
          <h2>Recent housing posts</h2>
          <table><thead><tr><th>Title</th><th>Posted</th><th>Notify</th><th>Checked</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>${renderPostRows(recentPosts)}</tbody></table>
        </section>`
      )
    );
  });

  app.get("/housing-posts", async (_request, reply) => {
    const posts = repositories.housingPosts.findRecent(50);

    return reply.type("text/html").send(
      layout(
        "Housing posts",
        `<section class="card">
          <h2>Housing posts</h2>
          <p class="muted">최근 50개 공고입니다. 확인/신청 상태는 이 페이지에서만 관리하고, 실제 신청은 외부에서 진행합니다.</p>
          <table><thead><tr><th>Title</th><th>Posted</th><th>Notify</th><th>Checked</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>${renderPostRows(posts)}</tbody></table>
        </section>`
      )
    );
  });

  app.get("/runs", async (_request, reply) => {
    const sources = repositories.sources.findEnabled();
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const runs = repositories.runs.findRecent(50);

    return reply.type("text/html").send(
      layout(
        "Scrape runs",
        `<section class="card">
          <h2>Scrape runs</h2>
          <p class="muted">최근 50개 scrape 실행 기록입니다.</p>
          <table><thead><tr><th>ID</th><th>Source</th><th>Status</th><th>Started</th><th>Error</th></tr></thead><tbody>${renderRunRows(runs, sourcesById)}</tbody></table>
        </section>`
      )
    );
  });

  app.post<{ Params: MarkPostParams }>(
    "/api/housing-posts/:id/mark-checked",
    async (request, reply) => {
      repositories.housingPosts.markChecked(parsePostId(request.params));

      return redirectBack(request, reply);
    }
  );

  app.post<{ Params: MarkPostParams }>(
    "/api/housing-posts/:id/mark-submitted",
    async (request, reply) => {
      repositories.housingPosts.markSubmitted(parsePostId(request.params));

      return redirectBack(request, reply);
    }
  );
}
