#!/usr/bin/env node

/**
 * ⚡ SharkFlow - Task Executor
 * 任务执行器 - 模拟执行/实际执行链上交易
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = join(__dirname, '..', 'data', 'queue.json');

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
 * 模拟执行 (Dry Run)
 */
async function dryRun(task) {
  console.log(`\n🔍 模拟执行任务 #${task.id}\n`);
  console.log('─'.repeat(60));
  
  // 验证任务参数
  const issues = [];
  
  if (!task.token) {
    issues.push('缺少代币符号');
  }
  
  if (!task.amount || task.amount <= 0) {
    issues.push('数量无效');
  }
  
  if (!task.platform) {
    issues.push('缺少平台名称');
  }

  // 检查平台支持
  const supportedPlatforms = {
    deposit: ['aave', 'compound', 'spark', 'morpho'],
    withdraw: ['aave', 'compound', 'spark', 'morpho'],
    swap: ['uniswap', 'curve', '1inch', 'sushiswap'],
    stake: ['lido', 'rocketpool', 'frax', 'stakewise'],
    claim: ['aave', 'compound', 'lido', 'rocketpool'],
    bridge: ['stargate', 'hop', 'across', 'synapse']
  };

  if (supportedPlatforms[task.action] && !supportedPlatforms[task.action].includes(task.platform?.toLowerCase())) {
    issues.push(`平台 "${task.platform}" 不支持 ${task.action} 操作`);
  }

  // 预估 Gas 费用
  const gasEstimates = {
    ethereum: { deposit: 15, withdraw: 12, swap: 18, stake: 10, claim: 8, bridge: 25 },
    optimism: { deposit: 2, withdraw: 1.5, swap: 3, stake: 1.5, claim: 1, bridge: 5 },
    arbitrum: { deposit: 3, withdraw: 2, swap: 4, stake: 2, claim: 1.5, bridge: 6 },
    base: { deposit: 1.5, withdraw: 1, swap: 2, stake: 1, claim: 0.8, bridge: 4 }
  };

  const gas = gasEstimates[task.chain]?.[task.action] || 5;
  const gasCostUSD = gas * 2000 / 1000; // 简化计算

  // 显示模拟结果
  console.log(`操作：     ${task.action.toUpperCase()}`);
  console.log(`代币：     ${task.token}`);
  console.log(`数量：     $${task.amount}`);
  console.log(`平台：     ${task.platform}`);
  console.log(`链：       ${task.chain}`);
  console.log('─'.repeat(60));
  
  if (issues.length > 0) {
    console.log('\n❌ 验证失败:\n');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log('\n💡 请修正后重试');
    return false;
  }

  console.log('\n✅ 验证通过\n');
  console.log('预计执行步骤:');
  console.log(`  1. 检查 ${task.token} 余额`);
  console.log(`  2. 授权 ${task.platform} 合约`);
  console.log(`  3. 执行 ${task.action} 操作`);
  console.log(`  4. 确认交易`);
  console.log('');
  console.log(`预估 Gas 费用: $${gasCostUSD.toFixed(2)} (${task.chain})`);
  console.log(`净收益预估：需要实际执行后计算`);
  console.log('');
  console.log('💡 实际执行：node scripts/execute.mjs --id ${task.id}');
  
  return true;
}

/**
 * 实际执行任务
 * 注意：当前版本只做模拟，实际执行需要集成 ethers.js
 */
async function executeTask(taskId, options = {}) {
  const queue = await loadQueue();
  
  const taskIndex = queue.tasks.findIndex(t => t.id === parseInt(taskId));
  
  if (taskIndex === -1) {
    console.error(`❌ 未找到任务 ID: ${taskId}`);
    return;
  }

  const task = queue.tasks[taskIndex];

  if (task.status === 'completed') {
    console.log('⚠️  任务已完成，无需重复执行\n');
    printTask(task);
    return;
  }

  if (task.status === 'executing') {
    console.log('⚠️  任务正在执行中，请等待...\n');
    return;
  }

  // 如果是 dry-run 模式
  if (options.dryRun) {
    await dryRun(task);
    return;
  }

  console.log(`⚡ 开始执行任务 #${task.id}\n`);
  console.log('─'.repeat(60));

  // 更新状态为执行中
  task.status = 'executing';
  await saveQueue(queue);

  try {
    // 模拟执行过程
    console.log('📝 步骤 1/4: 检查余额...');
    await sleep(1000);
    console.log('   ✅ 余额充足');

    console.log('📝 步骤 2/4: 授权合约...');
    await sleep(1000);
    console.log('   ✅ 授权成功');

    console.log('📝 步骤 3/4: 执行操作...');
    await sleep(1500);
    
    // 生成模拟交易哈希
    const mockTxHash = '0x' + Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    console.log(`   ✅ 操作成功`);
    console.log(`   📄 TX: ${mockTxHash}`);

    console.log('📝 步骤 4/4: 确认交易...');
    await sleep(1000);
    console.log('   ✅ 交易已确认');

    // 更新任务状态
    task.status = 'completed';
    task.executedAt = new Date().toISOString();
    task.txHash = mockTxHash;
    
    await saveQueue(queue);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ 任务执行完成!\n');
    printTask(task);
    
    console.log('💡 查看交易：https://etherscan.io/tx/' + mockTxHash);
    console.log('💡 查看队列：node scripts/flow.mjs list');

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    task.status = 'failed';
    task.error = error.message;
    await saveQueue(queue);
    
    console.log('\n💡 重试：node scripts/execute.mjs --id ${taskId}');
  }
}

/**
 * 执行所有待处理任务
 */
async function executeAll(options = {}) {
  const queue = await loadQueue();
  
  const pendingTasks = queue.tasks.filter(t => t.status === 'pending');
  
  if (pendingTasks.length === 0) {
    console.log('📋 没有待执行的任务\n');
    console.log('💡 添加任务：node scripts/flow.mjs add');
    return;
  }

  console.log(`⚡ 将执行 ${pendingTasks.length} 个任务\n`);

  for (const task of pendingTasks) {
    if (options.dryRun) {
      await dryRun(task);
    } else {
      await executeTask(task.id, options);
    }
    
    if (pendingTasks.indexOf(task) < pendingTasks.length - 1) {
      console.log('\n' + '─'.repeat(60) + '\n');
      await sleep(500); // 任务间延迟
    }
  }
}

/**
 * 打印任务详情
 */
function printTask(task) {
  console.log(`任务 ID:    ${task.id}`);
  console.log(`操作：      ${task.action}`);
  console.log(`代币：      ${task.token}`);
  console.log(`数量：      $${task.amount}`);
  console.log(`平台：      ${task.platform}`);
  console.log(`链：        ${task.chain}`);
  console.log(`状态：      ${task.status}`);
  console.log(`创建时间：  ${task.createdAt}`);
  if (task.executedAt) {
    console.log(`执行时间：  ${task.executedAt}`);
  }
  if (task.txHash) {
    console.log(`交易哈希：  ${task.txHash}`);
  }
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
⚡ SharkFlow - 任务执行器

用法:
  node scripts/execute.mjs <command> [options]

命令:
  <id>      执行指定任务
  --all     执行所有待处理任务
  --dry     模拟执行 (不实际提交)
  help      显示帮助

示例:
  # 模拟执行任务 #1
  node scripts/execute.mjs 1 --dry

  # 实际执行任务 #1
  node scripts/execute.mjs 1

  # 执行所有待处理任务
  node scripts/execute.mjs --all

  # 模拟执行所有任务
  node scripts/execute.mjs --all --dry

选项:
  --id       任务 ID (也可以使用位置参数)
  --dry      模拟执行模式
  --all      执行所有待处理任务

⚠️  注意:
  - 当前版本为模拟执行，实际交易需要集成钱包
  - 执行前请确保钱包有足够余额支付 Gas
  - 大额交易建议使用多签钱包
`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    showHelp();
    return;
  }

  const options = parseArgs(args);
  
  // 查找任务 ID
  let taskId = null;
  if (args[0] && !args[0].startsWith('--')) {
    taskId = args[0];
  } else if (options.id) {
    taskId = options.id;
  }

  if (options.all) {
    await executeAll(options);
  } else if (taskId) {
    await executeTask(taskId, options);
  } else {
    console.error('❌ 请指定任务 ID 或使用 --all 执行所有任务\n');
    showHelp();
  }
}

main().catch(console.error);
