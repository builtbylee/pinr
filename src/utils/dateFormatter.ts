import { Platform } from 'react-native';

/**
 * Helper to get ordinal suffix (st, nd, rd, th)
 */
const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
};

/**
 * Formats a single date object into "24th December 2025" format.
 */
const formatSingleDate = (date: Date): string => {
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
};

/**
 * Formats a date range according to improved logic:
 * - Same Month: "12th-30th December 2025"
 * - Same Year: "30th November - 12th December 2025"
 * - Diff Year: "30th December 2025 - 4th January 2026"
 */
export const formatDateRange = (startDate: Date, endDate: Date): string => {
    const startDay = startDate.getDate();
    const startMonth = startDate.toLocaleString('default', { month: 'long' });
    const startYear = startDate.getFullYear();

    const endDay = endDate.getDate();
    const endMonth = endDate.toLocaleString('default', { month: 'long' });
    const endYear = endDate.getFullYear();

    if (startYear === endYear) {
        if (startMonth === endMonth) {
            // Same Month: "12th-30th December 2025"
            return `${startDay}${getOrdinalSuffix(startDay)}-${endDay}${getOrdinalSuffix(endDay)} ${endMonth} ${endYear}`;
        } else {
            // Same Year, Diff Month: "30th November - 12th December 2025"
            return `${startDay}${getOrdinalSuffix(startDay)} ${startMonth} - ${endDay}${getOrdinalSuffix(endDay)} ${endMonth} ${endYear}`;
        }
    } else {
        // Diff Year: "30th December 2025 - 4th January 2026"
        return `${startDay}${getOrdinalSuffix(startDay)} ${startMonth} ${startYear} - ${endDay}${getOrdinalSuffix(endDay)} ${endMonth} ${endYear}`;
    }
};

/**
 * Helper to parse date from various formats
 */
const parseDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;

    let date: Date;

    if (dateInput.seconds) {
        // Firestore Timestamp
        date = new Date(dateInput.seconds * 1000);
    } else if (typeof dateInput === 'string') {
        // Try parsing as ISO string first (most common format from dayjs.toISOString())
        date = new Date(dateInput);
        
        // If that fails, try replacing space with T (for formats like "2025-12-02 00:00:00")
        if (isNaN(date.getTime())) {
            const safeString = dateInput.replace(' ', 'T');
            date = new Date(safeString);
        }
        
        // Fallback for timestamp strings
        if (isNaN(date.getTime()) && !isNaN(Number(dateInput))) {
            date = new Date(Number(dateInput));
        }
    } else {
        date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
};

/**
 * Main parser/formatter for Memory dates.
 * Handles: string, Firestore timestamp, Date object, or null.
 * Falls back to input string if parsing fails but input is a string.
 * 
 * @param dateInput - The start date (required)
 * @param endDateInput - The end date (optional) - for date ranges
 */
export const formatMemoryDate = (dateInput: any, endDateInput?: any): string => {
    try {
        if (!dateInput) return "No Date";

        const startDate = parseDate(dateInput);
        
        if (!startDate) {
            // Return original string if parsing failed
            if (typeof dateInput === 'string') return dateInput;
            return "Date Unavailable";
        }

        // Check if we have an end date for a range
        if (endDateInput) {
            const endDate = parseDate(endDateInput);
            if (endDate && endDate.getTime() !== startDate.getTime()) {
                return formatDateRange(startDate, endDate);
            }
        }

        return formatSingleDate(startDate);
    } catch (e) {
        if (typeof dateInput === 'string') return dateInput;
        return "Date Error";
    }
};
