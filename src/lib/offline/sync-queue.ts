import { db, OfflineAction } from './db';
import { toast } from 'sonner';

export class OfflineSyncQueue {
    private isSyncing = false;

    async addToQueue(action: Omit<OfflineAction, 'id' | 'synced' | 'timestamp'>) {
        await db.offlineActions.add({
            ...action,
            timestamp: Date.now(),
            synced: false
        });

        // Register background sync verification
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            try {
                await registration.sync.register('sync-offline-actions');
            } catch (err) {
                console.warn('Background sync registration failed:', err);
            }
        }
    }

    async syncNow() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const pendingActions = await db.offlineActions
                .where('synced')
                .equals(0) // 0 = false in Dexie bool index
                .toArray();

            if (pendingActions.length === 0) return;

            toast.info(`Synchronisation de ${pendingActions.length} action(s)...`);

            for (const action of pendingActions) {
                try {
                    // Process action based on type and resource
                    await this.processAction(action);

                    // Mark as synced
                    await db.offlineActions.update(action.id!, { synced: true });
                } catch (error) {
                    console.error(`Failed to sync action ${action.id}:`, error);
                    // Keep as unsynced to retry later
                }
            }

            // Cleanup synced actions older than 24h
            const yesterday = Date.now() - 24 * 60 * 60 * 1000;
            await db.offlineActions
                .where('timestamp')
                .below(yesterday)
                .and(a => a.synced)
                .delete();

            toast.success("Synchronisation terminée");
        } finally {
            this.isSyncing = false;
        }
    }

    private async processAction(action: OfflineAction) {
        // Determine API endpoint based on resource
        let endpoint = '';
        switch (action.resource) {
            case 'STUDENT': endpoint = '/api/students'; break;
            case 'GRADE': endpoint = '/api/grades'; break;
            case 'ATTENDANCE': endpoint = '/api/attendance'; break;
            default: throw new Error(`Unknown resource: ${action.resource}`);
        }

        const method = action.type === 'CREATE' ? 'POST' : action.type === 'UPDATE' ? 'PUT' : 'DELETE';

        // Append ID for update/delete
        if (method !== 'POST' && action.data.id) {
            endpoint += `/${action.data.id}`;
        }

        const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
    }
}

export const syncQueue = new OfflineSyncQueue();
