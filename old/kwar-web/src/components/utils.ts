// utils.js

/**
 * 格式化时间
 * @param {string|number} time - 时间戳或日期字符串
 * @returns {string} 格式化后的时间字符串 (如 "01 12:34:56")
 */
export const formatTime = (time: string | number) => {
    if (!time) return '-'; // 如果时间为空，返回 "-"
    const date = new Date(time);
    return date
        .toLocaleString('zh-CN', {
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false, // 24小时制
        })
        .replace(/(\d+)\s+(\d+:\d+:\d+)/, '$1 $2'); // 格式调整为 "日 时:分:秒"
};

/**
 * 格式化货币
 * @param {number} value - 金额（单位：分）
 * @returns {string} 格式化后的金额字符串（单位：元，保留2位小数）
 */
export const formatCurrency = (value: number) => (value / 1000).toFixed(2);
