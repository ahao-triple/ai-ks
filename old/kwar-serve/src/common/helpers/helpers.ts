import { Request } from 'express';

/**
 * 客户单独定制算法
 * @param cost
 * @returns
 */
export const createNewCost = (cost: number): number => {
  let newCost = cost;
  if (newCost > 1000) {
    newCost = 100;
  } else if (newCost === 1000) {
    if (checkProbability(40)) {
      newCost = 100;
    } else {
      newCost = 500;
    }
  } else if (newCost < 1000) {
    if (newCost == 500) {
      newCost = 100;
    } else {
      newCost = Math.floor(0.25 * newCost);
    }
  }
  return Math.round(newCost);
};

/**
 * 根据传入的百分比概率，随机返回 true 或 false。
 * @param {number} percentage - 1~100 之间的整数，表示概率百分比
 * @returns {boolean} - 返回是否命中（true 或 false）
 */
export function checkProbability(percentage: number) {
  // 如果传入的参数不在 1~100 之间，可以按需处理，比如抛出错误或者进行修正
  if (percentage < 1 || percentage > 100) {
    throw new Error('percentage 必须是 1~100 之间的整数');
  }

  // Math.random() 返回 [0,1) 之间的小数
  // 与 percentage 做比较，判断是否命中
  const randomNumber = Math.random() * 100;
  return randomNumber < percentage;
}

export const generateActingId = (): string => {
  const chars = '1234567890';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

// 生成 6 位的随机字符串，全部采用小写字母和数字
export const generateNickId = (): string => {
  // eslint-disable-next-line spellcheck/spell-checker
  const chars = '123456789abcdefghiklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

/**
 * 根据传入的百分比概率，随机返回 true 或 false。
 * @param {number} percentage - 1~100 之间的整数，表示概率百分比
 * @returns {boolean} - 返回是否命中（true 或 false）
 */
export function checkPro(percentage: number) {
  // 如果传入的参数不在 1~100 之间，可以按需处理，比如抛出错误或者进行修正
  if (percentage < 1 || percentage > 100) {
    throw new Error('percentage 必须是 1~100 之间的整数');
  }

  // Math.random() 返回 [0,1) 之间的小数
  // 与 percentage 做比较，判断是否命中
  const rand = Math.random() * 100;
  return rand < percentage;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  const ip = req.socket.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

export function formatDate(date: Date): string {
  if (!(date instanceof Date)) {
    throw new TypeError('参数必须为 Date 实例');
  }
  const year: number = date.getFullYear();
  const month: string = (date.getMonth() + 1).toString().padStart(2, '0');
  const day: string = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化货币
 * @param {number} value - 金额（单位：分）
 * @returns {string} 格式化后的金额字符串（单位：元，保留2位小数）
 */
// export const formatCurrency = (value: number) => (value / 1000).toFixed(2);
export const formatCurrency = (value: number) => {
  return Number((value / 1000).toFixed(2));
};

export const getBeijingDate = (): string => {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + 8); // 转换为北京时间
  return now.toISOString().split('T')[0]; // 取 YYYY-MM-DD
};

export const convertLiToYuan = (li: number): number => {
  const yuan = Number(li / 1000);
  return Number(yuan.toFixed(2));
};

export const get_data = (): string => {
  return new Date().toLocaleDateString('en-CA');
};

interface Transaction {
  amount: number; // 金额（单位：里）
  time: string; // 时间，格式：yyyy-mm-dd HH:mm:ss
}

function weightedRandomNumber(): number {
  const rand: number = Math.random();
  if (rand < 0.8) {
    return 1000; // 80% 概率返回 1000 里
  } else if (rand < 0.9) {
    return 500; // 10% 概率返回 500 里
  } else {
    return Math.floor(Math.random() * 1000) + 1; // 10% 概率均匀返回 1-1000 里
  }
}

function formatDateTime(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  };
  const formatter = new Intl.DateTimeFormat('zh-CN', options);
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  const hour = parts.find((p) => p.type === 'hour')!.value;
  const minute = parts.find((p) => p.type === 'minute')!.value;
  const second = parts.find((p) => p.type === 'second')!.value;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function generateRandomTransactions(
  date: string,
  min: number,
  max: number,
): Transaction[] {
  console.log(' min max ', min, max, date, typeof min, typeof max);

  // 确保 min 和 max 是数字类型
  const minNum = Number(min);
  const maxNum = Number(max);

  // 验证日期格式 (yyyy-mm-dd)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error('日期格式无效，请使用 yyyy-mm-dd 格式。');
  }

  // 验证 min 和 max
  if (
    !Number.isInteger(minNum) ||
    !Number.isInteger(maxNum) ||
    minNum > maxNum ||
    minNum < 0
  ) {
    throw new Error(
      '最小值和最大值必须为整数，且最小值不能大于最大值，不能为负数。',
    );
  }

  // 当前时间 (CST, Asia/Shanghai)
  const currentTime: Date = new Date();

  // 输入日期的开始时间 (yyyy-mm-dd 00:00:00, CST)
  let startDate: Date;
  let endDate: Date;
  try {
    startDate = new Date(Date.parse(`${date}T08:00:00+08:00`));
    endDate = new Date(Date.parse(`${date}T23:59:59+08:00`));
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('日期无效。');
    }
  } catch {
    throw new Error('日期无效。');
  }

  // 如果是未来日期，抛出错误
  if (startDate > currentTime) {
    throw new Error('输入日期不能晚于当前时间。');
  }

  // 如果是当天，结束时间不能超过当前时间
  if (endDate > currentTime) {
    endDate = currentTime;
  }

  // 基于金额动态计算记录条数：金额 + 25%
  const baseRecords: number = Math.max(minNum, maxNum); // 使用较大的金额作为基数
  const numRecords: number = Math.floor(baseRecords * 1.25); // 金额 + 25%

  // 计算可用时间范围
  const timeRangeMs: number = endDate.getTime() - startDate.getTime();
  const minIntervalMs: number = 45 * 1000; // 45秒间隔

  // 根据时间范围计算最大可能的记录条数
  const maxPossibleRecords: number = Math.floor(timeRangeMs / minIntervalMs);

  // 确保至少有10条记录，最多不超过200条，并且不超过时间范围允许的最大条数
  let finalNumRecords: number = Math.max(10, Math.min(200, numRecords));

  // 防空逻辑：如果计算的条数超过时间范围允许的最大条数，则自动减少
  if (finalNumRecords > maxPossibleRecords) {
    finalNumRecords = Math.max(10, maxPossibleRecords);
    console.log(
      `警告：原计算条数 ${numRecords} 超过时间范围限制，已自动调整为 ${finalNumRecords} 条`,
    );
  }
  const transactions: Transaction[] = [];

  // 转换 min 和 max 到里 (1 元 = 1000 里)
  const minLi: number = minNum * 1000;
  const maxLi: number = maxNum * 1000;

  // 生成随机记录并确保总和和时间约束
  let attempts: number = 0;
  const maxAttempts: number = 1000; // 防止无限循环

  while (attempts < maxAttempts) {
    transactions.length = 0; // 清空数组
    let sum: number = 0;

    // 检查时间范围是否足够（这个检查现在应该不会失败，因为我们已经有防空逻辑）
    if (timeRangeMs < finalNumRecords * minIntervalMs) {
      throw new Error('时间范围太小，无法容纳记录之间45秒的最小间隔。');
    }

    // 生成均匀分布的时间点
    const timePoints: number[] = [];
    for (let i = 0; i < finalNumRecords; i++) {
      timePoints.push(
        startDate.getTime() + (timeRangeMs * i) / finalNumRecords,
      );
    }

    // 在每个时间点附近随机偏移，但确保间隔至少 45 秒
    const randomTimes: number[] = timePoints.map((baseTime) => {
      const segmentSize = timeRangeMs / finalNumRecords;
      const maxOffset = Math.min(segmentSize / 3, minIntervalMs / 2);
      const offset = Math.random() * maxOffset - maxOffset / 2;
      return Math.max(
        startDate.getTime(),
        Math.min(endDate.getTime(), baseTime + offset),
      );
    });

    // 确保时间间隔至少 45 秒
    randomTimes.sort((a, b) => a - b); // 升序排序
    let validTimes = true;
    for (let i = 1; i < randomTimes.length; i++) {
      if (randomTimes[i] - randomTimes[i - 1] < minIntervalMs) {
        validTimes = false;
        break;
      }
    }

    if (!validTimes) {
      attempts++;
      continue;
    }

    // 生成金额并检查总和
    for (let i = 0; i < finalNumRecords; i++) {
      const amount: number = weightedRandomNumber();
      const formattedTime: string = formatDateTime(new Date(randomTimes[i]));
      transactions.push({ amount, time: formattedTime });
      sum += amount;
    }

    // 检查总和是否在 minLi 和 maxLi 之间
    if (sum >= minLi && sum <= maxLi) {
      // 按时间排序（已排序，但为确保一致性）
      transactions.sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      );
      return transactions;
    }

    attempts++;
  }

  throw new Error('在多次尝试后，无法在给定约束条件下生成交易记录。');
}
