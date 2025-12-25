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
 * Main parser/formatter for Memory dates.
 * Handles: string, Firestore timestamp, Date object, or null.
 * Falls back to input string if parsing fails but input is a string.
 */
export const formatMemoryDate = (dateInput: any): string => {
    try {
        if (!dateInput) return "No Date";

        // Logic to detect if input is ALREADY a range?
        // Current app likely stores single string. 
        // If we strictly want to support ranges, we'd need to check if the input is an object {start, end} 
        // or a string that looks like a range.

        let date: Date;

        if (dateInput.seconds) {
            // Firestore Timestamp
            date = new Date(dateInput.seconds * 1000);
        } else if (typeof dateInput === 'string') {
            // Handle simple string formats
            // Try to see if it's already a nice format? 
            // RegEx check for "Month, Year" (e.g. "September, 2025")
            // If it is solely "Month, Year", we might want to PRESERVE it roughly, 
            // but user wants "consistent" logic.
            // If we parse "September, 2025", we get Sept 1.
            // "1st September 2025" might be misleading if the user meant "Sometime in Sept".
            // However, for "12/24/2025", we definitely want to format it.

            // Quick Fix: If it contains only letters and numbers and comma (no slashes/dashes), maybe keep it?
            // But "12/24/2025" has slashes.
            // Let's try to parse everything. If it's a valid date, we fully format it.

            const safeString = dateInput.replace(' ', 'T');
            date = new Date(safeString);

            // Fallback for timestamp strings
            if (isNaN(date.getTime()) && !isNaN(Number(dateInput))) {
                date = new Date(Number(dateInput));
            }
        } else {
            date = new Date(dateInput);
        }

        if (isNaN(date.getTime())) {
            // Return original string if parsing failed
            if (typeof dateInput === 'string') return dateInput;
            return "Date Unavailable";
        }

        return formatSingleDate(date);
    } catch (e) {
        if (typeof dateInput === 'string') return dateInput;
        return "Date Error";
    }
};
