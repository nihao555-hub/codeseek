window.__ModuleLoader__.load({
	id: "codeseek-activity-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var react = require("react");
		var h = react.createElement;

		var STORAGE_OPEN = "codeseek-activity-open";
		var ROOT_ID = "codeseek-activity-root";
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
		function emptyList() {
			return { byId: {}, current: null, subagentsByParent: {}, ids: [] };
		}
		function readSessions(props) {
			if (typeof props.useSessions === "function") {
				return props.useSessions(function (s) { return s; });
			}
			return emptyList();
		}
		function emitFromProps(props, list) {
			var live = props.session || {};
			var sessionId = live.sessionId || props.sessionId || (list && list.current) || null;
			var calls = Array.isArray(live.runningCalls) ? live.runningCalls : [];
			var row = (list && list.byId && sessionId && list.byId[sessionId]) || {};
			emit({
				session: {
					id: sessionId || null,
					running: live.running === true || !!row.running,
					blank: live.blank !== false && row.blank !== false,
					calls: calls.map(function (item) {
						return { id: item.callId, name: item.name, args: clip(item.argsRaw, 80) };
					}),
					members: membersFromList(list, sessionId),
					error: live.lastAgentError || null,
					partial: !!live.partial,
				},
			});
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
		};

		function Probe(props) {
			var snap = react.useSyncExternalStore(subscribe, getSnapshot);
			var list = readSessions(props);
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
			var list = readSessions(props);
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

		function LiveSync(props) {
			var list = readSessions(props);
			react.useEffect(function () { emitFromProps(props, list); }, [props.session, props.sessionId, list]);
			return null;
		}

		function el(tag, attrs, children) {
			var node = document.createElement(tag);
			if (attrs) {
				Object.keys(attrs).forEach(function (key) {
					var value = attrs[key];
					if (value == null || value === false) return;
					if (key === "style") Object.assign(node.style, value);
					else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2).toLowerCase(), value);
					else if (key === "dataset") Object.keys(value).forEach(function (name) { node.dataset[name] = value[name]; });
					else node.setAttribute(key, value === true ? "" : String(value));
				});
			}
			(children || []).forEach(function (child) {
				if (child == null) return;
				node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
			});
			return node;
		}
		function text(value) { return document.createTextNode(String(value || "")); }

		function card(title, meta) {
			return el("div", { style: {
				border: "1px solid var(--dsw-alias-border-l2, #333)",
				background: "var(--dsw-alias-bg-layer-3, #1a1a1a)",
				borderRadius: "8px",
				padding: "8px 10px",
			} }, [
				el("div", { style: { fontSize: "12px", fontWeight: "600", lineHeight: "18px" } }, [text(title)]),
				meta ? el("p", { style: { margin: "0", color: "var(--dsw-alias-label-tertiary, #888)", fontSize: "11px", lineHeight: "16px" } }, [text(meta)]) : null,
			]);
		}
		function heading(label) {
			return el("h3", { style: {
				margin: "0 0 6px",
				fontSize: "11px",
				fontWeight: "600",
				color: "var(--dsw-alias-label-secondary, #aaa)",
				letterSpacing: "0.04em",
			} }, [text(label)]);
		}

		function paint() {
			var host = document.getElementById(ROOT_ID);
			if (!host || !host.isConnected) return;
			host.replaceChildren();
			var snap = getSnapshot();
			if (!snap.open) {
				host.appendChild(el("button", {
					type: "button",
					style: {
						position: "fixed",
						top: "120px",
						right: "0",
						zIndex: "10000",
						writingMode: "vertical-rl",
						pointerEvents: "auto",
						border: "1px solid var(--dsw-alias-border-l2, #444)",
						borderRight: "none",
						borderRadius: "8px 0 0 8px",
						background: "var(--dsw-alias-bg-layer-2, #161616)",
						color: "var(--dsw-alias-label-primary, #eee)",
						font: "inherit",
						cursor: "pointer",
						padding: "10px 6px",
						fontSize: "12px",
					},
					dataset: { codeseekActivity: "tab" },
					onClick: function () { setOpen(true); },
				}, [text("港窑实时")]));
				return;
			}
			var session = snap.session;
			var crm = snap.crm;
			var calls = session.calls || [];
			var members = session.members || [];
			var leads = (crm && crm.leads) || [];
			var deals = (crm && crm.deals) || [];
			var status = session.running
				? (calls.length ? "正在调用工具" : session.partial ? "正在生成回复" : "运行中")
				: session.blank ? "等待一句话开干" : "空闲";
			var bodyChildren = [
				el("section", null, [
					heading("正在做什么"),
					calls.length
						? el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, calls.map(function (row) {
							return card(shortTool(row.name), row.args || "（无参数预览）");
						}))
						: card(status, "发一句「帮我找北欧买家买保温杯」就会在这里列出工具名。"),
					session.error ? el("p", { style: { margin: "8px 0 0", color: "var(--dsw-alias-state-error-primary, #f66)", fontSize: "12px" } }, [text(clip(session.error, 160))]) : null,
				]),
				el("section", null, [
					heading("团员"),
					members.length
						? el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, members.map(function (row) {
							return card(row.title, row.running ? "运行中" : "已停");
						}))
						: el("p", { style: { margin: "0", color: "var(--dsw-alias-label-tertiary, #888)", fontSize: "11px" } }, [text("还没派营销/报价。kickoff 之后会出现。")]),
				]),
				el("section", null, [
					heading("线索"),
					snap.error ? el("p", { style: { margin: "0 0 6px", color: "var(--dsw-alias-state-error-primary, #f66)", fontSize: "12px" } }, [text(snap.error)]) : null,
					leads.length
						? el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, leads.slice(0, 6).map(function (row) {
							return card(row.company, [row.id, row.market, row.group, row.touch].filter(Boolean).join(" · ") + (row.sourceUrl || row.source ? "\n" + clip(row.sourceUrl || row.source, 72) : ""));
						}))
						: el("p", { style: { margin: "0", color: "var(--dsw-alias-label-tertiary, #888)", fontSize: "11px" } }, [text("CRM 还没有公开网页线索。")]),
				]),
				el("section", null, [
					heading("报价 / 商机"),
					el("p", { style: { margin: "0 0 6px", color: "var(--dsw-alias-label-tertiary, #888)", fontSize: "11px" } }, [text((crm && crm.quoteNote) || "报价来自 catalog.json，不是买家询盘。")]),
					deals.length
						? el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, deals.slice(0, 6).map(function (row) {
							return card(row.buyer, [row.id, row.sku, row.qty ? row.qty + " pcs" : "", row.status].filter(Boolean).join(" · "));
						}))
						: el("p", { style: { margin: "0", color: "var(--dsw-alias-label-tertiary, #888)", fontSize: "11px" } }, [text("还没有商机档案。")]),
				]),
			];
			host.appendChild(el("aside", {
				style: {
					position: "fixed",
					top: "56px",
					right: "0",
					bottom: "88px",
					width: WIDTH + "px",
					zIndex: "10000",
					display: "flex",
					flexDirection: "column",
					pointerEvents: "auto",
					borderLeft: "1px solid var(--dsw-alias-border-l2, #333)",
					background: "var(--dsw-alias-bg-layer-2, #111)",
					color: "var(--dsw-alias-label-primary, #eee)",
					boxShadow: "-8px 0 24px rgba(0,0,0,.18)",
				},
				dataset: { codeseekActivity: "open" },
			}, [
				el("div", { style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "8px",
					padding: "10px 12px 8px",
					borderBottom: "1px solid var(--dsw-alias-border-l2, #333)",
				} }, [
					el("div", null, [
						el("p", { style: { fontSize: "13px", fontWeight: "600", margin: "0" } }, [text("港窑实时")]),
						el("p", { style: { margin: "0", color: "var(--dsw-alias-label-tertiary, #888)", fontSize: "11px" } }, [text(status)]),
					]),
					el("button", { type: "button", style: css.btn, onClick: function () { setOpen(false); } }, [text("收起")]),
				]),
				el("div", { style: {
					overflow: "auto",
					padding: "10px 12px 16px",
					display: "flex",
					flexDirection: "column",
					gap: "12px",
					flex: "1 1 auto",
				} }, bodyChildren),
			]));
		}

		var crmTimer = 0;
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
		function ensureVanillaMount() {
			if (typeof document === "undefined") return;
			var body = document.body;
			if (!body) {
				document.addEventListener("DOMContentLoaded", ensureVanillaMount, { once: true });
				window.setTimeout(ensureVanillaMount, 50);
				return;
			}
			var host = document.getElementById(ROOT_ID);
			if (!host) {
				host = document.createElement("div");
				host.id = ROOT_ID;
				host.setAttribute("data-codeseek-activity", "host");
				body.appendChild(host);
				subscribe(paint);
			}
			paint();
			if (!crmTimer) {
				loadCrm();
				crmTimer = window.setInterval(loadCrm, POLL_MS);
			}
			window.__CODESEEK_ACTIVITY__ = "mounted";
		}

		var inject = ["slots"];
		function apply(ctx) {
			try {
				window.__CODESEEK_ACTIVITY__ = window.__CODESEEK_ACTIVITY__ || "apply";
				ensureVanillaMount();
				var slots = ctx.slots || (ctx.get && ctx.get("slots"));
				if (!slots || typeof slots.inject !== "function") {
					window.__CODESEEK_ACTIVITY__ = "mounted-no-slots";
					return;
				}
				slots.inject("shell.overlay", function () {
					return slots.register({ name: "shell.overlay", id: "codeseek-activity-rail", order: 20 }, LiveSync);
				});
				slots.inject("conversation.input.left", function () {
					return slots.register({ name: "conversation.input.left", id: "codeseek-activity-toggle", order: 20 }, Probe);
				});
				slots.inject("conversation.input.dock", function () {
					return slots.register({ name: "conversation.input.dock", id: "codeseek-activity-dock", order: 5 }, Dock);
				});
				window.__CODESEEK_ACTIVITY__ = "mounted";
			} catch (error) {
				window.__CODESEEK_ACTIVITY__ = String(error && error.message ? error.message : error);
				console.error("codeseek-activity-panel", error);
				ensureVanillaMount();
			}
		}

		ensureVanillaMount();
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
