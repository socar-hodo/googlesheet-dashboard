import 'server-only';

import { fetchSheetData, isGoogleSheetsConfigured } from '@/lib/sheets';
import { parseWorkHistoryRows } from '@/lib/work-history';
import type { WorkHistoryRecord } from '@/types/work-history';

const WORK_HISTORY_SHEET = process.env.GOOGLE_WORK_HISTORY_SHEET_NAME ?? 'WorkHistory';
const WORK_HISTORY_RANGE = process.env.GOOGLE_WORK_HISTORY_RANGE ?? `${WORK_HISTORY_SHEET}!A1:Z1000`;

export async function getWorkHistoryRecords(): Promise<WorkHistoryRecord[]> {
  if (!isGoogleSheetsConfigured()) {
    return [];
  }

  try {
    const rows = await fetchSheetData(WORK_HISTORY_RANGE);
    if (!rows || rows.length === 0) {
      return [];
    }

    const parsed = parseWorkHistoryRows(rows);
    return parsed;
  } catch (error) {
    console.error('Failed to load work history from Google Sheets.', error);
    return [];
  }
}
