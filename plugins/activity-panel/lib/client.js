window.__ModuleLoader__.load({
	id: "codeseek-activity-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var react = require("react");
		var h = react.createElement;
		var POLL_MS = 2000;

		var snapshot = {
			crm: null,
			error: null,
			session: { id: null, running: false, blank: true, calls: [], members: [], error: null, partial: false },
		};
		var listeners = new Set();
		function getSnapshot() { return snapshot; }
		function subscribe(fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }
		function emit(patch) {
			snapshot = Object.assign({}, snapshot, patch);
			listeners.forEach(function (fn) { fn(); });
		}

		function shortTool(name) {
			var text = String(name || "");
			var m = text.match(/^mcp__([^_]+)__(.+)$/);
			return m ? (m[1] + " · " + m[2]) : text.replace(/^mcp__/, "");
		}
		function clip(text, n) {
			var value = String(text || "").replace(/\s+/g, " ").trim();
			return value.length > n ? value.slice(0, n) + "…" : value;
		}
		function membersFromList(list, parentId) {
			if (!list || !parentId) return [];
			var byId = list.byId || {};
			var catalog = (list.subagentsByParent && list.subagentsByParent[parentId]) || {};
			var out = [];
			var seen = {};
			function add(id, title, running) {
				if (!id || seen[id]) return;
				seen[id] = true;
				out.push({ id: id, title: title || id, running: !!running });
			}
			(catalog.entries || []).forEach(function (row) {
				if (row && row.kind === "child") add(row.id, row.label, row.activity === "running");
			});
			Object.keys(byId).forEach(function (id) {
				var row = byId[id];
				if (row && row.parentId === parentId) add(row.id, row.displayTitle || row.title, row.running);
			});
			return out;
		}
		function emptySession() {
			return { runningCalls: [], running: false, blank: true, lastAgentError: null, partial: null, sessionId: null };
		}
		function emptyList() {
			return { byId: {}, current: null, subagentsByParent: {}, ids: [] };
		}
		function emitFromProps(props, live, list) {
			var sessionId = (live && live.sessionId) || props.sessionId || (list && list.current) || null;
			var calls = Array.isArray(live && live.runningCalls) ? live.runningCalls : [];
			var row = (list && list.byId && sessionId && list.byId[sessionId]) || {};
			emit({
				session: {
					id: sessionId || null,
					running: !!(live && live.running) || !!row.running,
					blank: !(live && live.blank === false) && row.blank !== false,
					calls: calls.map(function (item) {
						return { id: item.callId, name: item.name, args: clip(item.argsRaw, 80) };
					}),
					members: membersFromList(list, sessionId),
					error: (live && live.lastAgentError) || null,
					partial: !!(live && live.partial),
				},
			});
		}
		function mergeLive(crm) {
			var live = crm && crm.live;
			var cur = getSnapshot().session;
			if (!live) return { crm: crm, error: null };
			var hostCalls = (live.calls && live.calls.length) ? live.calls : (live.recent || []);
			var next = Object.assign({}, cur);
			if (!cur.calls.length && hostCalls.length) next.calls = hostCalls;
			if (!cur.members.length && live.members && live.members.length) next.members = live.members;
			if (live.running) {
				next.running = true;
				next.blank = false;
			}
			return { crm: crm, error: null, session: next };
		}
		function loadCrm() {
			fetch("/__codeseek/activity", { cache: "no-store" })
				.then(function (res) {
					if (!res.ok) throw new Error("HTTP " + res.status);
					return res.json();
				})
				.then(function (crm) { emit(mergeLive(crm)); })
				.catch(function (error) { emit({ error: String(error.message || error) }); });
		}

		var css = {
			page: {
				height: "100%",
				overflow: "auto",
				padding: "16px 20px 28px",
				display: "flex",
				flexDirection: "column",
				gap: "16px",
				color: "var(--dsw-alias-label-primary)",
			},
			title: { margin: "0", fontSize: "16px", fontWeight: 600 },
			meta: { margin: "4px 0 0", color: "var(--dsw-alias-label-tertiary, #888)", fontSize: "12px", lineHeight: "18px" },
			h: { margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "var(--dsw-alias-label-secondary, #aaa)", letterSpacing: "0.04em" },
			grid: { display: "flex", flexDirection: "column", gap: "8px" },
			card: {
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-3, #1a1a1a)",
				borderRadius: "10px",
				padding: "10px 12px",
			},
			rowTitle: { fontSize: "13px", fontWeight: 600, lineHeight: "20px" },
			warn: { margin: "0", color: "var(--dsw-alias-state-error-primary, #f66)", fontSize: "12px" },
		};

		function card(title, meta, key) {
			return h("div", { key: key, style: css.card },
				h("div", { style: css.rowTitle }, title),
				meta ? h("p", { style: css.meta }, meta) : null,
			);
		}

		function ActivityView(props) {
			var snap = react.useSyncExternalStore(subscribe, getSnapshot);
			var useSession = props.useSession || function (sel) { return sel(emptySession()); };
			var useSessions = props.useSessions || function (sel) { return sel(emptyList()); };
			var live = useSession(function (s) { return s; });
			var list = useSessions(function (s) { return s; });
			react.useEffect(function () { emitFromProps(props, live, list); }, [live, list, props.sessionId]);
			react.useEffect(function () {
				loadCrm();
				var id = window.setInterval(loadCrm, POLL_MS);
				window.__CODESEEK_ACTIVITY__ = "view";
				return function () { window.clearInterval(id); };
			}, []);

			var session = snap.session;
			var crm = snap.crm;
			var calls = session.calls || [];
			var members = session.members || [];
			var leads = (crm && crm.leads) || [];
			var deals = (crm && crm.deals) || [];
			var status = session.running
				? (calls.length ? "正在调用工具" : session.partial ? "正在生成回复" : "运行中")
				: session.blank ? "等待一句话开干" : "空闲";

			return h("div", { style: css.page, "data-codeseek-activity": "view" },
				h("header", null,
					h("h1", { style: css.title }, "港窑实时"),
					h("p", { style: css.meta }, status + " · 和 Chat / Trajectory 一样是会话顶栏的一个视图，不是浮层。"),
				),
				h("section", null,
					h("h2", { style: css.h }, "正在做什么"),
					h("div", { style: css.grid },
						calls.length
							? calls.map(function (row) { return card(shortTool(row.name), row.args || "（无参数预览）", row.id); })
							: card(status, "发一句「帮我找北欧买家买保温杯」就会在这里列出工具名。", "idle"),
					),
					session.error ? h("p", { style: css.warn }, clip(session.error, 200)) : null,
				),
				h("section", null,
					h("h2", { style: css.h }, "团员"),
					members.length
						? h("div", { style: css.grid }, members.map(function (row) {
							return card(row.title, row.running ? "运行中" : "已停", row.id);
						}))
						: h("p", { style: css.meta }, "还没派营销/报价。kickoff 之后会出现。"),
				),
				h("section", null,
					h("h2", { style: css.h }, "线索"),
					snap.error ? h("p", { style: css.warn }, snap.error) : null,
					leads.length
						? h("div", { style: css.grid }, leads.slice(0, 10).map(function (row) {
							return card(row.company, [row.id, row.market, row.group, row.touch].filter(Boolean).join(" · ") + (row.sourceUrl ? " · " + clip(row.sourceUrl, 72) : ""), row.id);
						}))
						: h("p", { style: css.meta }, "CRM 还没有公开网页线索。"),
				),
				h("section", null,
					h("h2", { style: css.h }, "报价 / 商机"),
					h("p", { style: css.meta }, (crm && crm.quoteNote) || "报价来自 catalog.json，不是买家询盘。"),
					deals.length
						? h("div", { style: css.grid }, deals.slice(0, 10).map(function (row) {
							return card(row.buyer, [row.id, row.sku, row.qty ? row.qty + " pcs" : "", row.status].filter(Boolean).join(" · "), row.id);
						}))
						: h("p", { style: css.meta }, "还没有商机档案。"),
				),
			);
		}

		var inject = ["slots"];
		function apply(ctx) {
			try {
				window.__CODESEEK_ACTIVITY__ = "apply";
				var slots = ctx.slots || (ctx.get && ctx.get("slots"));
				if (!slots || typeof slots.inject !== "function") {
					window.__CODESEEK_ACTIVITY__ = "no-slots";
					return;
				}
				slots.inject("conversation.view", function () {
					return slots.register({
						name: "conversation.view",
						id: "codeseek-activity",
						order: 5,
						label: "港窑实时",
					}, ActivityView);
				});
				window.__CODESEEK_ACTIVITY__ = "registered";
			} catch (error) {
				window.__CODESEEK_ACTIVITY__ = String(error && error.message ? error.message : error);
				console.error("codeseek-activity-panel", error);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
