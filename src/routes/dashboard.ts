import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { HousingPost } from "../repositories/housing-post-repository.js";
import type { AppRepositories } from "../repositories/app-repositories.js";
import type { ScrapeRun, ScrapeRunStatus } from "../repositories/scrape-run-repository.js";
import type { ScrapeSource } from "../repositories/scrape-source-repository.js";
import { createScrapeService, type SourceHealth } from "../services/scrape-service.js";

type MarkPostParams = {
  id: string;
};

type DashboardQuery = {
  source?: string;
  q?: string;
  checked?: string;
  submitted?: string;
  notified?: string;
  notice?: string;
  status?: string;
};

type NavKey = "overview" | "posts" | "runs" | "sources" | "health";

const statusLabels: Record<SourceHealth, string> = {
  unknown: "이력 없음",
  healthy: "정상",
  degraded: "주의",
  unhealthy: "장애"
};

const runStatusLabels: Record<ScrapeRunStatus, string> = {
  running: "실행 중",
  success: "성공",
  failed: "실패"
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return value.replace("T", " ").slice(0, 16);
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
  let location = "/housing-posts";

  if (typeof referer === "string") {
    try {
      const parsed = new URL(referer, "http://localhost");
      location = `${parsed.pathname}${parsed.search}`;
    } catch {
      if (referer.startsWith("/")) {
        location = referer;
      }
    }
  }

  return reply.code(303).header("Location", location).send();
}

function queryValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseQuery(query: unknown): DashboardQuery {
  const raw = query as Record<string, unknown>;

  return {
    source: queryValue(raw.source),
    q: queryValue(raw.q),
    checked: queryValue(raw.checked),
    submitted: queryValue(raw.submitted),
    notified: queryValue(raw.notified),
    notice: queryValue(raw.notice),
    status: queryValue(raw.status)
  };
}

function sourceIdFromQuery(query: DashboardQuery): number | null {
  if (!query.source || query.source === "all") {
    return null;
  }

  const sourceId = Number(query.source);

  return Number.isInteger(sourceId) && sourceId > 0 ? sourceId : null;
}

function matchesSearch(post: HousingPost, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [post.title, post.description, post.url, post.externalId]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function filterPosts(posts: HousingPost[], query: DashboardQuery): HousingPost[] {
  const sourceId = sourceIdFromQuery(query);

  return posts.filter((post) => {
    if (sourceId && post.sourceId !== sourceId) {
      return false;
    }
    if (!matchesSearch(post, query.q ?? "")) {
      return false;
    }
    if (query.checked === "unchecked" && post.isChecked) {
      return false;
    }
    if (query.checked === "checked" && !post.isChecked) {
      return false;
    }
    if (query.submitted === "submitted" && !post.isSubmitted) {
      return false;
    }
    if (query.submitted === "unsubmitted" && post.isSubmitted) {
      return false;
    }
    if (query.notified === "notified" && !post.notifiedAt) {
      return false;
    }
    if (query.notified === "unnotified" && post.notifiedAt) {
      return false;
    }
    if (query.notice === "notice" && !post.isNotice) {
      return false;
    }
    if (query.notice === "regular" && post.isNotice) {
      return false;
    }

    return true;
  });
}

function filterRuns(runs: ScrapeRun[], query: DashboardQuery): ScrapeRun[] {
  const sourceId = sourceIdFromQuery(query);

  return runs.filter((run) => {
    if (sourceId && run.sourceId !== sourceId) {
      return false;
    }
    if (query.status && query.status !== "all" && run.status !== query.status) {
      return false;
    }

    return true;
  });
}

function selected(current: string | undefined, value: string): string {
  return (current || "all") === value ? " selected" : "";
}

function sourceOptions(sources: ScrapeSource[], current?: string): string {
  return [
    `<option value="all"${selected(current, "all")}>전체 소스</option>`,
    ...sources.map(
      (source) =>
        `<option value="${source.id}"${selected(current, String(source.id))}>${escapeHtml(source.name)}</option>`
    )
  ].join("");
}

function layout(active: NavKey, title: string, body: string, footerMeta = ""): string {
  const nav = [
    ["overview", "/", "Overview", "⌂"],
    ["posts", "/housing-posts", "Housing Posts", "▤"],
    ["runs", "/runs", "Scrape Runs", "▷"],
    ["sources", "/sources", "Sources", "◉"],
    ["health", "/health", "Health", "◌"]
  ] as const;

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · cw2.kr</title>
  <style>
    :root {
      color-scheme: light;
      --app-bg: #f5f7fb;
      --surface: #ffffff;
      --surface-soft: #f8fbff;
      --text: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --line-strong: #cbd5e1;
      --primary: #2563eb;
      --primary-soft: #eaf1ff;
      --violet: #7c3aed;
      --green: #059669;
      --green-soft: #dcfce7;
      --orange: #ea580c;
      --orange-soft: #ffedd5;
      --red: #dc2626;
      --red-soft: #fee2e2;
      --slate-soft: #eef2f7;
      --shadow: 0 18px 45px rgb(15 23 42 / 7%);
      --shadow-soft: 0 8px 24px rgb(15 23 42 / 5%);
      --radius-lg: 24px;
      --radius-md: 16px;
      --radius-sm: 12px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 18% 0%, rgba(37, 99, 235, .09), transparent 28%),
        radial-gradient(circle at 100% 12%, rgba(124, 58, 237, .08), transparent 24%),
        var(--app-bg);
      color: var(--text);
      font: 14px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .app-shell { display: grid; grid-template-columns: 244px minmax(0, 1fr); min-height: 100vh; }
    aside {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 28px 18px;
      background: rgba(255,255,255,.82);
      border-right: 1px solid var(--line);
      backdrop-filter: blur(18px);
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .brand { display: flex; align-items: center; gap: 12px; padding: 0 4px; }
    .brand-mark {
      width: 38px; height: 38px; border-radius: 14px;
      display: grid; place-items: center;
      background: linear-gradient(135deg, var(--primary), var(--violet));
      color: white; font-weight: 850;
      box-shadow: 0 12px 26px rgb(37 99 235 / 28%);
    }
    .brand-title { font-weight: 820; font-size: 17px; letter-spacing: -.03em; }
    .brand-sub { color: var(--muted); font-size: 12px; margin-top: 1px; }
    .side-nav { display: grid; gap: 8px; }
    .side-nav a {
      color: #334155;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      font-weight: 720;
    }
    .side-nav a.active {
      background: linear-gradient(135deg, #eef5ff, #eef2ff);
      color: var(--primary);
      box-shadow: inset 0 0 0 1px rgba(37,99,235,.08);
    }
    .nav-icon { width: 22px; text-align: center; font-weight: 900; }
    .side-footer {
      margin-top: auto;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px;
      background: white;
      color: var(--muted);
      box-shadow: var(--shadow-soft);
      font-size: 12px;
    }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 6px; background: var(--green); }
    .main { min-width: 0; padding: 28px 32px 64px; }
    .topbar { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 22px; }
    .topbar h1 { margin: 0; font-size: 30px; line-height: 1.15; letter-spacing: -.045em; white-space: nowrap; }
    .top-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .toolbar {
      display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255,255,255,.72);
      box-shadow: var(--shadow-soft);
    }
    input, select {
      border: 1px solid var(--line);
      background: white;
      border-radius: 12px;
      color: var(--text);
      min-height: 42px;
      padding: 0 12px;
      font: inherit;
      outline: none;
    }
    input:focus, select:focus { border-color: rgba(37,99,235,.6); box-shadow: 0 0 0 4px rgba(37,99,235,.11); }
    input.search { width: min(340px, 42vw); }
    button, .button {
      border: 0;
      border-radius: 12px;
      min-height: 38px;
      background: var(--primary);
      color: white;
      cursor: pointer;
      font: inherit;
      font-weight: 800;
      padding: 8px 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 10px 20px rgb(37 99 235 / 18%);
    }
    button.secondary, .button.secondary { background: #475569; box-shadow: none; }
    button.ghost, .button.ghost {
      background: white;
      color: #334155;
      border: 1px solid var(--line);
      box-shadow: none;
    }
    .grid { display: grid; gap: 18px; }
    .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .grid-2 { grid-template-columns: minmax(0, 1.45fr) minmax(340px, .85fr); }
    .card {
      background: rgba(255,255,255,.9);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .card-pad { padding: 20px; }
    .card h2, .card h3 { margin: 0; letter-spacing: -.035em; }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--line);
    }
    .metric-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      min-height: 114px;
    }
    .metric-icon {
      width: 58px; height: 58px; border-radius: 18px;
      display: grid; place-items: center;
      font-size: 24px; font-weight: 900;
      background: var(--primary-soft); color: var(--primary);
    }
    .metric-icon.green { background: var(--green-soft); color: var(--green); }
    .metric-icon.orange { background: var(--orange-soft); color: var(--orange); }
    .metric-icon.red { background: var(--red-soft); color: var(--red); }
    .metric-label { color: var(--muted); font-weight: 760; }
    .metric-value { display: block; margin-top: 2px; color: var(--text); font-size: 32px; line-height: 1; font-weight: 870; letter-spacing: -.04em; }
    .metric-sub { color: var(--muted); font-size: 12px; margin-top: 7px; }
    .run-summary { display: grid; gap: 16px; }
    .summary-meta { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; color: var(--muted); }
    .count-list {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      border-top: 1px solid var(--line);
      padding-top: 16px;
      gap: 12px;
    }
    .count-item { color: var(--muted); font-size: 12px; border-right: 1px solid var(--line); }
    .count-item:last-child { border-right: 0; }
    .count-item strong { display: block; color: var(--text); font-size: 24px; line-height: 1.1; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 1000px; }
    th, td { border-bottom: 1px solid var(--line); padding: 14px 12px; text-align: left; vertical-align: top; }
    td:last-child, th:last-child { width: 128px; }
    th { color: #64748b; font-size: 12px; font-weight: 820; text-transform: uppercase; letter-spacing: .025em; background: #fbfdff; }
    tr:hover td { background: #fbfdff; }
    .source-cell { min-width: 132px; font-weight: 760; }
    .title-cell { min-width: 300px; }
    .run-issue { max-width: 320px; color: var(--muted); }
    .muted { color: var(--muted); }
    .truncate { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 850;
      background: var(--slate-soft);
      color: #475569;
      white-space: nowrap;
    }
    .badge.healthy, .badge.success, .badge.done, .badge.enabled { background: var(--green-soft); color: var(--green); }
    .badge.degraded, .badge.running, .badge.updated { background: var(--orange-soft); color: var(--orange); }
    .badge.unhealthy, .badge.failed, .badge.todo { background: var(--red-soft); color: var(--red); }
    .badge.unknown, .badge.disabled { background: var(--slate-soft); color: var(--muted); }
    .badge.notice { background: #ede9fe; color: var(--violet); margin-left: 8px; }
    .actions { display: flex; gap: 8px; flex-wrap: nowrap; align-items: center; min-width: 108px; }
    .actions button { white-space: nowrap; min-height: 36px; min-width: 36px; padding: 7px 10px; }
    .icon-button {
      width: 36px;
      min-height: 36px;
      padding: 0;
      border-radius: 11px;
    }
    .empty { color: var(--muted); padding: 22px; text-align: center; }
    .section { margin-top: 20px; }
    .source-list { display: grid; }
    .source-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 12px;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--line);
    }
    .source-row:last-child { border-bottom: 0; }
    .source-url { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
    @media (max-width: 1080px) {
      .app-shell { grid-template-columns: 1fr; }
      aside { position: static; height: auto; flex-direction: row; align-items: center; padding: 16px; overflow-x: auto; }
      .side-nav { display: flex; }
      .side-footer { display: none; }
      .main { padding: 22px 16px 52px; }
      .grid-4, .grid-2 { grid-template-columns: 1fr; }
      .topbar { flex-direction: column; }
      .top-actions { width: 100%; justify-content: flex-start; }
      input.search { width: 100%; }
      .toolbar { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside>
      <div class="brand">
        <div class="brand-mark">cw</div>
        <div><div class="brand-title">Housing Ops</div><div class="brand-sub">cw2.kr dashboard</div></div>
      </div>
      <nav class="side-nav">
        ${nav
          .map(
            ([key, href, label, icon]) =>
              `<a class="${active === key ? "active" : ""}" href="${href}"><span class="nav-icon">${icon}</span>${label}</a>`
          )
          .join("")}
      </nav>
      <div class="side-footer">${footerMeta || `<span class="status-dot"></span>대시보드 정상`}</div>
    </aside>
    <main class="main">${body}</main>
  </div>
</body>
</html>`;
}

function renderPageHeader(title: string, actions = ""): string {
  return `<div class="topbar"><h1>${escapeHtml(title)}</h1><div class="top-actions">${actions}</div></div>`;
}

function renderPostFilters(sources: ScrapeSource[], query: DashboardQuery): string {
  return `<form class="toolbar" method="get" action="/housing-posts">
    <input class="search" type="search" name="q" value="${escapeHtml(query.q ?? "")}" placeholder="공고 제목, 키워드 검색">
    <select name="source">${sourceOptions(sources, query.source)}</select>
    <select name="checked">
      <option value="all"${selected(query.checked, "all")}>확인 전체</option>
      <option value="unchecked"${selected(query.checked, "unchecked")}>미확인</option>
      <option value="checked"${selected(query.checked, "checked")}>확인 완료</option>
    </select>
    <select name="submitted">
      <option value="all"${selected(query.submitted, "all")}>신청 전체</option>
      <option value="unsubmitted"${selected(query.submitted, "unsubmitted")}>미신청</option>
      <option value="submitted"${selected(query.submitted, "submitted")}>신청 완료</option>
    </select>
    <select name="notified">
      <option value="all"${selected(query.notified, "all")}>알림 전체</option>
      <option value="notified"${selected(query.notified, "notified")}>알림 완료</option>
      <option value="unnotified"${selected(query.notified, "unnotified")}>미알림</option>
    </select>
    <select name="notice">
      <option value="all"${selected(query.notice, "all")}>유형 전체</option>
      <option value="notice"${selected(query.notice, "notice")}>고정/공지</option>
      <option value="regular"${selected(query.notice, "regular")}>일반</option>
    </select>
    <button type="submit">필터</button>
    <a class="button ghost" href="/housing-posts">초기화</a>
  </form>`;
}

function renderRunFilters(sources: ScrapeSource[], query: DashboardQuery): string {
  return `<form class="toolbar" method="get" action="/runs">
    <select name="source">${sourceOptions(sources, query.source)}</select>
    <select name="status">
      <option value="all"${selected(query.status, "all")}>상태 전체</option>
      <option value="success"${selected(query.status, "success")}>성공</option>
      <option value="running"${selected(query.status, "running")}>실행 중</option>
      <option value="failed"${selected(query.status, "failed")}>실패</option>
    </select>
    <button type="submit">필터</button>
    <a class="button ghost" href="/runs">초기화</a>
  </form>`;
}

function renderMetric(label: string, value: number, sub: string, icon: string, tone = ""): string {
  return `<div class="card metric-card">
    <div class="metric-icon ${tone}">${icon}</div>
    <div><div class="metric-label">${escapeHtml(label)}</div><strong class="metric-value">${value}</strong><div class="metric-sub">${escapeHtml(sub)}</div></div>
  </div>`;
}

function renderPostRows(
  posts: HousingPost[],
  sourcesById: Map<number, ScrapeSource>
): string {
  if (posts.length === 0) {
    return `<tr><td colspan="7" class="empty">조건에 맞는 공고가 없습니다.</td></tr>`;
  }

  return posts
    .map((post) => {
      const sourceName = sourcesById.get(post.sourceId)?.name ?? `source #${post.sourceId}`;

      return `<tr>
        <td class="source-cell">${escapeHtml(sourceName)}</td>
        <td class="title-cell">
          <a href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(post.title)}</strong></a>
          ${post.isNotice ? `<span class="badge notice">고정</span>` : ""}
          ${post.description ? `<div class="muted truncate">${escapeHtml(post.description.slice(0, 180))}</div>` : ""}
        </td>
        <td>${formatDate(post.postedAt)}</td>
        <td>${post.notifiedAt ? `<span class="badge done">알림 완료</span>` : `<span class="badge todo">미알림</span>`}</td>
        <td>${post.isChecked ? `<span class="badge done">확인 완료</span>` : `<span class="badge todo">미확인</span>`}</td>
        <td>${post.isSubmitted ? `<span class="badge done">신청 완료</span>` : `<span class="badge">미신청</span>`}</td>
        <td>
          <div class="actions">
            <a class="button ghost icon-button" href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer" title="원문 열기">↗</a>
            ${
              post.isChecked
                ? ""
                : `<form method="post" action="/api/housing-posts/${post.id}/mark-checked"><button type="submit" class="icon-button" title="확인 완료로 표시">✓</button></form>`
            }
            ${
              post.isSubmitted || !post.isChecked
                ? ""
                : `<form method="post" action="/api/housing-posts/${post.id}/mark-submitted"><button type="submit" class="secondary icon-button" title="신청 완료로 표시">↥</button></form>`
            }
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function renderRunRows(runs: ScrapeRun[], sourcesById: Map<number, ScrapeSource>): string {
  if (runs.length === 0) {
    return `<tr><td colspan="10" class="empty">조건에 맞는 실행 이력이 없습니다.</td></tr>`;
  }

  return runs
    .map((run) => {
      const sourceName = sourcesById.get(run.sourceId)?.name ?? `source #${run.sourceId}`;

      return `<tr>
        <td>#${run.id}</td>
        <td class="source-cell">${escapeHtml(sourceName)}</td>
        <td><span class="badge ${run.status}">${runStatusLabels[run.status]}</span></td>
        <td>${run.foundCount}</td>
        <td>${run.newCount}</td>
        <td>${run.updatedCount}</td>
        <td>${run.duplicateCount}</td>
        <td>${run.notificationErrorMessage ? `<span class="badge failed">알림 오류</span>` : `<span class="badge done">정상</span>`}</td>
        <td>${formatDateTime(run.startedAt)}</td>
        <td class="run-issue">${run.errorMessage || run.notificationErrorMessage ? escapeHtml(run.errorMessage ?? run.notificationErrorMessage ?? "") : "—"}</td>
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
    return `<div class="empty">등록된 source가 없습니다.</div>`;
  }

  return sources
    .map((source) => {
      const health = service.getSourceHealth(source.id);
      const latestRun = latestRunBySourceId.get(source.id);

      return `<div class="source-row">
        <div>
          <strong>${escapeHtml(source.name)}</strong>
          <div class="source-url">${escapeHtml(source.url)}</div>
        </div>
        <span class="badge ${source.enabled ? "enabled" : "disabled"}">${source.enabled ? "활성" : "비활성"}</span>
        <span class="badge ${health}">${statusLabels[health]}</span>
        <div class="muted">${latestRun ? formatDateTime(latestRun.startedAt) : "—"}</div>
      </div>`;
    })
    .join("");
}

function renderSourcesTableRows(
  sources: ScrapeSource[],
  latestRunBySourceId: Map<number, ScrapeRun>,
  service: ReturnType<typeof createScrapeService>
): string {
  if (sources.length === 0) {
    return `<tr><td colspan="8" class="empty">등록된 source가 없습니다.</td></tr>`;
  }

  return sources
    .map((source) => {
      const health = service.getSourceHealth(source.id);
      const latestRun = latestRunBySourceId.get(source.id);

      return `<tr>
        <td class="title-cell"><strong>${escapeHtml(source.name)}</strong><div class="muted truncate">${escapeHtml(source.url)}</div></td>
        <td><span class="badge ${source.enabled ? "enabled" : "disabled"}">${source.enabled ? "활성" : "비활성"}</span></td>
        <td><span class="badge ${health}">${statusLabels[health]}</span></td>
        <td>${latestRun ? `<span class="badge ${latestRun.status}">${runStatusLabels[latestRun.status]}</span>` : "—"}</td>
        <td>${latestRun?.foundCount ?? 0}</td>
        <td>${latestRun?.newCount ?? 0}</td>
        <td>${latestRun?.updatedCount ?? 0}</td>
        <td>${latestRun ? formatDateTime(latestRun.startedAt) : "—"}</td>
      </tr>`;
    })
    .join("");
}

function renderLatestRunSummary(
  latestRun: ScrapeRun | undefined,
  sourcesById: Map<number, ScrapeSource>
): string {
  if (!latestRun) {
    return `<div class="empty">아직 scrape 실행 이력이 없습니다.</div>`;
  }

  const sourceName = sourcesById.get(latestRun.sourceId)?.name ?? `source #${latestRun.sourceId}`;

  return `<div class="run-summary">
    <div class="summary-meta">
      <span class="badge ${latestRun.status}">${runStatusLabels[latestRun.status]}</span>
      <strong>${escapeHtml(sourceName)}</strong>
      <span>·</span>
      <span>${formatDateTime(latestRun.startedAt)}</span>
      ${
        latestRun.notificationErrorMessage
          ? `<span class="badge failed">알림 오류</span>`
          : `<span class="badge done">알림 정상</span>`
      }
    </div>
    <div class="count-list">
      <div class="count-item"><strong>${latestRun.foundCount}</strong>발견</div>
      <div class="count-item"><strong>${latestRun.newCount}</strong>신규</div>
      <div class="count-item"><strong>${latestRun.updatedCount}</strong>업데이트</div>
      <div class="count-item"><strong>${latestRun.duplicateCount}</strong>중복</div>
      <div class="count-item"><strong>${latestRun.notificationErrorMessage ? 1 : 0}</strong>알림 이슈</div>
    </div>
  </div>`;
}

function latestRunsBySource(runs: ScrapeRun[]): Map<number, ScrapeRun> {
  const latestRunBySourceId = new Map<number, ScrapeRun>();

  for (const run of runs) {
    if (!latestRunBySourceId.has(run.sourceId)) {
      latestRunBySourceId.set(run.sourceId, run);
    }
  }

  return latestRunBySourceId;
}

function footerMeta(latestRun: ScrapeRun | undefined, serviceStatus: SourceHealth = "healthy"): string {
  return `<div>마지막 실행</div><strong>${latestRun ? formatDateTime(latestRun.startedAt) : "—"}</strong><div><span class="status-dot"></span>${statusLabels[serviceStatus]}</div>`;
}

export async function registerDashboardRoutes(
  app: FastifyInstance,
  repositories: AppRepositories
): Promise<void> {
  const service = createScrapeService(repositories);

  app.get("/", async (_request, reply) => {
    const sources = repositories.sources.findAll();
    const enabledSources = sources.filter((source) => source.enabled);
    const posts = repositories.housingPosts.findRecent(250);
    const recentPosts = posts.slice(0, 8);
    const uncheckedPosts = posts.filter((post) => !post.isChecked);
    const updatedPosts = posts.filter((post) => post.updatedAt);
    const runs = repositories.runs.findRecent(80);
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const latestRunBySourceId = latestRunsBySource(runs);
    const latestRun = runs.find((run) => run.status === "success") ?? runs[0];

    return reply.type("text/html").send(
      layout(
        "overview",
        "Overview",
        `${renderPageHeader(
          "Housing Posts",
          `<a class="button ghost" href="/housing-posts">전체 공고 보기</a><a class="button" href="/runs">실행 이력</a>`
        )}
        <section class="grid grid-4">
          ${renderMetric("Sources", sources.length, `활성 ${enabledSources.length} / 비활성 ${sources.length - enabledSources.length}`, "◎")}
          ${renderMetric("Recent posts", recentPosts.length, "최근 수집 공고", "+", "green")}
          ${renderMetric("Updated", updatedPosts.length, "변경 감지", "✎", "orange")}
          ${renderMetric("Unchecked", uncheckedPosts.length, "확인 필요", "!", "red")}
        </section>
        <section class="grid grid-2 section">
          <div class="card">
            <div class="card-head"><h2>스크래핑 결과</h2><a class="button ghost" href="/runs">전체</a></div>
            <div class="card-pad">${renderLatestRunSummary(latestRun, sourcesById)}</div>
          </div>
          <div class="card">
            <div class="card-head"><h2>소스 상태</h2><a class="button ghost" href="/sources">관리</a></div>
            <div class="source-list">${renderSourceRows(sources, latestRunBySourceId, service)}</div>
          </div>
        </section>
        <section class="card section">
          <div class="card-head"><h2>공고 목록 <span class="badge">${recentPosts.length}</span></h2><a class="button ghost" href="/housing-posts">필터 열기</a></div>
          <div class="table-scroll">
            <table><thead><tr><th>소스</th><th>공고 제목</th><th>등록일</th><th>알림</th><th>확인</th><th>신청</th><th>작업</th></tr></thead><tbody>${renderPostRows(recentPosts, sourcesById)}</tbody></table>
          </div>
        </section>`,
        footerMeta(latestRun)
      )
    );
  });

  app.get<{ Querystring: DashboardQuery }>("/housing-posts", async (request, reply) => {
    const query = parseQuery(request.query);
    const sources = repositories.sources.findAll();
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const posts = filterPosts(repositories.housingPosts.findRecent(250), query).slice(0, 50);
    const latestRun = repositories.runs.findRecent(1)[0];

    return reply.type("text/html").send(
      layout(
        "posts",
        "Housing posts",
        `${renderPageHeader("Housing Posts", renderPostFilters(sources, query))}
        <section class="card">
          <div class="card-head"><h2>공고 목록 <span class="badge">${posts.length}</span></h2></div>
          <div class="table-scroll">
            <table><thead><tr><th>소스</th><th>공고 제목</th><th>등록일</th><th>알림</th><th>확인</th><th>신청</th><th>작업</th></tr></thead><tbody>${renderPostRows(posts, sourcesById)}</tbody></table>
          </div>
        </section>`,
        footerMeta(latestRun)
      )
    );
  });

  app.get<{ Querystring: DashboardQuery }>("/runs", async (request, reply) => {
    const query = parseQuery(request.query);
    const sources = repositories.sources.findAll();
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const runs = filterRuns(repositories.runs.findRecent(120), query).slice(0, 50);
    const latestRun = repositories.runs.findRecent(1)[0];

    return reply.type("text/html").send(
      layout(
        "runs",
        "Scrape runs",
        `${renderPageHeader("Scrape Runs", renderRunFilters(sources, query))}
        <section class="card">
          <div class="card-head"><h2>실행 이력 <span class="badge">${runs.length}</span></h2></div>
          <div class="table-scroll">
            <table><thead><tr><th>ID</th><th>소스</th><th>상태</th><th>발견</th><th>신규</th><th>업데이트</th><th>중복</th><th>알림</th><th>시작</th><th>이슈</th></tr></thead><tbody>${renderRunRows(runs, sourcesById)}</tbody></table>
          </div>
        </section>`,
        footerMeta(latestRun)
      )
    );
  });

  app.get("/sources", async (_request, reply) => {
    const sources = repositories.sources.findAll();
    const runs = repositories.runs.findRecent(120);
    const latestRunBySourceId = latestRunsBySource(runs);
    const latestRun = runs[0];

    return reply.type("text/html").send(
      layout(
        "sources",
        "Sources",
        `${renderPageHeader("Sources", `<a class="button ghost" href="/runs">실행 이력 보기</a>`)}
        <section class="card">
          <div class="card-head"><h2>Scrape sources <span class="badge">${sources.length}</span></h2></div>
          <div class="table-scroll">
            <table><thead><tr><th>소스</th><th>활성</th><th>헬스</th><th>최근 실행</th><th>발견</th><th>신규</th><th>업데이트</th><th>시작</th></tr></thead><tbody>${renderSourcesTableRows(sources, latestRunBySourceId, service)}</tbody></table>
          </div>
        </section>`,
        footerMeta(latestRun)
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
