import fixture from "./mock-fixture.json";
import type { DashboardData, SmallFlow, FlowStatus, Operation } from "./monitor-types";

const FLOW_DEFINITIONS = [
  { name: "开市流程", total: 150, done: 134, running: 3, error: 10, timeout: 3 },
  { name: "LTS冒烟", total: 120, done: 111, running: 4, error: 3, timeout: 2 },
  { name: "系统重启", total: 130, done: 119, running: 4, error: 4, timeout: 3 },
  { name: "A5清算后流程", total: 140, done: 127, running: 6, error: 5, timeout: 2 },
  { name: "营运流程", total: 160, done: 141, running: 7, error: 8, timeout: 4 },
  { name: "闭市清算流程", total: 150, done: 135, running: 4, error: 6, timeout: 5 },
  { name: "日间定时流程", total: 150, done: 132, running: 10, error: 6, timeout: 2 },
] as const;

const OPERATION_NAMES = [
  "前置检查",
  "查询数据库",
  "参数校验",
  "启动任务",
  "结果校验",
  "生成文件",
  "发送下游",
  "等待回执",
  "状态更新",
  "完成确认",
] as const;

const OPERATION_SOURCES = [
  "调度平台",
  "业务库",
  "规则引擎",
  "作业调度器",
  "校验服务",
  "文件服务",
  "下游系统",
  "外部回执",
  "状态库",
  "任务中心",
] as const;

function buildOperations(
  overall: SmallFlow["overall"],
  stopStep: number | null,
): Operation[] {
  return OPERATION_NAMES.map((name, index) => {
    let status: FlowStatus = "waiting";
    if (overall === "done") status = "done";
    else if (stopStep !== null && index < stopStep) status = "done";
    else if (index === stopStep) status = overall;

    const operation: Operation = {
      index,
      name,
      status,
      duration: {
        done: `${90 + (((index + 1) * 53) % 700)}ms`,
        running: "进行中",
        error: "3.4s",
        timeout: "9.1s",
        waiting: "—",
        ack: "420ms",
      }[status],
      source: OPERATION_SOURCES[index],
    };

    if (status === "error") {
      operation.issue = "数据库连接失败，操作未完成";
      operation.code = "OPS-DB-102";
    } else if (status === "timeout") {
      operation.issue = "等待下游响应超过阈值";
      operation.code = "OPS-TIMEOUT-018";
    }
    return operation;
  });
}

export function createAllFlows(): SmallFlow[] {
  // Exact state and stop-step fixture from the confirmed Python prototype.
  let sequence = 1;
  return FLOW_DEFINITIONS.flatMap((definition, bigIndex) =>
    Array.from({ length: definition.total }, (_, localIndex): SmallFlow => {
      const currentSequence = sequence++;
      const [overall, stopStep] = fixture[currentSequence - 1] as [
        SmallFlow["overall"], number | null,
      ];
      return {
        id: `SF-${String(currentSequence).padStart(5, "0")}`,
        bigIndex,
        bigName: definition.name,
        name: `${definition.name}-${String(localIndex + 1).padStart(3, "0")}`,
        overall,
        startTime: `${String(8 + (currentSequence % 11)).padStart(2, "0")}:${String((currentSequence * 7) % 60).padStart(2, "0")}:${String((currentSequence * 13) % 60).padStart(2, "0")}`,
        operations: buildOperations(overall, stopStep),
      };
    }),
  );
}

export function createDashboardData(): DashboardData {
  const allFlows = createAllFlows();
  const priority: Record<SmallFlow["overall"], number> = {
    error: 0,
    timeout: 1,
    running: 2,
    done: 3,
  };

  const groups = FLOW_DEFINITIONS.map((definition, bigIndex) => {
    const rows = allFlows.filter((flow) => flow.bigIndex === bigIndex);

    rows.sort(
      (left, right) =>
        priority[left.overall] - priority[right.overall] ||
        left.id.localeCompare(right.id),
    );

    return {
      index: bigIndex,
      ...definition,
      all: rows,
      problems: rows
        .filter((flow) => flow.overall === "error" || flow.overall === "timeout"),
    };
  });

  return {
    total: groups.reduce((sum, group) => sum + group.total, 0),
    done: groups.reduce((sum, group) => sum + group.done, 0),
    running: groups.reduce((sum, group) => sum + group.running, 0),
    error: groups.reduce((sum, group) => sum + group.error, 0),
    timeout: groups.reduce((sum, group) => sum + group.timeout, 0),
    groups,
  };
}

