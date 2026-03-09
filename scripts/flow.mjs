#!/usr/bin/env node

/**
 * ⚡ SharkFlow - Task Queue Manager
 * 任务队列管理 - 添加/查看/删除/执行任务
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = join(__dirname, '..', 'data', 'queue.json');

/**
 * 任务队列数据结构
 * {
 *   tasks: [
 *     {
 *       id: 1,
 *       action: 'deposit|withdraw|swap|stake|claim|bridge',
 *       token: 'USDT|ETH|...',
 *       amount: 1000,
 *       platform: 'aave|compound|uniswap|...',
 *       chain: 'ethereum|optimism|arbitrum|...',
 *       status: 'pending|completed|failed',
 *       createdAt: '2026-03-08T21:50:00Z',
 *       executedAt: null,
 *       txHash: null
 *     }
 *   ],
 *   nextId: 1
 * }
 */

/**
 * 加载队列
 */
async function loadQueue() {
  try {
    if (!existsSync(QUEUE_FILE)) {
      return { tasks: [], nextId: 1 };
    }
    const data = await readFile(QUEUE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 加载队列失败:', error.message);
    return { tasks: [], nextId: 1 };
  }
}

/**
 * 保存队列
 */
async function saveQueue(queue) {
  try {
    const dir = dirname(QUEUE_FILE);
    if (!existsSync(dir)) {
      await writeFile(dir, '', 'utf-8');
    }
    await writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('❌ 保存队列失败:', error.message);
    return false;
  }
}

/**
 * 添加任务
 */
async function addTask(options) {
  const { action, token, amount, platform, chain = 'ethereum' } = options;
  
  if (!action || !amount) {
    console.error('❌ 错误：缺少必要参数');
    console.log('用法: node scripts/flow.mjs add --action deposit --token USDT --amount 1000 --platform aave');
    return;
  }

  const queue = await loadQueue();
  
  const task = {
    id: queue.nextId++,
    action,
    token: token || 'ETH',
    amount: parseFloat(amount),
    platform: platform || 'unknown',
    chain,
    status: 'pending',
    createdAt: new Date().toISOString(),
    executedAt: null,
    txHash: null,
    notes: options.notes || ''
  };

  queue.tasks.push(task);
  
  if (await saveQueue(queue)) {
    console.log('✅ 任务已添加\n');
    printTask(task);
  }
}

/**
 * 查看队列
 */
async function listQueue(options = {}) {
  const queue = await loadQueue();
  const { status, chain } = options;

  if (queue.tasks.length === 0) {
    console.log('📋 队列空无一物，添加你的第一个任务吧！\n');
    console.log('💡 示例: node scripts/flow.mjs add --action deposit --token USDT --amount 1000 --platform aave');
    return;
  }

  let tasks = queue.tasks;
  
  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }
  
  if (chain) {
    tasks = tasks.filter(t => t.chain === chain);
  }

  if (tasks.length === 0) {
    console.log(`📋 没有找到符合条件的任务\n`);
    return;
  }

  console.log('⚡ SharkFlow - 任务队列\n');
  console.log(`ID  操作        代币    数量        平台          链          状态`);
  console.log('─'.repeat(90));

  tasks.forEach(task => {
    const statusIcon = getStatusIcon(task.status);
    console.log(
      `${task.id.toString().padEnd(4)} ` +
      `${task.action.padEnd(12)} ` +
      `${task.token.padEnd(8)} ` +
      `$${task.amount.toString().padEnd(10)} ` +
      `${task.platform.padEnd(14)} ` +
      `${task.chain.padEnd(12)} ` +
      `${statusIcon} ${task.status}`
    );
  });

  console.log('\n' + '─'.repeat(90));
  console.log(`总计：${tasks.length} 个任务 (待执行：${queue.tasks.filter(t => t.status === 'pending').length})`);
  console.log('\n💡 执行任务：node scripts/flow.mjs execute --id <ID>');
  console.log('💡 删除任务：node scripts/flow.mjs remove <ID>');
}

/**
 * 删除任务
 */
async function removeTask(taskId) {
  if (!taskId) {
    console.error('❌ 错误：请指定任务 ID');
    return;
  }

  const queue = await loadQueue();
  const taskIndex = queue.tasks.findIndex(t => t.id === parseInt(taskId));

  if (taskIndex === -1) {
    console.error(`❌ 未找到任务 ID: ${taskId}`);
    return;
  }

  const removed = queue.tasks.splice(taskIndex, 1)[0];
  
  if (await saveQueue(queue)) {
    console.log('✅ 任务已删除\n');
    printTask(removed);
  }
}

/**
 * 清空队列
 */
async function clearQueue() {
  const queue = await loadQueue();
  
  if (queue.tasks.length === 0) {
    console.log('📋 队列已经是空的\n');
    return;
  }

  const count = queue.tasks.length;
  queue.tasks = [];
  
  if (await saveQueue(queue)) {
    console.log(`✅ 已清空 ${count} 个任务\n`);
  }
}

/**
 * 获取状态图标
 */
function getStatusIcon(status) {
  switch (status) {
    case 'pending': return '⏳';
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'executing': return '⚡';
    default: return '❓';
  }
}

/**
 * 打印单个任务详情
 */
function printTask(task) {
  console.log(`任务 ID:    ${task.id}`);
  console.log(`操作:      ${task.action}`);
  console.log(`代币:      ${task.token}`);
  console.log(`数量:      $${task.amount}`);
  console.log(`平台:      ${task.platform}`);
  console.log(`链:        ${task.chain}`);
  console.log(`状态:      ${task.status}`);
  console.log(`创建时间：  ${task.createdAt}`);
  if (task.executedAt) {
    console.log(`执行时间：  ${task.executedAt}`);
  }
  if (task.txHash) {
    console.log(`交易哈希：  ${task.txHash}`);
  }
  if (task.notes) {
    console.log(`备注：      ${task.notes}`);
  }
  console.log('');
}

/**
 * 显示帮助
 */
function showHelp() {
  console.log(`
⚡ SharkFlow - 任务队列管理

用法:
  node scripts/flow.mjs <command> [options]

命令:
  add       添加新任务
  list      查看队列
  remove    删除任务
  clear     清空队列
  help      显示帮助

添加任务:
  node scripts/flow.mjs add --action deposit --token USDT --amount 1000 --platform aave
  node scripts/flow.mjs add --action swap --from ETH --to USDC --amount 0.5
  node scripts/flow.mjs add --action stake --amount 1000 --platform lido

选项:
  --action     操作类型 (deposit/withdraw/swap/stake/claim/bridge)
  --token      代币符号
  --amount     数量
  --platform   平台名称 (aave/compound/uniswap/lido/...)
  --chain      区块链 (ethereum/optimism/arbitrum/base/...)
  --status     按状态筛选 (pending/completed/failed)
  --id         任务 ID

示例:
  # 查看待执行任务
  node scripts/flow.mjs list --status pending

  # 删除任务
  node scripts/flow.mjs remove 3

  # 清空队列
  node scripts/flow.mjs clear
`);
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
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = parseArgs(args.slice(1));

  switch (command) {
    case 'add':
      await addTask(options);
      break;
    case 'list':
      await listQueue(options);
      break;
    case 'remove':
      await removeTask(args[1] || options.id);
      break;
    case 'clear':
      await clearQueue();
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
