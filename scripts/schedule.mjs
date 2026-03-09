#!/usr/bin/env node

/**
 * ⚡ SharkFlow - Task Scheduler
 * 定时任务调度 - cron 表达式支持
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEDULE_FILE = join(__dirname, '..', 'data', 'schedule.json');

/**
 * 加载调度数据
 */
async function loadSchedule() {
  try {
    if (!existsSync(SCHEDULE_FILE)) {
      return { tasks: [], nextId: 1 };
    }
    const data = await readFile(SCHEDULE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 加载调度数据失败:', error.message);
    return { tasks: [], nextId: 1 };
  }
}

/**
 * 保存调度数据
 */
async function saveSchedule(data) {
  try {
    const dir = dirname(SCHEDULE_FILE);
    if (!existsSync(dir)) {
      await writeFile(dir, '', 'utf-8');
    }
    await writeFile(SCHEDULE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('❌ 保存调度数据失败:', error.message);
    return false;
  }
}

/**
 * 解析 cron 表达式 (简化版)
 * 支持：每分钟、每 5 分钟、每小时等 cron 表达式
 */
function parseCron(cronExpr) {
  const parts = cronExpr.split(' ');
  if (parts.length !== 5) {
    return null;
  }

  const [minute, hour, day, month, weekday] = parts;

  return {
    minute: parseCronField(minute, 0, 59),
    hour: parseCronField(hour, 0, 23),
    day: parseCronField(day, 1, 31),
    month: parseCronField(month, 1, 12),
    weekday: parseCronField(weekday, 0, 6)
  };
}

/**
 * 解析单个 cron 字段
 */
function parseCronField(field, min, max) {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2));
    return Array.from({ length: Math.ceil((max - min + 1) / step) }, (_, i) => min + i * step);
  }

  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  if (field.includes(',')) {
    return field.split(',').map(Number);
  }

  return [parseInt(field)];
}

/**
 * 添加定时任务
 */
async function addJob(options) {
  const { name, cron, action, token, amount, platform, chain = 'ethereum', enabled = true } = options;

  if (!name || !cron || !action) {
    console.error('❌ 错误：缺少必要参数');
    console.log('\n💡 用法：node scripts/schedule.mjs add --name "DCA" --cron "0 12 * * *" --action deposit --token ETH --amount 100');
    return;
  }

  // 验证 cron 表达式
  const parsed = parseCron(cron);
  if (!parsed) {
    console.error('❌ 错误的 cron 表达式:', cron);
    console.log('\n💡 示例:');
    console.log('   * * * * *      每分钟');
    console.log('   */5 * * * *    每 5 分钟');
    console.log('   0 * * * *      每小时');
    console.log('   0 12 * * *     每天中午 12 点');
    console.log('   0 0 * * 1      每周一午夜');
    return;
  }

  const schedule = await loadSchedule();

  const job = {
    id: schedule.nextId++,
    name,
    cron,
    action,
    token: token || 'ETH',
    amount: parseFloat(amount) || 0,
    platform: platform || 'unknown',
    chain,
    enabled,
    createdAt: new Date().toISOString(),
    lastRun: null,
    nextRun: getNextRun(parsed),
    runCount: 0,
    status: 'idle'
  };

  schedule.tasks.push(job);

  if (await saveSchedule(schedule)) {
    console.log('✅ 定时任务已添加\n');
    printJob(job);
  }
}

/**
 * 计算下次运行时间 (简化)
 */
function getNextRun(parsed) {
  const now = new Date();
  const next = new Date(now);
  
  // 简单计算：下一分钟
  next.setMinutes(next.getMinutes() + 1);
  next.setSeconds(0, 0);
  
  return next.toISOString();
}

/**
 * 查看调度任务
 */
async function listJobs(options = {}) {
  const schedule = await loadSchedule();

  if (schedule.tasks.length === 0) {
    console.log('📋 没有定时任务，添加你的第一个任务吧！\n');
    console.log('💡 示例：node scripts/schedule.mjs add --name "DCA" --cron "0 12 * * *" --action deposit --token ETH --amount 100');
    return;
  }

  let jobs = schedule.tasks;

  if (options.enabled !== undefined) {
    const filter = options.enabled === 'true' || options.enabled === true;
    jobs = jobs.filter(j => j.enabled === filter);
  }

  if (options.status) {
    jobs = jobs.filter(j => j.status === options.status);
  }

  console.log('⚡ SharkFlow - 定时任务调度\n');
  console.log('─'.repeat(110));
  console.log(
    'ID'.padEnd(4) +
    '名称'.padEnd(15) +
    'Cron'.padEnd(18) +
    '操作'.padEnd(12) +
    '代币'.padEnd(8) +
    '数量'.padEnd(12) +
    '状态'.padEnd(10) +
    '下次运行'
  );
  console.log('─'.repeat(110));

  jobs.forEach(job => {
    const status = job.enabled ? '🟢 启用' : '🔴 禁用';
    const nextRun = formatNextRun(job.nextRun);
    console.log(
      `${job.id.toString().padEnd(4)} ` +
      `${job.name.padEnd(15)} ` +
      `${job.cron.padEnd(18)} ` +
      `${job.action.padEnd(12)} ` +
      `${job.token.padEnd(8)} ` +
      `$${job.amount.toString().padEnd(10)} ` +
      `${status.padEnd(10)} ` +
      `${nextRun}`
    );
  });

  console.log('─'.repeat(110));
  console.log(`\n总计：${jobs.length} 个任务\n`);

  console.log('💡 管理命令:');
  console.log('   启用：node scripts/schedule.mjs enable <ID>');
  console.log('   禁用：node scripts/schedule.mjs disable <ID>');
  console.log('   删除：node scripts/schedule.mjs remove <ID>');
  console.log('   运行：node scripts/schedule.mjs run <ID>');
  console.log('');
}

/**
 * 启用任务
 */
async function enableJob(jobId) {
  if (!jobId) {
    console.error('❌ 请指定任务 ID');
    return;
  }

  const schedule = await loadSchedule();
  const job = schedule.tasks.find(t => t.id === parseInt(jobId));

  if (!job) {
    console.error(`❌ 未找到任务 ID: ${jobId}`);
    return;
  }

  job.enabled = true;
  job.status = 'idle';

  if (await saveSchedule(schedule)) {
    console.log(`✅ 任务 "${job.name}" 已启用\n`);
    printJob(job);
  }
}

/**
 * 禁用任务
 */
async function disableJob(jobId) {
  if (!jobId) {
    console.error('❌ 请指定任务 ID');
    return;
  }

  const schedule = await loadSchedule();
  const job = schedule.tasks.find(t => t.id === parseInt(jobId));

  if (!job) {
    console.error(`❌ 未找到任务 ID: ${jobId}`);
    return;
  }

  job.enabled = false;
  job.status = 'paused';

  if (await saveSchedule(schedule)) {
    console.log(`✅ 任务 "${job.name}" 已禁用\n`);
    printJob(job);
  }
}

/**
 * 删除任务
 */
async function removeJob(jobId) {
  if (!jobId) {
    console.error('❌ 请指定任务 ID');
    return;
  }

  const schedule = await loadSchedule();
  const jobIndex = schedule.tasks.findIndex(t => t.id === parseInt(jobId));

  if (jobIndex === -1) {
    console.error(`❌ 未找到任务 ID: ${jobId}`);
    return;
  }

  const removed = schedule.tasks.splice(jobIndex, 1)[0];

  if (await saveSchedule(schedule)) {
    console.log(`✅ 任务 "${removed.name}" 已删除\n`);
  }
}

/**
 * 手动运行任务
 */
async function runJob(jobId) {
  if (!jobId) {
    console.error('❌ 请指定任务 ID');
    return;
  }

  const schedule = await loadSchedule();
  const job = schedule.tasks.find(t => t.id === parseInt(jobId));

  if (!job) {
    console.error(`❌ 未找到任务 ID: ${jobId}`);
    return;
  }

  console.log(`⚡ 手动运行任务 "${job.name}"\n`);
  console.log('─'.repeat(60));

  job.status = 'running';
  await saveSchedule(schedule);

  // 模拟执行
  console.log(`📝 执行：${job.action} ${job.amount} ${job.token}`);
  console.log(`📝 平台：${job.platform}`);
  console.log(`📝 链：  ${job.chain}`);
  console.log('');

  setTimeout(async () => {
    job.lastRun = new Date().toISOString();
    job.runCount++;
    job.status = 'idle';
    job.nextRun = getNextRun(parseCron(job.cron));
    await saveSchedule(schedule);

    console.log('✅ 任务执行完成\n');
    console.log(`运行次数：${job.runCount}`);
    console.log(`下次运行：${formatNextRun(job.nextRun)}\n`);
  }, 2000);
}

/**
 * 格式化下次运行时间
 */
function formatNextRun(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = date - now;
  
  if (diff < 0) return '已过期';
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天后`;
  if (hours > 0) return `${hours}小时后`;
  if (minutes > 0) return `${minutes}分钟后`;
  return '即将运行';
}

/**
 * 打印任务详情
 */
function printJob(job) {
  console.log(`ID:       ${job.id}`);
  console.log(`名称：     ${job.name}`);
  console.log(`Cron:     ${job.cron}`);
  console.log(`操作：     ${job.action}`);
  console.log(`代币：     ${job.token}`);
  console.log(`数量：     $${job.amount}`);
  console.log(`平台：     ${job.platform}`);
  console.log(`链：       ${job.chain}`);
  console.log(`状态：     ${job.enabled ? '启用' : '禁用'}`);
  console.log(`创建时间：  ${job.createdAt}`);
  console.log(`下次运行：  ${job.nextRun}`);
  if (job.lastRun) {
    console.log(`上次运行：  ${job.lastRun}`);
    console.log(`运行次数：  ${job.runCount}`);
  }
  console.log('');
}

/**
 * 解析命令行参数
 */
function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      i++;
    }
  }
  return options;
}

/**
 * 显示帮助
 */
function showHelp() {
  console.log(`
⚡ SharkFlow - 定时任务调度

用法:
  node scripts/schedule.mjs <command> [选项]

命令:
  add      添加定时任务
  list     查看调度任务
  enable   启用任务
  disable  禁用任务
  remove   删除任务
  run      手动运行任务
  help     显示帮助

Cron 表达式格式:
  ┌────── 分钟 (0-59)
  │ ┌──── 小时 (0-23)
  │ │ ┌── 日期 (1-31)
  │ │ │ ┌─ 月份 (1-12)
  │ │ │ │ ┌── 星期 (0-6, 0=周日)
  │ │ │ │ │
  * * * * *

Cron 示例:
  * * * * *      每分钟执行
  */5 * * * *    每 5 分钟执行
  0 * * * *      每小时整点
  0 12 * * *     每天中午 12 点
  0 0 * * *      每天午夜
  0 0 * * 1      每周一午夜
  0 9 * * 1-5    工作日上午 9 点

添加任务示例:
  node scripts/schedule.mjs add --name "DCA" --cron "0 12 * * *" --action deposit --token ETH --amount 100 --platform lido
  node scripts/schedule.mjs add --name "Harvest" --cron "0 0 * * *" --action claim --amount 0 --platform aave

管理示例:
  node scripts/schedule.mjs list
  node scripts/schedule.mjs enable 1
  node scripts/schedule.mjs disable 1
  node scripts/schedule.mjs run 1
  node scripts/schedule.mjs remove 1
`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = parseArgs(args.slice(1));

  switch (command) {
    case 'add':
      await addJob(options);
      break;
    case 'list':
      await listJobs(options);
      break;
    case 'enable':
      await enableJob(args[1] || options.id);
      break;
    case 'disable':
      await disableJob(args[1] || options.id);
      break;
    case 'remove':
      await removeJob(args[1] || options.id);
      break;
    case 'run':
      await runJob(args[1] || options.id);
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      if (command) {
        console.error(`❌ 未知命令：${command}`);
      }
      showHelp();
  }
}

main().catch(console.error);
