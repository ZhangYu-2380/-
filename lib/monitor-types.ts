export type FlowStatus =
  | "done"
  | "running"
  | "error"
  | "timeout"
  | "waiting"
  | "ack";

export type Operation = {
  index: number;
  name: string;
  status: FlowStatus;
  duration: string;
  source: string;
  issue?: string;
  code?: string;
};

export type SmallFlow = {
  id: string;
  bigIndex: number;
  bigName: string;
  name: string;
  overall: Exclude<FlowStatus, "waiting" | "ack">;
  startTime: string;
  operations: Operation[];
};

export type BigFlowGroup = {
  index: number;
  name: string;
  total: number;
  done: number;
  running: number;
  error: number;
  timeout: number;
  all: SmallFlow[];
  problems: SmallFlow[];
};

export type DashboardData = {
  total: number;
  done: number;
  running: number;
  error: number;
  timeout: number;
  groups: BigFlowGroup[];
};

export const STATUS_TEXT: Record<FlowStatus, string> = {
  done: "执行完成",
  running: "执行中",
  error: "操作异常",
  timeout: "操作超时",
  waiting: "未执行",
  ack: "异常已确认",
};
