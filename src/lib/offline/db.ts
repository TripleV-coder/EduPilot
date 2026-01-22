import Dexie, { Table } from 'dexie';

export interface OfflineAction {
    id?: number;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    resource: 'STUDENT' | 'GRADE' | 'ATTENDANCE' | 'NOTE';
    data: any;
    timestamp: number;
    synced: boolean;
    schoolId: string;
}

export interface OfflineCache {
    id?: string; // URL or key
    data: any;
    timestamp: number;
    expiry: number;
}

export class EduPilotOfflineDB extends Dexie {
    offlineActions!: Table<OfflineAction>;
    offlineCache!: Table<OfflineCache>;

    constructor() {
        super('EduPilotOfflineDB');
        this.version(1).stores({
            offlineActions: '++id, type, resource, timestamp, schoolId, synced',
            offlineCache: 'id, timestamp, expiry'
        });
    }
}

export const db = new EduPilotOfflineDB();
