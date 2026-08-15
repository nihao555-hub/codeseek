window.__ModuleLoader__.load({
	id: "codeseek-activity-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const react = require("react");
		const h = react.createElement;

		const STORAGE_OPEN = "codeseek-activity-open";
		const STORAGE_WIDTH = "codeseek-activity-width";
		const WIDTH_MIN = 260;
		const WIDTH_MAX = 440;
		const WIDTH_DEFAULT = 320;
		const POLL_MS = 2000;

		let snapshot = {
			open: true,
			crm: null,
			error: null,
			session: {
				id: null,
				running: false,
				blank: true,
				calls: [],
				pending: [],
				error: null,
				partial: false,
				members: [],
			},
		};
		const listeners = new Set();
		function getSnapshot() { return snapshot; }
		function subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
		function emit(patch) {
			snapshot = { ...snapshot, ...patch };
			for (const listener of listeners) listener();
		}

		try {
			const raw = window.localStorage.getItem(STORAGE_OPEN);
			if (raw === "0") snapshot = { ...snapshot, open: false };
		} catch { /* ignore */ }

		function setOpen(open) {
			emit({ open });
			try { window.localStorage.setItem(STORAGE_OPEN, open ? "1" : "0"); } catch { /* ignore */ }
		}

		function shortTool(name) {
			const text = String(name || "");
			const mcp = text.match(/^mcp__([^_]+)__(.+)$/);
			if (mcp) return mcp[1] + " · " + mcp[2];
			return text.replace(/^mcp__/, "");
		}

		function clip(text, n) {
			const value = String(text || "").replace(/\s+/g, " ").trim();
			return value.length > n ? value.slice(0, n) + "…" : value;
		}

		const css = {
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
				lineHeight: "18px",
			},
			dot: {
				width: "7px",
				height: "7px",
				borderRadius: "99px",
				flex: "none",
			},
			rail: {
				position: "fixed",
				top: "56px",
				right: "0",
				bottom: "0",
				zIndex: 40,
				display: "flex",
				flexDirection: "column",
				borderLeft: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-2)",
				color: "var(--dsw-alias-label-primary)",
				boxShadow: "-8px 0 24px color-mix(in srgb, #000 12%, transparent)",
			},
			head: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "8px",
				padding: "10px 12px 8px",
				borderBottom: "1px solid var(--dsw-alias-border-l2)",
				flex: "none",
			},
			title: { fontSize: "13px", fontWeight: 600, margin: 0 },
			meta: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "11px", lineHeight: "16px" },
			body: {
				overflow: "auto",
				padding: "10px 12px 16px",
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				flex: "1 1 auto",
			},
			h: { margin: "0 0 6px", fontSize: "11px", fontWeight: 600, color: "var(--dsw-alias-label-secondary)", letterSpacing: "0.04em" },
			card: {
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-3)",
				borderRadius: "8px",
				padding: "8px 10px",
				display: "flex",
				flexDirection: "column",
				gap: "2px",
			},
			rowTitle: { fontSize: "12px", fontWeight: 600, lineHeight: "18px" },
			btn: {
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "transparent",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				cursor: "pointer",
				borderRadius: "6px",
				padding: "2px 8px",
				fontSize: "12px",
			},
			handle: {
				position: "absolute",
				left: "-4px",
				top: 0,
				bottom: 0,
				width: "8px",
				cursor: "ew-resize",
			},
			tab: {
				position: "fixed",
				top: "120px",
				right: "0",
				zIndex: 40,
				writingMode: "vertical-rl",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRight: "none",
				borderRadius: "8px 0 0 8px",
				background: "var(--dsw-alias-bg-layer-2)",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				cursor: "pointer",
				padding: "10px 6px",
				fontSize: "12px",
			},
			warn: { margin: 0, color: "var(--dsw-alias-state-error-primary)", fontSize: "12px" },
			ok: { color: "var(--dsw-alias-state-success-primary)" },
		};

		function membersFromList(list, parentId) {
			if (!list || !parentId) return [];
			const byId = list.byId || {};
			const catalog = (list.subagentsByParent && list.subagentsByParent[parentId]) || {};
			const fromCatalog = Array.isArray(catalog.entries)
				? catalog.entries.filter((row) => row && row.kind === "child").map((row) => ({
					id: row.id,
					title: row.label || row.id,
					running: row.activity === "running",
				}))
				: [];
			const fromRows = Object.values(byId)
				.filter((row) => row && row.parentId === parentId)
				.map((row) => ({
					id: row.id,
					title: row.displayTitle || row.title || row.id,
					running: row.running === true,
				}));
			const seen = new Set();
			const out = [];
			for (const row of [...fromCatalog, ...fromRows]) {
				if (seen.has(row.id)) continue;
				seen.add(row.id);
				out.push(row);
			}
			return out;
		}

		function Probe(props) {
			const useSessions = props.useSessions;
			const useSession = props.useSession;
			const list = typeof useSessions === "function" ? useSessions((s) => s) : undefined;
			const live = typeof useSession === "function"
				? useSession((s) => s)
				: props.session;
			const sessionId = props.sessionId || (list && list.current) || (live && live.sessionId);

			react.useEffect(() => {
				const calls = Array.isArray(live && live.runningCalls) ? live.runningCalls : [];
				const pending = Array.isArray(live && live.pending) ? live.pending : [];
				emit({
					session: {
						id: sessionId || null,
						running: !!(live && live.running),
						blank: !live || live.blank === true,
						calls: calls.map((row) => ({
							id: row.callId,
							name: row.name,
							args: clip(row.argsRaw, 80),
							time: row.time,
						})),
						pending: pending.map((row) => row.kind || row.type || "wait"),
						error: (live && live.lastAgentError) || null,
						partial: !!(live && live.partial),
						members: membersFromList(list, sessionId),
					},
				});
			}, [sessionId, live, list]);

			const snap = react.useSyncExternalStore(subscribe, getSnapshot);
			const running = snap.session.running;
			return h("button", {
				type: "button",
				style: css.badge,
				onClick: () => setOpen(!snap.open),
				title: "打开或收起右侧实时面板",
			},
				h("span", {
					style: {
						...css.dot,
						background: running
							? "var(--dsw-alias-state-success-primary)"
							: "var(--dsw-alias-label-tertiary)",
					},
				}),
				running ? "运行中" : "实时",
			);
		}

		function Rail(props) {
			const snap = react.useSyncExternalStore(subscribe, getSnapshot);
			const [width, setWidth] = react.useState(() => {
				try {
					const n = Number(window.localStorage.getItem(STORAGE_WIDTH));
					if (!Number.isNaN(n) && n >= WIDTH_MIN && n <= WIDTH_MAX) return n;
				} catch { /* ignore */ }
				return WIDTH_DEFAULT;
			});
			const [composerH, setComposerH] = react.useState(152);
			const drag = react.useRef(null);
			const useSessions = props.useSessions;
			const list = typeof useSessions === "function" ? useSessions((s) => s) : undefined;
			const current = list && list.current;

			react.useEffect(() => {
				if (!snap.open) return undefined;
				const seat = typeof document !== "undefined" ? document.querySelector("[data-composer-seat]") : null;
				if (!seat) return undefined;
				const update = () => setComposerH(seat.offsetHeight > 0 ? seat.offsetHeight : 152);
				update();
				if (typeof ResizeObserver === "undefined") return undefined;
				const ro = new ResizeObserver(update);
				ro.observe(seat);
				return () => ro.disconnect();
			}, [snap.open]);

			react.useEffect(() => {
				if (!snap.open) return undefined;
				let dead = false;
				const load = () => {
					fetch("/__codeseek/activity", { cache: "no-store" })
						.then((res) => {
							if (!res.ok) throw new Error("HTTP " + res.status);
							return res.json();
						})
						.then((crm) => { if (!dead) emit({ crm, error: null }); })
						.catch((error) => { if (!dead) emit({ error: String(error.message || error) }); });
				};
				load();
				const id = window.setInterval(load, POLL_MS);
				return () => { dead = true; window.clearInterval(id); };
			}, [snap.open]);

			react.useEffect(() => {
				const onMove = (event) => {
					if (!drag.current) return;
					const next = Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, drag.current.startWidth - (event.clientX - drag.current.startX)));
					setWidth(next);
				};
				const onUp = () => {
					if (!drag.current) return;
					drag.current = null;
					try { window.localStorage.setItem(STORAGE_WIDTH, String(width)); } catch { /* ignore */ }
				};
				window.addEventListener("mousemove", onMove);
				window.addEventListener("mouseup", onUp);
				return () => {
					window.removeEventListener("mousemove", onMove);
					window.removeEventListener("mouseup", onUp);
				};
			}, [width]);

			if (!snap.open) {
				return h("button", {
					type: "button",
					style: css.tab,
					onClick: () => setOpen(true),
				}, "实时面板");
			}

			const session = snap.session;
			const crm = snap.crm;
			const calls = session.calls || [];
			const members = session.members || [];
			const leads = (crm && crm.leads) || [];
			const deals = (crm && crm.deals) || [];
			const status = session.running
				? (calls.length ? "正在调用工具" : session.partial ? "正在生成回复" : "运行中")
				: session.blank ? "等待一句话开干" : "空闲";

			return h("aside", {
				style: { ...css.rail, width: width + "px", bottom: (composerH + 12) + "px" },
				"data-codeseek-activity": "open",
			},
				h("div", {
					style: css.handle,
					onMouseDown: (event) => {
						drag.current = { startX: event.clientX, startWidth: width };
						event.preventDefault();
					},
				}),
				h("div", { style: css.head },
					h("div", null,
						h("p", { style: css.title }, "港窑实时"),
						h("p", { style: css.meta }, status + (current ? " · 本会话" : "")),
					),
					h("button", { type: "button", style: css.btn, onClick: () => setOpen(false) }, "收起"),
				),
				h("div", { style: css.body },
					h("section", null,
						h("h3", { style: css.h }, "正在做什么"),
						calls.length
							? calls.map((row) => h("div", { key: row.id, style: css.card },
								h("div", { style: css.rowTitle }, shortTool(row.name)),
								h("p", { style: css.meta }, row.args || "（无参数预览）"),
							))
							: h("div", { style: css.card },
								h("div", { style: css.rowTitle }, status),
								h("p", { style: css.meta }, session.running
									? "模型还没打出工具名。派团员后这里会出现 subagent / MCP。"
									: "发一句「帮我找北欧买家买保温杯」就会动。"),
							),
						session.error ? h("p", { style: css.warn }, clip(session.error, 160)) : null,
					),
					h("section", null,
						h("h3", { style: css.h }, "团员"),
						members.length
							? members.map((row) => h("div", { key: row.id, style: css.card },
								h("div", { style: css.rowTitle }, row.title),
								h("p", { style: { ...css.meta, ...(row.running ? css.ok : {}) } }, row.running ? "运行中" : "已停"),
							))
							: h("p", { style: css.meta }, "还没派营销/报价。管家 kickoff 之后会出现。"),
					),
					h("section", null,
						h("h3", { style: css.h }, "线索"),
						snap.error ? h("p", { style: css.warn }, snap.error) : null,
						leads.length
							? leads.slice(0, 6).map((row) => h("div", { key: row.id, style: css.card },
								h("div", { style: css.rowTitle }, row.company),
								h("p", { style: css.meta }, [row.id, row.market, row.group, row.touch].filter(Boolean).join(" · ")),
								h("p", { style: css.meta }, clip(row.sourceUrl || row.source, 72)),
							))
							: h("p", { style: css.meta }, "CRM 还没有公开网页线索。"),
					),
					h("section", null,
						h("h3", { style: css.h }, "报价 / 商机"),
						h("p", { style: css.meta }, (crm && crm.quoteNote) || "报价来自 catalog.json，不是买家询盘。"),
						deals.length
							? deals.slice(0, 6).map((row) => h("div", { key: row.id, style: css.card },
								h("div", { style: css.rowTitle }, row.buyer),
								h("p", { style: css.meta }, [row.id, row.sku, row.qty ? row.qty + " pcs" : "", row.status].filter(Boolean).join(" · ")),
							))
							: h("p", { style: css.meta }, "还没有商机档案。"),
					),
				),
			);
		}

		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "codeseek-activity-toggle",
				order: 20,
			}, Probe));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "codeseek-activity-rail",
				order: 20,
			}, Rail));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
