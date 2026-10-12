import { openDB } from 'idb';

// Separate from progress: resetting a session must not reset its celebration.
export async function claimCelebration(owner: string, routineId: string, dayId: string, date: string): Promise<string | null> {
  const id = JSON.stringify([owner, routineId, dayId, date]);
  const db = await openDB('glow-celebrations', 1, {
    upgrade(database) { database.createObjectStore('claimed'); },
  });
  try {
    // A read/write transaction also prevents two tabs from claiming it together.
    const tx = db.transaction('claimed', 'readwrite');
    const claimed = await tx.store.get(id);
    if (!claimed) await tx.store.put(true, id);
    await tx.done;
    return claimed ? null : id;
  } finally { db.close(); }
}
