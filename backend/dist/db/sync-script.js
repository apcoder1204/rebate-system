"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sync_1 = require("./sync");
const command = process.argv[2];
async function main() {
    if (command === 'to-backup' || !command) {
        // Default: sync from primary to backup
        await (0, sync_1.syncToBackup)();
    }
    else if (command === 'to-primary') {
        // Sync from backup to primary
        await (0, sync_1.syncToPrimary)();
    }
    else {
        console.log('Usage:');
        console.log('  npm run sync              - Sync from Neon to localhost (default)');
        console.log('  npm run sync:to-backup    - Sync from Neon to localhost');
        console.log('  npm run sync:to-primary   - Sync from localhost to Neon');
        process.exit(1);
    }
    process.exit(0);
}
main().catch((error) => {
    console.error('Sync script failed:', error);
    process.exit(1);
});
