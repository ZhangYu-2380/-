"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { isAlarmSoundEnabled, playAlarmSound, setAlarmSoundEnabled, stopAlarmSound } from "@/lib/alarm-audio";

type Level = "紧急" | "严重" | "警告" | "提示";

type Alert = {
  id: string;
  level: Level;
  ip: string;
  device: string;
  system: string;
  source: string;
  time: string;
  content: string;
  status: "未确认" | "处理中" | "已恢复";
};

const alerts: Alert[] = [
  { id: "ALT-240916-001", level: "紧急", ip: "10.21.8.17", device: "生产数据库-01", system: "资金清算", source: "Zabbix", time: "2026-09-16 13:28:41", content: "主库连接数达到 96%，存在业务阻塞风险", status: "未确认" },
  { id: "ALT-240916-002", level: "严重", ip: "10.21.5.32", device: "应用节点-A03", system: "交易中台", source: "应用日志", time: "2026-09-16 13:25:18", content: "订单路由服务连续 5 分钟错误率超过阈值", status: "处理中" },
  { id: "ALT-240916-003", level: "严重", ip: "10.21.9.46", device: "文件服务器-02", system: "批处理平台", source: "Prometheus", time: "2026-09-16 13:22:06", content: "磁盘可用空间低于 10%", status: "未确认" },
  { id: "ALT-240916-004", level: "警告", ip: "10.21.6.11", device: "消息队列-01", system: "消息总线", source: "Kafka", time: "2026-09-16 13:18:52", content: "消费延迟超过 120 秒", status: "处理中" },
  { id: "ALT-240916-005", level: "警告", ip: "10.21.3.84", device: "网关节点-G02", system: "统一接入", source: "网络监控", time: "2026-09-16 13:16:39", content: "上游链路丢包率 2.4%", status: "未确认" },
  { id: "ALT-240916-006", level: "提示", ip: "10.21.7.19", device: "报表服务-01", system: "运营报表", source: "系统日志", time: "2026-09-16 13:12:15", content: "定时报表任务执行耗时较日均值上升 30%", status: "已恢复" },
  { id: "ALT-240916-007", level: "警告", ip: "10.21.5.28", device: "应用节点-A01", system: "交易中台", source: "APM", time: "2026-09-16 13:07:44", content: "接口 P95 响应时间超过 800ms", status: "已恢复" },
  { id: "ALT-240916-008", level: "提示", ip: "10.21.10.8", device: "备份服务器-01", system: "运维平台", source: "备份任务", time: "2026-09-16 12:56:20", content: "增量备份任务已延后启动", status: "已恢复" },
];

const levelClass: Record<Level, string> = { 紧急: "critical", 严重: "high", 警告: "warning", 提示: "info" };

export function AlertDashboard() {
  const [level, setLevel] = useState<Level | "全部">("全部");
  const [selectedId, setSelectedId] = useState(alerts[0].id);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const previousAlarmCountRef = useRef<number | null>(null);
  const visibleAlerts = useMemo(() => level === "全部" ? alerts : alerts.filter((alert) => alert.level === level), [level]);
  const selected = alerts.find((alert) => alert.id === selectedId) ?? visibleAlerts[0];
  const active = alerts.filter((alert) => alert.status !== "已恢复").length;
  const alarmCount = alerts.filter((alert) => (alert.level === "紧急" || alert.level === "严重") && alert.status !== "已恢复").length;

  useEffect(() => setSoundEnabled(isAlarmSoundEnabled()), []);
  useEffect(() => {
    if (previousAlarmCountRef.current !== null && alarmCount > previousAlarmCountRef.current && soundEnabled) void playAlarmSound();
    previousAlarmCountRef.current = alarmCount;
  }, [alarmCount, soundEnabled]);

  const toggleSound = async () => {
    if (soundEnabled) {
      setAlarmSoundEnabled(false);
      setSoundEnabled(false);
      await stopAlarmSound();
      return;
    }
    setAlarmSoundEnabled(true);
    setSoundEnabled(true);
    await playAlarmSound();
  };

  return (
    <main className="alert-page">
      <header className="alert-top">
        <div>
          <p className="screen-kicker">运维监控中心 · 演示数据</p>
          <h1>系统告警监控</h1>
          <p className="screen-subtitle">设备与系统运行告警的集中查看、分级处置与追踪</p>
        </div>
        <div className="alert-summary" aria-label="告警汇总">
          <span><b>{active}</b> 条待处置</span>
          <span><b>{alerts.filter((alert) => alert.level === "紧急").length}</b> 条紧急</span>
          <span>最后更新 2026-09-16 13:28:41</span>
        </div>
      </header>

      <section className="alert-toolbar" aria-label="告警筛选">
        <div className="alert-filter-group">
          {(["全部", "紧急", "严重", "警告", "提示"] as const).map((item) => (
            <button key={item} className={level === item ? "active" : ""} onClick={() => setLevel(item)}>
              {item === "全部" ? "全部告警" : item}
            </button>
          ))}
        </div>
        <div className="alert-toolbar-actions">
          <button className={`sound-button ${soundEnabled ? "enabled" : ""}`} type="button" aria-pressed={soundEnabled} onClick={toggleSound}>
            {soundEnabled ? "🔊 关闭告警声音" : "🔇 开启告警声音"}
          </button>
          <button className="sound-button test" type="button" onClick={playAlarmSound}>测试警报音</button>
          <a className="flow-screen-link" href="?screen=flow">进入流程监控大屏 →</a>
        </div>
      </section>

      <section className="alert-workspace">
        <div className="alert-table-panel">
          <div className="alert-table-title"><strong>实时告警列表</strong><span>共 {visibleAlerts.length} 条</span></div>
          <div className="alert-table-scroll">
            <table>
              <thead><tr><th>级别</th><th>设备 / IP</th><th>系统</th><th>来源</th><th>发生时间</th><th>告警内容</th><th>状态</th></tr></thead>
              <tbody>
                {visibleAlerts.map((alert) => <tr key={alert.id} className={selected?.id === alert.id ? "selected" : ""} onClick={() => setSelectedId(alert.id)}>
                  <td><span className={`level-tag ${levelClass[alert.level]}`}>{alert.level}</span></td>
                  <td><strong>{alert.device}</strong><small>{alert.ip}</small></td>
                  <td>{alert.system}</td><td>{alert.source}</td><td className="time-cell">{alert.time}</td><td className="content-cell">{alert.content}</td><td><span className={`status-label ${alert.status === "未确认" ? "open" : alert.status === "处理中" ? "handling" : "resolved"}`}>{alert.status}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        {selected && <aside className="alert-detail" aria-label="告警详情">
          <p className="detail-eyebrow">当前选中告警</p>
          <div className="detail-heading"><span className={`level-tag ${levelClass[selected.level]}`}>{selected.level}</span><strong>{selected.status}</strong></div>
          <h2>{selected.content}</h2>
          <dl>
            <div><dt>告警编号</dt><dd>{selected.id}</dd></div>
            <div><dt>设备 IP</dt><dd>{selected.ip}</dd></div>
            <div><dt>设备名称</dt><dd>{selected.device}</dd></div>
            <div><dt>所属系统</dt><dd>{selected.system}</dd></div>
            <div><dt>告警来源</dt><dd>{selected.source}</dd></div>
            <div><dt>发生时间</dt><dd>{selected.time}</dd></div>
          </dl>
          <div className="detail-note"><strong>处置建议</strong><p>核对对应设备与服务日志，确认影响范围后按预案处理。后续可接入真实告警平台数据。</p></div>
        </aside>}
      </section>
    </main>
  );
}

