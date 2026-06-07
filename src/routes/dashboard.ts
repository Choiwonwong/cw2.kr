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
    .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
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
    .table-scroll { overflow-x: auto; }
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
    .badge.disabled { background: #f1f5f9; color: var(--muted); }
    .count-list {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .count-item {
      border-right: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
    }
    .count-item:last-child { border-right: 0; }
    .count-item strong {
      display: block;
      color: var(--text);
      font-size: 22px;
    }
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
      .grid-2, .grid-3, .grid-4, .count-list { grid-template-columns: 1fr; }
      table { font-size: 14px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>cw2.kr Housing Dashboard</h1>
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

function renderPostRows(
  posts: HousingPost[],
  sourcesById: Map<number, ScrapeSource>
): string {
  if (posts.length === 0) {
    return `<tr><td colspan="7" class="empty">공고가 없습니다.</td></tr>`;
  }

  return posts
    .map((post) => {
      const sourceName = sourcesById.get(post.sourceId)?.name ?? `source #${post.sourceId}`;

      return `<tr>
        <td>${escapeHtml(sourceName)}</td>
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
      </tr>`;
    })
    .join("");
}

function renderRunRows(runs: ScrapeRun[], sourcesById: Map<number, ScrapeSource>): string {
  if (runs.length === 0) {
    return `<tr><td colspan="10" class="empty">실행 이력이 없습니다.</td></tr>`;
  }

  return runs
    .map((run) => {
      const sourceName = sourcesById.get(run.sourceId)?.name ?? `source #${run.sourceId}`;

      return `<tr>
        <td>#${run.id}</td>
        <td>${escapeHtml(sourceName)}</td>
        <td><span class="badge ${run.status}">${escapeHtml(run.status)}</span></td>
        <td>${run.foundCount}</td>
        <td>${run.newCount}</td>
        <td>${run.updatedCount}</td>
        <td>${run.duplicateCount}</td>
        <td>${run.notificationErrorMessage ? `<span class="badge failed">알림 오류</span>` : `<span class="badge done">OK</span>`}</td>
        <td>${formatDate(run.startedAt)}</td>
        <td>${run.errorMessage || run.notificationErrorMessage ? escapeHtml(run.errorMessage ?? run.notificationErrorMessage ?? "") : "—"}</td>
      </tr>`;
    })
    .join("");
}

function renderSourceRows(
  sources: ScrapeSource[],
  latestRunBySourceId: Map<number, ScrapeRun>,
  service: ReturnType<typeof createScrapeService>
): string {
  if (sources.length === 0) {
    return `<tr><td colspan="8" class="empty">등록된 source가 없습니다. CLI에서 seed 명령을 먼저 실행하세요.</td></tr>`;
  }

  return sources
    .map((source) => {
      const health = service.getSourceHealth(source.id);
      const latestRun = latestRunBySourceId.get(source.id);

      return `<tr>
        <td>
          <strong>${escapeHtml(source.name)}</strong>
          <div class="muted">${escapeHtml(source.url)}</div>
        </td>
        <td>${source.enabled ? `<span class="badge done">활성</span>` : `<span class="badge disabled">비활성</span>`}</td>
        <td><span class="badge ${health}">${statusLabels[health]}</span></td>
        <td>${latestRun ? `<span class="badge ${latestRun.status}">${latestRun.status}</span>` : "—"}</td>
        <td>${latestRun?.foundCount ?? 0}</td>
        <td>${latestRun?.newCount ?? 0}</td>
        <td>${latestRun?.updatedCount ?? 0}</td>
        <td>${latestRun ? formatDate(latestRun.startedAt) : "—"}</td>
      </tr>`;
    })
    .join("");
}

function renderLatestRunSummary(
  latestRun: ScrapeRun | undefined,
  sourcesById: Map<number, ScrapeSource>
): string {
  if (!latestRun) {
    return `<p class="empty">아직 scrape 실행 이력이 없습니다.</p>`;
  }

  const sourceName = sourcesById.get(latestRun.sourceId)?.name ?? `source #${latestRun.sourceId}`;

  return `<p class="muted">최근 실행 · ${escapeHtml(sourceName)} · ${formatDate(latestRun.startedAt)}</p>
    <p><span class="badge ${latestRun.status}">${latestRun.status}</span> ${
      latestRun.notificationErrorMessage
        ? `<span class="badge failed">알림 오류</span>`
        : `<span class="badge done">알림 OK</span>`
    }</p>
    <div class="count-list">
      <div class="count-item"><strong>${latestRun.foundCount}</strong>발견</div>
      <div class="count-item"><strong>${latestRun.newCount}</strong>신규</div>
      <div class="count-item"><strong>${latestRun.updatedCount}</strong>업데이트</div>
      <div class="count-item"><strong>${latestRun.duplicateCount}</strong>중복</div>
    </div>`;
}

export async function registerDashboardRoutes(
  app: FastifyInstance,
  repositories: AppRepositories
): Promise<void> {
  const service = createScrapeService(repositories);

  app.get("/", async (_request, reply) => {
    const sources = repositories.sources.findAll();
    const enabledSources = sources.filter((source) => source.enabled);
    const recentPosts = repositories.housingPosts.findRecent(8);
    const uncheckedPosts = repositories.housingPosts.findUnchecked(5);
    const runs = repositories.runs.findRecent(8);
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const latestRunBySourceId = new Map<number, ScrapeRun>();

    for (const run of runs) {
      if (!latestRunBySourceId.has(run.sourceId)) {
        latestRunBySourceId.set(run.sourceId, run);
      }
    }

    const latestRun = runs.find((run) => run.status === "success") ?? runs[0];

    return reply.type("text/html").send(
      layout(
        "Overview",
        `<section class="grid grid-4">
          <div class="card metric"><strong>${sources.length}</strong>total sources</div>
          <div class="card metric"><strong>${enabledSources.length}</strong>enabled sources</div>
          <div class="card metric"><strong>${recentPosts.length}</strong>recent posts shown</div>
          <div class="card metric"><strong>${uncheckedPosts.length}</strong>unchecked posts</div>
        </section>
        <section class="grid grid-2 section">
          <div class="card">
            <h2>스크래핑 결과</h2>
            ${renderLatestRunSummary(latestRun, sourcesById)}
          </div>
          <div class="card">
            <h2>Scrape sources</h2>
            <div class="table-scroll">
              <table>
                <thead><tr><th>Source</th><th>Enabled</th><th>Health</th><th>Last run</th><th>Found</th><th>New</th><th>Updated</th><th>Started</th></tr></thead>
                <tbody>${renderSourceRows(sources, latestRunBySourceId, service)}</tbody>
              </table>
            </div>
          </div>
        </section>
        <section class="card section">
          <h2>Recent housing posts</h2>
          <div class="table-scroll">
            <table><thead><tr><th>Source</th><th>Title</th><th>Posted</th><th>Notify</th><th>Checked</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>${renderPostRows(recentPosts, sourcesById)}</tbody></table>
          </div>
        </section>
        <section class="card section">
          <h2>Recent scrape runs</h2>
          <div class="table-scroll">
            <table><thead><tr><th>ID</th><th>Source</th><th>Status</th><th>Found</th><th>New</th><th>Updated</th><th>Dup</th><th>Notify</th><th>Started</th><th>Issue</th></tr></thead><tbody>${renderRunRows(runs, sourcesById)}</tbody></table>
          </div>
        </section>`
      )
    );
  });

  app.get("/housing-posts", async (_request, reply) => {
    const posts = repositories.housingPosts.findRecent(50);
    const sources = repositories.sources.findAll();
    const sourcesById = new Map(sources.map((source) => [source.id, source]));

    return reply.type("text/html").send(
      layout(
        "Housing posts",
        `<section class="card">
          <h2>Housing posts</h2>
          <div class="table-scroll">
            <table><thead><tr><th>Source</th><th>Title</th><th>Posted</th><th>Notify</th><th>Checked</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>${renderPostRows(posts, sourcesById)}</tbody></table>
          </div>
        </section>`
      )
    );
  });

  app.get("/runs", async (_request, reply) => {
    const sources = repositories.sources.findAll();
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const runs = repositories.runs.findRecent(50);

    return reply.type("text/html").send(
      layout(
        "Scrape runs",
        `<section class="card">
          <h2>Scrape runs</h2>
          <p class="muted">최근 50개 scrape 실행 기록과 수집 결과입니다.</p>
          <div class="table-scroll">
            <table><thead><tr><th>ID</th><th>Source</th><th>Status</th><th>Found</th><th>New</th><th>Updated</th><th>Dup</th><th>Notify</th><th>Started</th><th>Issue</th></tr></thead><tbody>${renderRunRows(runs, sourcesById)}</tbody></table>
          </div>
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
