"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  DashboardData,
  FlowStatus,
  Operation,
  SmallFlow,
  STATUS_TEXT,
} from "@/lib/monitor-types";

type SelectedOperation = {
  flow: SmallFlow;
  operation: Operation;
};

const LEGEND: Array<{ status: FlowStatus; label: string }> = [
  { status: "done", label: "完成" },
  { status: "running", label: "执行中" },
  { status: "error", label: "异常" },
  { status: "timeout", label: "超时" },
  { status: "waiting", label: "未执行" },
];

export function MonitorDashboard({ data }: { data: DashboardData }) {
  const [problemOnly, setProblemOnly] = useState(false);
  const [selected, setSelected] = useState<SelectedOperation | null>(null);
  const [hint, setHint] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  function changeFilter(nextProblemOnly: boolean) {
    setProblemOnly(nextProblemOnly);
    setSelected(null);
    setSelectedKey(null);
    setHint("");
  }

  function selectOperation(flow: SmallFlow, operation: Operation) {
    setSelected({ flow, operation });
    setSelectedKey(`${flow.id}:${operation.index}`);
    setHint("");
  }

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void> };
    }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "filter_monitor_flows",
        description: "切换已登录监控工作台的全部/异常超时筛选，不修改数据。",
        inputSchema: { type: "object", properties: { problemOnly: { type: "boolean" } }, required: ["problemOnly"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input: unknown) {
          const value = input as { problemOnly?: unknown };
          if (typeof value?.problemOnly !== "boolean") throw new Error("problemOnly must be boolean");
          flushSync(() => changeFilter(value.problemOnly as boolean));
          return { problemOnly: value.problemOnly, groups: data.groups.length };
        },
      },
      {
        name: "select_monitor_operation",
        description: "在当前已显示的普通流程中选择操作块，更新操作详情区；不执行操作。",
        inputSchema: { type: "object", properties: { flowId: { type: "string" }, operationIndex: { type: "integer", minimum: 0, maximum: 9 } }, required: ["flowId", "operationIndex"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input: unknown) {
          const value = input as { flowId?: string; operationIndex?: number };
          const flow = data.groups.flatMap(g => problemOnly ? g.problems : g.all).find(f => f.id === value?.flowId);
          if (!flow || !Number.isInteger(value?.operationIndex) || value.operationIndex! < 0 || value.operationIndex! > 9) throw new Error("Visible flow and operation required");
          const operation = flow.operations[value.operationIndex!];
          flushSync(() => selectOperation(flow, operation));
          return { flowId: flow.id, operationIndex: operation.index, status: operation.status };
        },
      },
    ];
    for (const tool of tools) {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {}
    }
    return () => lifecycle.abort();
  }, [data, problemOnly]);

  return (
    <main className="monitor-page">
      <header className="monitor-top">
        <div>
          <h1 className="monitor-title">券商自动化流程监控</h1>
          <p className="monitor-subtitle">
            演示数据 · 7 个大流程同屏 · 操作级状态监控
          </p>
        </div>
        <div className="top-actions">
          <a className="flow-screen-link" href="?screen=alerts">进入系统告警监控 →</a>
          <div className="metrics" aria-label="流程汇总">
            <Metric label="小流程总数" value={data.total} />
            <Metric label="异常" value={data.error} />
            <Metric label="超时" value={data.timeout} />
            <Metric label="执行中" value={data.running} />
          </div>
        </div>
      </header>

      <section className="toolbar" aria-label="筛选与状态图例">
        <div className="filters">
          <Button
            className="filter-button"
            type="button"
            variant="outline"
            aria-pressed={!problemOnly}
            data-active={!problemOnly}
            onClick={() => changeFilter(false)}
          >
            全部小流程
          </Button>
          <Button
            className="filter-button"
            type="button"
            variant="outline"
            aria-pressed={problemOnly}
            data-active={problemOnly}
            onClick={() => changeFilter(true)}
          >
            只看异常/超时
          </Button>
        </div>
        <div className="legend" aria-label="操作状态">
          {LEGEND.map((item) => (
            <span className="legend-item" key={item.status}>
              <i
                className={`legend-dot status-${item.status}`}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <div className="monitor-layout">
        <div className="big-list">
          {data.groups.map((group) => {
            const flows = problemOnly ? group.problems : group.all;
            const visibleTotal = problemOnly
              ? group.error + group.timeout
              : group.total;
            return (
              <section className="big-card" key={group.name} aria-labelledby={`flow-heading-${group.index}`}>
                <header className="big-head">
                  <div className="big-heading">
                    <h2 className="big-name" id={`flow-heading-${group.index}`}>{group.name}</h2>
                    <span className="status-badge" data-problem={group.error + group.timeout > 0}>
                      {group.error + group.timeout > 0
                        ? `待处理 ${group.error + group.timeout}`
                        : "运行正常"}
                    </span>
                  </div>
                  <p className="big-meta">
                    <span>总数 {group.total}</span>
                    <span>正常 {group.done}</span>
                    <span>执行中 {group.running}</span>
                    <span>异常 {group.error}</span>
                    <span>超时 {group.timeout}</span>
                  </p>
                </header>

                <div className="small-list" key={String(problemOnly)} role="region" aria-label={`${group.name}小流程列表`} tabIndex={0}>
                  {flows.length ? (
                    flows.map((flow) => (
                      <div className="small-row" key={flow.id}>
                        <span className="small-name" title={flow.name}>
                          {flow.name}
                        </span>
                        <div className="operations">
                          {flow.operations.map((operation) => {
                            const operationKey = `${flow.id}:${operation.index}`;
                            return (
                              <button
                                className={`operation-block status-${operation.status}`}
                                type="button"
                                key={operation.index}
                                data-selected={selectedKey === operationKey}
                                title={`${operation.name} · ${STATUS_TEXT[operation.status]}`}
                                aria-label={`${flow.name}，操作 ${String(operation.index + 1).padStart(2, "0")} ${operation.name}，${STATUS_TEXT[operation.status]}`}
                                onClick={() => selectOperation(flow, operation)}
                              >
                                {String(operation.index + 1).padStart(2, "0")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-row">当前筛选下无异常/超时小流程</p>
                  )}
                </div>
                <p className="more-text">
                  已载入 {flows.length} / {visibleTotal} 条 · 异常优先
                </p>
              </section>
            );
          })}
        </div>

        <aside className="detail-panel" aria-labelledby="operation-detail-heading">
          <h2 id="operation-detail-heading">操作详情</h2>
          <div className="detail-content" role="region" aria-label="操作详情内容" aria-live="polite" tabIndex={0}>
          {selected ? (
            <OperationDetail selected={selected} hint={hint} setHint={setHint} />
          ) : (
            <div className="detail-empty">
              选择任意操作块查看详情。
              <br />
              <br />
              页面优先展示异常、超时和执行中的小流程；正常小流程排在后面。
            </div>
          )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      {label}
      <strong>{value}</strong>
    </div>
  );
}

function OperationDetail({
  selected,
  hint,
  setHint,
}: {
  selected: SelectedOperation;
  hint: string;
  setHint: (value: string) => void;
}) {
  const { flow, operation } = selected;
  return (
    <div>
      <div className="detail-grid">
        <span className="detail-key">大流程</span>
        <strong>{flow.bigName}</strong>
        <span className="detail-key">小流程</span>
        <span>{flow.name}</span>
        <span className="detail-key">操作</span>
        <span>
          {String(operation.index + 1).padStart(2, "0")} · {operation.name}
        </span>
        <span className="detail-key">状态</span>
        <span>{STATUS_TEXT[operation.status]}</span>
        <span className="detail-key">开始时间</span>
        <span>{flow.startTime}</span>
        <span className="detail-key">耗时</span>
        <span>{operation.duration}</span>
        <span className="detail-key">数据来源</span>
        <span>{operation.source}</span>
      </div>

      {operation.issue ? (
        <div className="issue-box">
          <strong>异常信息</strong>
          <br />
          {operation.issue}
          <br />
          <span className="issue-code">错误码：{operation.code}</span>
        </div>
      ) : null}

      <div className="detail-actions">
        <Button
          className="detail-action"
          type="button"
          variant="outline"
          onClick={() => setHint("下一步这里接真实日志系统。")}
        >
          查看日志
        </Button>
        <Button
          className="detail-action"
          type="button"
          variant="outline"
          onClick={() => setHint("下一步这里接真实数据库查询结果。")}
        >
          查看数据
        </Button>
        {operation.issue ? (
          <Button
            className="detail-action"
            type="button"
            variant="outline"
            onClick={() =>
              setHint("Demo：已模拟确认异常。正式版再接真实处置接口。")
            }
          >
            确认异常
          </Button>
        ) : null}
      </div>
      <p className="detail-hint">{hint}</p>
    </div>
  );
}

