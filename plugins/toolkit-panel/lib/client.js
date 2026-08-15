window.__ModuleLoader__.load({
	id: "codeseek-toolkit-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const react = require("react");
		const h = react.createElement;

		const css = {
			section: {
				width: "100%",
				maxWidth: "760px",
				color: "var(--dsw-alias-label-primary)",
				display: "flex",
				flexDirection: "column",
				gap: "16px",
			},
			status: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
			error: { margin: 0, color: "var(--dsw-alias-state-error-primary)", fontSize: "13px" },
			hint: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: "13px", lineHeight: "20px" },
			heading: { margin: "4px 0 0", fontSize: "13px", fontWeight: 600, lineHeight: "20px" },
			card: {
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-3)",
				borderRadius: "10px",
				padding: "12px 14px",
				display: "flex",
				flexDirection: "column",
				gap: "6px",
			},
			row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
			title: { fontSize: "14px", fontWeight: 600, lineHeight: "20px" },
			desc: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "18px" },
			meta: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "11px", lineHeight: "16px" },
			btn: {
				border: "1px solid var(--dsw-alias-border-l2)",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				cursor: "pointer",
				background: "transparent",
				borderRadius: "6px",
				padding: "4px 10px",
				flex: "none",
			},
			on: {
				background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)",
				color: "var(--dsw-alias-state-success-primary)",
				borderRadius: "5px",
				padding: "1px 6px",
				fontSize: "11px",
			},
			off: {
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-secondary)",
				borderRadius: "5px",
				padding: "1px 6px",
				fontSize: "11px",
			},
			list: { display: "flex", flexDirection: "column", gap: "10px", margin: 0, padding: 0, listStyle: "none" },
		};

		function tag(on) {
			return h("span", { style: on ? css.on : css.off }, on ? "已接入" : "未接入");
		}

		function ToolkitTab() {
			const [state, setState] = react.useState({ status: "loading" });
			const [busy, setBusy] = react.useState(null);
			const [notice, setNotice] = react.useState("");

			const load = react.useCallback(() => {
				setState({ status: "loading" });
				fetch("/__codeseek/toolkit", { cache: "no-store" })
					.then((res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then((data) => setState({ status: "ready", data }))
					.catch((error) => setState({ status: "error", error: String(error.message || error) }));
			}, []);

			react.useEffect(() => { load(); }, [load]);

			async function toggle(id, enabled) {
				setBusy(id);
				setNotice("");
				try {
					const res = await fetch("/__codeseek/toolkit/mcp", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ id, enabled }),
					});
					const data = await res.json();
					if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
					setState({ status: "ready", data });
					setNotice(enabled
						? `${id} 已写入 enabled.json。请重启 Web 后新会话才会出现 mcp__${id}__* 工具。`
						: `${id} 已关闭。请重启 Web。`);
				} catch (error) {
					setNotice(String(error.message || error));
				} finally {
					setBusy(null);
				}
			}

			if (state.status === "loading") return h("p", { style: css.status }, "正在读取工具箱…");
			if (state.status === "error") {
				return h("div", { style: css.section },
					h("p", { style: css.error, role: "alert" }, `无法读取工具箱：${state.error}`),
					h("button", { type: "button", style: css.btn, onClick: load }, "重试"),
				);
			}

			const data = state.data;
			const live = data.liveTools || [];
			const mcpOn = data.mcp.filter((row) => row.enabled);
			const mcpOff = data.mcp.filter((row) => !row.enabled);

			return h("div", { style: css.section },
				h("p", { style: css.hint },
					"官方设置只有「插件配置」和「插件列表」，没有 MCP 接入页。本页列出主机工具、已开/可开的 MCP，以及 GitHub 上能 overlay 的社区插件。开关后要重启 Web。",
				),
				notice ? h("p", { style: css.hint }, notice) : null,
				h("h3", { style: css.heading }, `当前会话可见工具（${live.length}）`),
				h("p", { style: css.meta }, live.length
					? live.map((row) => row.name).join(" · ")
					: "还没有会话时这里是空的。开一个 codeseek 会话后再刷新。"),
				h("h3", { style: css.heading }, `已接入 MCP（${mcpOn.length}）`),
				h("ul", { style: css.list }, mcpOn.map((row) => h("li", { key: row.id, style: css.card },
					h("div", { style: css.row },
						h("div", null,
							h("div", { style: css.title }, row.title),
							h("p", { style: css.desc }, row.description),
							h("p", { style: css.meta }, `${row.toolPrefix}* · ${row.transport}`),
						),
						h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
							tag(true),
							h("button", {
								type: "button",
								style: css.btn,
								disabled: busy === row.id,
								onClick: () => toggle(row.id, false),
							}, busy === row.id ? "…" : "关闭"),
						),
					),
				))),
				h("h3", { style: css.heading }, `可接入但未打开（${mcpOff.length}）`),
				h("ul", { style: css.list }, mcpOff.map((row) => h("li", { key: row.id, style: css.card },
					h("div", { style: css.row },
						h("div", null,
							h("div", { style: css.title }, row.title),
							h("p", { style: css.desc }, row.description),
							h("p", { style: css.meta }, row.needsKey && row.missingKeys.length
								? `缺密钥：${row.missingKeys.join(", ")}。写进 .env 后会自动开，或先强制打开。`
								: `${row.toolPrefix}* · 可一键打开`),
						),
						h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
							tag(false),
							h("button", {
								type: "button",
								style: css.btn,
								disabled: busy === row.id,
								onClick: () => toggle(row.id, true),
							}, busy === row.id ? "…" : (row.needsKey && row.missingKeys.length ? "缺密钥仍打开" : "接入")),
						),
					),
				))),
				h("h3", { style: css.heading }, `主机工具（${(data.hostTools || []).length}）`),
				h("p", { style: css.meta }, (data.hostTools || []).map((row) => row.id).join(" · ")),
				h("h3", { style: css.heading }, `Skills（${(data.skills || []).filter((row) => row.installed).length}/${(data.skills || []).length} 已安装）`),
				h("p", { style: css.meta }, (data.skills || []).filter((row) => row.installed).map((row) => row.id).join(" · ")),
				h("h3", { style: css.heading }, "GitHub 社区 DSH 插件（未自动安装）"),
				h("p", { style: css.hint }, "社区 Cordis 插件要审源码、钉 rc.5。宠物/皮肤/渗透包不会装。本仓库用 MCP overlay，不改 vendor。"),
				h("ul", { style: css.list }, (data.communityPlugins || []).map((row) => h("li", { key: row.id, style: css.card },
					h("div", { style: css.title }, row.title),
					h("p", { style: css.desc }, row.why),
					h("p", { style: css.meta }, `${row.repo} · ${row.install}`),
				))),
			);
		}

		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "codeseek-toolkit",
				order: 5,
				label: "工具与 MCP",
			}, ToolkitTab));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
