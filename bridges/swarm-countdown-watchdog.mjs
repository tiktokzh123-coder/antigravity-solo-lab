#!/usr/bin/env node
/**
 * AGY Swarm 工作节点倒计时防搁置看门狗 (Swarm Countdown Watchdog · EVO-034)
 * 职责：
 * - 每 30 秒自动扫描 swarm-registry.json 中所有已注册的具名领域工作会话窗口；
 * - 结合 Antigravity LanguageServer GetAllCascadeTrajectories 与各工作节点 transcript.jsonl 尾部最后 5~8 行（64KB 增量尾读）；
 * - 触发条件 A1 (BG_TASK_STALLED_60S)：最后几步存在 type:"GENERIC", status:"RUNNING" 且超过 60 秒无新步骤推进；
 * - 触发条件 A2 (IDLE_UNREPORTED_75S)：窗口已变为 CASCADE_RUN_STATUS_IDLE 但 swarm-registry.json 中 lastStatus !== "DONE" 且距上次活动已超过 75 秒；
 * - 自动通过 LanguageServer SendUserCascadeMessage 发送倒计时唤醒指令（带 90 秒防抖冷却与单任务最大唤醒次数保护）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  discoverLanguageServerConfig,
  callLanguageServerRpc,
  readSwarmRegistry,
} from '~/.gemini/config/plugins/agy-evo-os/scripts/cross-project-federation.mjs';

const HOME = os.homedir();
const BRAIN_DIR = path.join(HOME, '.gemini/antigravity/brain');
const SELF_SPECIALIST_CID = '42a260a1-395f-43fc-b17b-0fbd560785e2';
const TAIL_READ_BYTES = 64 * 1024;

export const SWARM_WATCHDOG_CONFIG = {
  evoRule: 'EVO-034',
  scanIntervalSeconds: 30,
  bgTaskStallSeconds: 60,
  idleUnreportedSeconds: 75,
  cooldownSeconds: 90,
  maxConsecutiveWakesPerStep: 3,
};

const watchdogMemory = {
  lastScanAt: null,
  totalScansCount: 0,
  totalWakeupsSent: 0,
  perSpecialist: new Map(),
  recentWakeEvents: [],
  latestSnapshot: [],
};

export function inspectSpecialistTranscriptTail(convId) {
  const tPath = path.join(BRAIN_DIR, convId, '.system_generated/logs/transcript.jsonl');
  const result = {
    exists: false,
    mtimeMs: 0,
    lastActivityMs: 0,
    stagnantSeconds: 0,
    lastStepIndex: -1,
    lastStepType: null,
    lastStepStatus: null,
    lastStepTools: [],
    hasRunningBgTask: false,
    runningBgStepIndex: null,
    pendingAskQuestion: false,
    alreadyCalledReportInTail: false,
    recentSteps: [],
  };
  if (!convId || !fs.existsSync(tPath)) return result;

  let fd = null;
  try {
    const st = fs.statSync(tPath);
    result.exists = true;
    result.mtimeMs = st.mtimeMs;
    const readLen = Math.min(st.size, TAIL_READ_BYTES);
    if (readLen <= 0) return result;
    const offset = Math.max(0, st.size - readLen);
    const buf = Buffer.allocUnsafe(readLen);
    fd = fs.openSync(tPath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, readLen, offset);
    const chunkStr = buf.subarray(0, bytesRead).toString('utf8');
    const rawLines = chunkStr.split('\n');
    const validLines = (offset > 0 ? rawLines.slice(1) : rawLines).filter(Boolean);
    const tailLines = validLines.slice(-8);

    const parsedSteps = [];
    for (const line of tailLines) {
      try {
        const s = JSON.parse(line);
        const tools = Array.isArray(s.tool_calls)
          ? s.tool_calls
          : Array.isArray(s?.planner_response?.tool_calls)
            ? s.planner_response.tool_calls
            : [];
        const toolNames = tools.map((tc) => tc?.name || tc?.toolName || '').filter(Boolean);
        const toolArgsPreview = JSON.stringify(tools).slice(0, 400);
        parsedSteps.push({
          stepIndex: s.step_index ?? -1,
          type: s.type || 'UNKNOWN',
          status: s.status || 'UNKNOWN',
          createdAt: s.created_at || null,
          createdMs: Date.parse(s.created_at || '') || 0,
          toolNames,
          calledReportTool:
            toolNames.includes('swarm_report_to_commander') ||
            toolArgsPreview.includes('swarm_report_to_commander'),
          isSystemTaskFinish:
            s.type === 'SYSTEM_MESSAGE' &&
            typeof s.content === 'string' &&
            /finished with result:|was canceled with result:/i.test(s.content),
        });
      } catch {}
    }

    const last5 = parsedSteps.slice(-5);
    result.recentSteps = last5.map((s) => ({
      stepIndex: s.stepIndex,
      type: s.type,
      status: s.status,
      createdAt: s.createdAt,
      tools: s.toolNames,
    }));

    const lastStep = parsedSteps[parsedSteps.length - 1] || null;
    if (lastStep) {
      result.lastStepIndex = lastStep.stepIndex;
      result.lastStepType = lastStep.type;
      result.lastStepStatus = lastStep.status;
      result.lastStepTools = lastStep.toolNames;
    }

    const maxStepMs = parsedSteps.reduce((acc, s) => Math.max(acc, s.createdMs || 0), 0);
    result.lastActivityMs = Math.max(st.mtimeMs, maxStepMs);
    result.stagnantSeconds = Math.max(0, Math.round((Date.now() - result.lastActivityMs) / 1000));

    // Check if any step in last 5 is a GENERIC RUNNING/PENDING step not yet followed by a task finish SYSTEM_MESSAGE
    for (let i = last5.length - 1; i >= 0; i--) {
      const s = last5[i];
      if (s.type === 'GENERIC' && (s.status === 'RUNNING' || s.status === 'PENDING')) {
        const hasFinishAfter = last5.slice(i + 1).some((later) => later.isSystemTaskFinish);
        if (!hasFinishAfter) {
          result.hasRunningBgTask = true;
          result.runningBgStepIndex = s.stepIndex;
          break;
        }
      }
    }

    // Check if the last PLANNER_RESPONSE invoked ask_question with no followup
    for (let i = last5.length - 1; i >= 0; i--) {
      if (last5[i].type === 'PLANNER_RESPONSE') {
        const after = last5.slice(i + 1);
        const hasDoneAfter = after.some(
          (x) => (x.type === 'GENERIC' || x.type === 'USER_INPUT' || x.type === 'SYSTEM_MESSAGE') && x.status === 'DONE'
        );
        if (last5[i].toolNames.includes('ask_question') && !hasDoneAfter) {
          result.pendingAskQuestion = true;
        }
        break;
      }
    }

    result.alreadyCalledReportInTail = last5.some((s) => s.calledReportTool);
  } catch {} finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
  return result;
}

function buildWatchdogWakeupPrompt(sp, reasonLabel, stagnantSeconds) {
  return [
    `⏰ 【EVO-034 倒计时看门狗自动唤醒】系统检测到你的窗口（${sp.specialistTitle || sp.moduleName}）在等待任务/验证期间已停滞 ${stagnantSeconds} 秒（触发原因：${reasonLabel}）！`,
    `请立即执行：`,
    `1) 调用 manage_task(Action: "list" / "status") 实时查看后台验证任务进度；`,
    `2) 若后台任务卡死（如 node --test 或无头浏览器未退出），立即调用 manage_task(Action: "kill") 终止并加上超时保护重跑；`,
    `3) 同时使用 schedule(DurationSeconds: 45, TimerCondition: "any", Prompt: "倒计时自检后台任务") 确保绝不搁置；`,
    `4) 完成后立即调用 swarm_report_to_commander 向总控汇报进度！`,
  ].join('\n');
}

export async function runSwarmWatchdogTick({ dryRun = false, logFn = null } = {}) {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  watchdogMemory.lastScanAt = nowIso;
  watchdogMemory.totalScansCount++;

  const reg = readSwarmRegistry();
  const specialistsMap = reg.specialists || {};
  const reports = Array.isArray(reg.commanderReports) ? reg.commanderReports : [];

  const lsConfig = await discoverLanguageServerConfig().catch(() => null);
  let trajectories = {};
  if (lsConfig) {
    try {
      const res = await callLanguageServerRpc(lsConfig, 'GetAllCascadeTrajectories', {});
      trajectories = res?.trajectorySummaries || {};
    } catch {}
  }

  const snapshot = [];
  const triggeredEvents = [];

  for (const [key, sp] of Object.entries(specialistsMap)) {
    const convId = sp.conversationId;
    if (!convId) continue;

    const trajInfo = trajectories[convId] || {};
    const cascadeStatus = trajInfo.status || 'UNKNOWN';
    const tail = inspectSpecialistTranscriptTail(convId);

    // Check if there is a DONE report in commanderReports newer than or equal to sp.updatedAt
    // [EVO-027 Self-Audit Fix]: Match strictly by fromModuleName (never by shared projectRoot alone!)
    const updatedAtMs = Date.parse(sp.updatedAt || '') || 0;
    const lastReportAtMs = Date.parse(sp.lastReportAt || '') || 0;
    const spModLower = String(sp.moduleName || key).trim().toLowerCase();
    const matchingDoneReport = reports.find(
      (r) =>
        String(r.fromModuleName || '').trim().toLowerCase() === spModLower &&
        r.status === 'DONE' &&
        (Date.parse(r.reportedAt || '') || 0) >= updatedAtMs - 5000
    );

    const effectiveDone =
      (sp.lastStatus === 'DONE' && (!updatedAtMs || lastReportAtMs >= updatedAtMs - 5000)) ||
      Boolean(matchingDoneReport) ||
      (tail.alreadyCalledReportInTail && cascadeStatus === 'CASCADE_RUN_STATUS_IDLE' && !tail.hasRunningBgTask);

    const isTaskPendingReport = !effectiveDone;

    let mem = watchdogMemory.perSpecialist.get(convId);
    if (!mem) {
      mem = {
        lastWakeAtMs: 0,
        lastWakeAtIso: null,
        lastWakeReason: null,
        totalWakes: 0,
        stepWatermark: tail.lastStepIndex,
        consecutiveWakesOnSameStep: 0,
      };
      watchdogMemory.perSpecialist.set(convId, mem);
    }

    if (tail.lastStepIndex !== mem.stepWatermark) {
      mem.stepWatermark = tail.lastStepIndex;
      mem.consecutiveWakesOnSameStep = 0;
    }

    const cooldownElapsedSec = mem.lastWakeAtMs > 0 ? Math.round((nowMs - mem.lastWakeAtMs) / 1000) : 999999;
    const cooldownRemainingSeconds =
      mem.lastWakeAtMs > 0
        ? Math.max(0, SWARM_WATCHDOG_CONFIG.cooldownSeconds - cooldownElapsedSec)
        : 0;

    // Trigger conditions
    const condA1BgTaskStalled =
      tail.hasRunningBgTask && tail.stagnantSeconds >= SWARM_WATCHDOG_CONFIG.bgTaskStallSeconds;
    const condA2IdleUnreported =
      cascadeStatus === 'CASCADE_RUN_STATUS_IDLE' &&
      isTaskPendingReport &&
      !tail.pendingAskQuestion &&
      tail.stagnantSeconds >= SWARM_WATCHDOG_CONFIG.idleUnreportedSeconds;

    let countdownRemainingSeconds = null;
    if (tail.hasRunningBgTask) {
      countdownRemainingSeconds = Math.max(0, SWARM_WATCHDOG_CONFIG.bgTaskStallSeconds - tail.stagnantSeconds);
    } else if (isTaskPendingReport && !tail.pendingAskQuestion) {
      const targetThreshold =
        cascadeStatus === 'CASCADE_RUN_STATUS_IDLE'
          ? SWARM_WATCHDOG_CONFIG.idleUnreportedSeconds
          : SWARM_WATCHDOG_CONFIG.bgTaskStallSeconds;
      countdownRemainingSeconds = Math.max(0, targetThreshold - tail.stagnantSeconds);
    }

    const isSelfRunning = convId === SELF_SPECIALIST_CID && cascadeStatus === 'CASCADE_RUN_STATUS_RUNNING';
    const canWakeNow =
      !dryRun &&
      Boolean(lsConfig) &&
      !isSelfRunning &&
      !tail.pendingAskQuestion &&
      cooldownRemainingSeconds === 0 &&
      mem.consecutiveWakesOnSameStep < SWARM_WATCHDOG_CONFIG.maxConsecutiveWakesPerStep &&
      (condA1BgTaskStalled || condA2IdleUnreported);

    let wokeThisTick = false;
    let wakeError = null;

    if (canWakeNow) {
      const reason = condA1BgTaskStalled
        ? `BG_TASK_STALLED_${tail.stagnantSeconds}S (后台任务 step #${tail.runningBgStepIndex} 挂起超 ${SWARM_WATCHDOG_CONFIG.bgTaskStallSeconds}s)`
        : `IDLE_UNREPORTED_${tail.stagnantSeconds}S (窗口已 IDLE 但未完成任务回执汇报超 ${SWARM_WATCHDOG_CONFIG.idleUnreportedSeconds}s)`;
      const prompt = buildWatchdogWakeupPrompt(sp, reason, tail.stagnantSeconds);

      const validSenderUuid =
        sp.commanderId && /^[0-9a-f-]{36}$/i.test(sp.commanderId)
          ? sp.commanderId
          : '00000000-0000-4000-8000-000000000000';

      try {
        await callLanguageServerRpc(lsConfig, 'LoadTrajectory', { cascadeId: convId }).catch(() => {});
        if (cascadeStatus === 'CASCADE_RUN_STATUS_IDLE') {
          await callLanguageServerRpc(lsConfig, 'SendUserCascadeMessage', {
            cascadeId: convId,
            items: [{ text: prompt }],
            cascadeConfig: { plannerConfig: { requestedModel: { model: 'MODEL_PLACEHOLDER_M417' } } },
          });
        } else {
          await callLanguageServerRpc(lsConfig, 'SendAgentMessage', {
            recipient: convId,
            senderId: validSenderUuid,
            displayTitle: `⏰ EVO-034 倒计时防搁置唤醒 (${sp.moduleName})`,
            content: prompt,
          });
        }
        wokeThisTick = true;
      } catch (err) {
        try {
          await callLanguageServerRpc(lsConfig, 'SendUserCascadeMessage', {
            cascadeId: convId,
            items: [{ text: prompt }],
            cascadeConfig: { plannerConfig: { requestedModel: { model: 'MODEL_PLACEHOLDER_M417' } } },
          });
          wokeThisTick = true;
        } catch (err2) {
          wakeError = err2.message || err.message;
        }
      }

      if (wokeThisTick) {
        mem.lastWakeAtMs = nowMs;
        mem.lastWakeAtIso = nowIso;
        mem.lastWakeReason = reason;
        mem.totalWakes++;
        mem.consecutiveWakesOnSameStep++;
        watchdogMemory.totalWakeupsSent++;

        const evt = {
          wakeAt: nowIso,
          moduleName: sp.moduleName || key,
          specialistTitle: sp.specialistTitle || key,
          conversationId: convId,
          reason,
          stagnantSeconds: tail.stagnantSeconds,
          lastStepIndex: tail.lastStepIndex,
          consecutiveWakesOnSameStep: mem.consecutiveWakesOnSameStep,
        };
        watchdogMemory.recentWakeEvents = [evt, ...watchdogMemory.recentWakeEvents].slice(0, 30);
        triggeredEvents.push(evt);
        if (typeof logFn === 'function') {
          logFn('INFO', '⏰ [EVO-034 看门狗] 已自动唤醒搁置工作会话窗口', evt);
        }
      }
    }

    snapshot.push({
      moduleName: sp.moduleName || key,
      specialistTitle: sp.specialistTitle || key,
      conversationId: convId,
      projectRoot: sp.projectRoot || '',
      cascadeStatus,
      registryLastStatus: sp.lastStatus || 'PENDING',
      effectiveDone,
      isTaskPendingReport,
      hasRunningBgTask: tail.hasRunningBgTask,
      runningBgStepIndex: tail.runningBgStepIndex,
      pendingAskQuestion: tail.pendingAskQuestion,
      stagnantSeconds: tail.stagnantSeconds,
      countdownRemainingSeconds,
      cooldownRemainingSeconds,
      wokeThisTick,
      wakeError,
      wakeStats: {
        totalWakes: mem.totalWakes,
        consecutiveWakesOnSameStep: mem.consecutiveWakesOnSameStep,
        lastWakeAt: mem.lastWakeAtIso,
        lastWakeReason: mem.lastWakeReason,
      },
      lastStep: {
        stepIndex: tail.lastStepIndex,
        type: tail.lastStepType,
        status: tail.lastStepStatus,
        tools: tail.lastStepTools,
      },
      lastTaskTitle: sp.lastTaskTitle || '',
      updatedAt: sp.updatedAt || null,
    });
  }

  watchdogMemory.latestSnapshot = snapshot;
  return {
    ok: true,
    evoRule: SWARM_WATCHDOG_CONFIG.evoRule,
    config: SWARM_WATCHDOG_CONFIG,
    lastScanAt: watchdogMemory.lastScanAt,
    totalScansCount: watchdogMemory.totalScansCount,
    totalWakeupsSent: watchdogMemory.totalWakeupsSent,
    monitoredSpecialistsCount: snapshot.length,
    pendingSpecialistsCount: snapshot.filter((s) => s.isTaskPendingReport).length,
    runningBgTasksCount: snapshot.filter((s) => s.hasRunningBgTask).length,
    triggeredThisTick: triggeredEvents,
    specialists: snapshot,
    recentWakeEvents: watchdogMemory.recentWakeEvents,
  };
}

export async function getSwarmWatchdogStatus({ refreshIfOlderThanMs = 2000, logFn = null } = {}) {
  const lastScanMs = Date.parse(watchdogMemory.lastScanAt || '') || 0;
  if (!watchdogMemory.latestSnapshot.length || Date.now() - lastScanMs > refreshIfOlderThanMs) {
    return runSwarmWatchdogTick({ dryRun: false, logFn });
  }
  return {
    ok: true,
    evoRule: SWARM_WATCHDOG_CONFIG.evoRule,
    config: SWARM_WATCHDOG_CONFIG,
    lastScanAt: watchdogMemory.lastScanAt,
    totalScansCount: watchdogMemory.totalScansCount,
    totalWakeupsSent: watchdogMemory.totalWakeupsSent,
    monitoredSpecialistsCount: watchdogMemory.latestSnapshot.length,
    pendingSpecialistsCount: watchdogMemory.latestSnapshot.filter((s) => s.isTaskPendingReport).length,
    runningBgTasksCount: watchdogMemory.latestSnapshot.filter((s) => s.hasRunningBgTask).length,
    specialists: watchdogMemory.latestSnapshot,
    recentWakeEvents: watchdogMemory.recentWakeEvents,
  };
}
