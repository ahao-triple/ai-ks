import React from 'react';
import { DateRangePicker, DateValue, RangeValue } from '@heroui/react';
import {
    parseDate,
    getLocalTimeZone,
    CalendarDate,
    CalendarDateTime,
    ZonedDateTime,
    today,
} from '@internationalized/date';

interface ServerDateRangePickerProps {
    onChange: (start: string | null, end: string | null) => void;
    defaultValue?: {
        start: string;
        end: string;
    };
}

export function ServerDateRangePicker({
    onChange,
    defaultValue,
}: ServerDateRangePickerProps) {
    // 获取今天的日期作为默认值
    const todayDate = today(getLocalTimeZone());

    // 如果提供了默认值，则解析默认值；否则使用今天的日期
    const initialValue = React.useMemo(() => {
        if (defaultValue) {
            try {
                return {
                    start: parseServerDateString(defaultValue.start),
                    end: parseServerDateString(defaultValue.end),
                };
            } catch (e) {
                console.error('解析默认日期值时出错:', e);
                return { start: todayDate, end: todayDate };
            }
        }

        // 默认使用今天的日期
        return { start: todayDate, end: todayDate };
    }, [defaultValue, todayDate]);

    // 组件挂载时触发一次onChange，设置初始值
    React.useEffect(() => {
        const startFormatted = formatDateForServer(initialValue.start, true);
        const endFormatted = formatDateForServer(initialValue.end, false);
        onChange(startFormatted, endFormatted);
    }, []);

    // 处理日期范围变化
    const handleChange = (value: RangeValue<DateValue> | null) => {
        if (!value) {
            onChange(null, null);
            return;
        }

        // 使用特定的时间值格式化
        const startFormatted = formatDateForServer(value.start, true); // 一天的开始
        const endFormatted = formatDateForServer(value.end, false); // 一天的结束

        onChange(startFormatted, endFormatted);
    };

    return (
        <DateRangePicker
            label="选择日期范围"
            // @ts-ignore
            defaultValue={initialValue}
            onChange={handleChange}
            granularity="day" // 更改为day，因为我们只关心日期部分
            shouldForceLeadingZeros
            validationBehavior="aria"
            selectorButtonPlacement="start"
            visibleMonths={2}
            autoFocus={true}
            pageBehavior="single"
        />
    );
}

// 辅助函数：将服务器日期字符串解析为DateValue
function parseServerDateString(dateString: string): DateValue {
    // 预期格式: YYYY-MM-DD HH:MM:SS
    const [datePart] = dateString.split(' ');

    // 始终解析为CalendarDate，因为我们只关心显示的日期部分
    return parseDate(datePart);
}

// 辅助函数：将DateValue格式化为服务器格式
// isStart: true表示开始日期(00:00:00)，false表示结束日期(23:59:59)
function formatDateForServer(date: DateValue, isStart: boolean): string {
    // 从DateValue中提取年、月、日
    let year, month, day;

    if (date instanceof CalendarDate) {
        year = date.year;
        month = date.month;
        day = date.day;
    } else if (date instanceof CalendarDateTime) {
        year = date.year;
        month = date.month;
        day = date.day;
    } else if (date instanceof ZonedDateTime) {
        year = date.year;
        month = date.month;
        day = date.day;
    } else {
        // 如果类型未知，则使用toDate作为备选方案
        // @ts-ignore
        const localDate = date.toDate(getLocalTimeZone());
        year = localDate.getFullYear();
        month = localDate.getMonth() + 1;
        day = localDate.getDate();
    }

    // 格式化日期部分
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(
        day,
    ).padStart(2, '0')}`;

    // 根据是开始还是结束日期添加固定的时间
    const timeString = isStart ? '00:00:00' : '23:59:59';

    return `${formattedDate} ${timeString}`;
}
