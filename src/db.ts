import { Platform } from 'react-native';

import type { MeetingRow } from './types';

type DatabaseModule = {
  initializeDatabase: () => Promise<void>;
  getDatabase: () => {
    execAsync: (source: string) => Promise<void>;
    getFirstAsync: <T>(source: string, ...params: unknown[]) => Promise<T | null>;
    getAllAsync: <T>(source: string, ...params: unknown[]) => Promise<T[]>;
    runAsync: (source: string, ...params: unknown[]) => Promise<void>;
  };
  mapMeetingRow: (row: Record<string, unknown>) => MeetingRow;
};

const databaseModule: DatabaseModule =
  Platform.OS === 'web' ? require('./db.web') : require('./db.native');

export const initializeDatabase = databaseModule.initializeDatabase;
export const getDatabase = databaseModule.getDatabase;
export const mapMeetingRow = databaseModule.mapMeetingRow;
