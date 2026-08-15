window.__ModuleLoader__.load({
	id: "codeseek-activity-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var react = require("react");
		var reactDom = require("react-dom");
		var h = react.createElement;
		var portal = (reactDom && (reactDom.createPortal || (reactDom.default && reactDom.default.createPortal))) || null;

		var STORAGE_OPEN = "codeseek-activity-open";
		var WIDTH = 320;
		var POLL_MS = 2000;

		var snapshot = {
			open: true,
			crm: null,
			error: null,
			session: { id: null, running: false, blank: true, calls: [], members: [], error: null, partial: false },
		};
		try {
			if (window.localStorage.getItem(STORAGE_OPEN) === "0") snapshot.open = false;
		} catch (e) { /* ignore */ }

		var listeners = new Set();
		function getSnapshot() { return snapshot; }
		function subscribe(fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }
		function emit(patch) {
			snapshot = Object.assign({}, snapshot, patch);
			listeners.forEach(function (fn) { fn(); });
		}
		function setOpen(open) {
			emit({ open: open });
			try { window.localStorage.setItem(STORAGE_OPEN, open ? "1" : "0"); } catch (e) { /* ignore */ }
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

		var css = {
			badge: {
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "transparent",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				cursor: "pointer",
				borderRadius: "6px",
				padding: "2px 8px",
				display: "inline-flex",
				alignItems: "center",
				gap: "6px",
				fontSize: "12px",
			},
			dot: { width: "7px", height: "7px", borderRadius: "99px", flex: "none" },
			rail: {
				position: "fixed",
				top: "56px",
				right: "0",
				bottom: "88px",
				width: WIDTH + "px",
				zIndex: 80,
				display: "flex",
				flexDirection: "column",
				pointerEvents: "auto",
				borderLeft: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-2, #111)",
				color: "var(--dsw-alias-label-primary, #eee)",
				boxShadow: "-8px 0 24px rgba(0,0,0,.18)",
			},
			head: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "8px",
				padding: "10px 12px 8px",
				borderBottom: "1px solid var(--dsw-alias-border-l2)",
			},
			title: { fontSize: "13px", fontWeight: 600, margin: 0 },
			meta: { margin: 0, color: "var(--dsw-alias-label-tertiary, #888)", fontSize: "11px", lineHeight: "16px" },
			body: { overflow: "auto", padding: "10px 12px 16px", display: "flex", flexDirection: "column", gap: "12px", flex: "1 1 auto" },
			h: { margin: "0 0 6px", fontSize: "11px", fontWeight: 600, color: "var(--dsw-alias-label-secondary, #aaa)", letterSpacing: "0.04em" },
			card: {
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-3, #1a1a1a)",
				borderRadius: "8px",
				padding: "8px 10px",
			},
			rowTitle: { fontSize: "12px", fontWeight: 600, lineHeight: "18px" },
			btn: {
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "transparent",
				color: "inherit",
				font: "inherit",
				cursor: "pointer",
				borderRadius: "6px",
				padding: "2px 8px",
				fontSize: "12px",
			},
			tab: {
				position: "fixed",
				top: "120px",
				right: "0",
				zIndex: 80,
				writingMode: "vertical-rl",
				pointerEvents: "auto",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRight: "none",
				borderRadius: "8px 0 0 8px",
				background: "var(--dsw-alias-bg-layer-2, #111)",
				color: "inherit",
				font: "inherit",
				cursor: "pointer",
				padding: "10px 6px",
				fontSize: "12px",
			},
			dock: {
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-3, #1a1a1a)",
				borderRadius: "8px",
				padding: "8px 10px",
				fontSize: "12px",
				display: "flex",
				justifyContent: "space-between",
				gap: "8px",
				alignItems: "center",
			},
			warn: { margin: 0, color: "var(--dsw-alias-state-error-primary, #f66)", fontSize: "12px" },
		};

		function emitFromProps(props, list) {
			var live = props.session || {};
			var sessionId = props.sessionId || (list && list.current) || live.sessionId;
			var calls = Array.isArray(live.runningCalls) ? live.runningCalls : [];
			emit({
				session: {
					id: sessionId || null,
					running: !!live.running,
					blank: live.blank !== false,
					calls: calls.map(function (row) {
						return { id: row.callId, name: row.name, args: clip(row.argsRaw, 80) };
					}),
					members: membersFromList(list, sessionId),
					error: live.lastAgentError || null,
					partial: !!live.partial,
				},
			});
		}

		function Probe(props) {
			var snap = react.useSyncExternalStore(subscribe, getSnapshot);
			var list = props.useSessions(function (s) { return s; });
			react.useEffect(function () { emitFromProps(props, list); }, [props.session, props.sessionId, list]);
			var running = snap.session.running;
			return h("button", {
				type: "button",
				"data-codeseek-activity": "toggle",
				style: css.badge,
				onClick: function () { setOpen(!snap.open); },
			},
				h("span", { style: Object.assign({}, css.dot, { background: running ? "var(--dsw-alias-state-success-primary, #3c3)" : "var(--dsw-alias-label-tertiary, #888)" }) }),
				running ? "运行中" : "实时",
			);
		}

		function Dock(props) {
			var snap = react.useSyncExternalStore(subscribe, getSnapshot);
			var list = props.useSessions(function (s) { return s; });
			react.useEffect(function () { emitFromProps(props, list); }, [props.session, props.sessionId, list]);
			var session = snap.session;
			var status = session.running
				? (session.calls[0] ? shortTool(session.calls[0].name) : "运行中")
				: "港窑实时";
			return h("div", { style: css.dock, "data-codeseek-activity": "dock" },
				h("span", null, status + (session.calls.length > 1 ? " +" + (session.calls.length - 1) : "")),
				h("button", { type: "button", style: css.btn, onClick: function () { setOpen(!snap.open); } }, snap.open ? "收起右侧" : "打开右侧"),
			);
		}

		function Rail() {
			var snap = react.useSyncExternalStore(subscribe, getSnapshot);
			react.useEffect(function () {
				if (!snap.open) return undefined;
				var dead = false;
				function load() {
					fetch("/__codeseek/activity", { cache: "no-store" })
						.then(function (res) {
							if (!res.ok) throw new Error("HTTP " + res.status);
							return res.json();
						})
						.then(function (crm) { if (!dead) emit({ crm: crm, error: null }); })
						.catch(function (error) { if (!dead) emit({ error: String(error.message || error) }); });
				}
				load();
				var id = window.setInterval(load, POLL_MS);
				return function () { dead = true; window.clearInterval(id); };
			}, [snap.open]);

			var node;
			if (!snap.open) {
				node = h("button", { type: "button", style: css.tab, "data-codeseek-activity": "tab", onClick: function () { setOpen(true); } }, "港窑实时");
			} else {
				var session = snap.session;
				var crm = snap.crm;
				var calls = session.calls || [];
				var members = session.members || [];
				var leads = (crm && crm.leads) || [];
				var deals = (crm && crm.deals) || [];
				var status = session.running
					? (calls.length ? "正在调用工具" : session.partial ? "正在生成回复" : "运行中")
					: session.blank ? "等待一句话开干" : "空闲";
				node = h("aside", { style: css.rail, "data-codeseek-activity": "open" },
					h("div", { style: css.head },
						h("div", null,
							h("p", { style: css.title }, "港窑实时"),
							h("p", { style: css.meta }, status),
						),
						h("button", { type: "button", style: css.btn, onClick: function () { setOpen(false); } }, "收起"),
					),
					h("div", { style: css.body },
						h("section", null,
							h("h3", { style: css.h }, "正在做什么"),
							calls.length
								? calls.map(function (row) {
									return h("div", { key: row.id, style: css.card },
										h("div", { style: css.rowTitle }, shortTool(row.name)),
										h("p", { style: css.meta }, row.args || "（无参数预览）"),
									);
								})
								: h("div", { style: css.card },
									h("div", { style: css.rowTitle }, status),
									h("p", { style: css.meta }, "发一句「帮我找北欧买家买保温杯」就会在这里列出工具名。"),
								),
							session.error ? h("p", { style: css.warn }, clip(session.error, 160)) : null,
						),
						h("section", null,
							h("h3", { style: css.h }, "团员"),
							members.length
								? members.map(function (row) {
									return h("div", { key: row.id, style: css.card },
										h("div", { style: css.rowTitle }, row.title),
										h("p", { style: css.meta }, row.running ? "运行中" : "已停"),
									);
								})
								: h("p", { style: css.meta }, "还没派营销/报价。kickoff 之后会出现。"),
						),
						h("section", null,
							h("h3", { style: css.h }, "线索"),
							snap.error ? h("p", { style: css.warn }, snap.error) : null,
							leads.length
								? leads.slice(0, 6).map(function (row) {
									return h("div", { key: row.id, style: css.card },
										h("div", { style: css.rowTitle }, row.company),
										h("p", { style: css.meta }, [row.id, row.market, row.group, row.touch].filter(Boolean).join(" · ")),
										h("p", { style: css.meta }, clip(row.sourceUrl || row.source, 72)),
									);
								})
								: h("p", { style: css.meta }, "CRM 还没有公开网页线索。"),
						),
						h("section", null,
							h("h3", { style: css.h }, "报价 / 商机"),
							h("p", { style: css.meta }, (crm && crm.quoteNote) || "报价来自 catalog.json，不是买家询盘。"),
							deals.length
								? deals.slice(0, 6).map(function (row) {
									return h("div", { key: row.id, style: css.card },
										h("div", { style: css.rowTitle }, row.buyer),
										h("p", { style: css.meta }, [row.id, row.sku, row.qty ? row.qty + " pcs" : "", row.status].filter(Boolean).join(" · ")),
									);
								})
								: h("p", { style: css.meta }, "还没有商机档案。"),
						),
					),
				);
			}
			if (portal && typeof document !== "undefined" && document.body) {
				return portal(node, document.body);
			}
			return node;
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
				slots.inject("shell.overlay", function () {
					return slots.register({ name: "shell.overlay", id: "codeseek-activity-rail", order: 20 }, Rail);
				});
				slots.inject("conversation.input.left", function () {
					return slots.register({ name: "conversation.input.left", id: "codeseek-activity-toggle", order: 20 }, Probe);
				});
				slots.inject("conversation.input.dock", function () {
					return slots.register({ name: "conversation.input.dock", id: "codeseek-activity-dock", order: 5 }, Dock);
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
