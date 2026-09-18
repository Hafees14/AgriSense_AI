"use client";

import { api, type GeolocationCoords } from "@/lib/api-client";

// A queued diagnosis waiting to be submitted once the device is back
// online. Stored in IndexedDB (not localStorage) because it has to hold
// the actual photo as binary data — localStorage is string-only and far
// too small for even one photo, let alone several queued while offline.
export interface QueuedDiagnosis {
  id: string;
  diagnosisType: "plant_id" | "disease" | "pest";
  imageBlob: Blob;
  fileName: string;
  fileType: string;
  fieldId?: string;
  progressGroupId?: string;
  coords?: GeolocationCoords;
  createdAt: number;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
}

const DB_NAME = "agrisense-offline";
const STORE_NAME = "diagnosis-queue";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function enqueueDiagnosis(item: Omit<QueuedDiagnosis, "id" | "createdAt" | "status">): Promise<void> {
  const record: QueuedDiagnosis = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    status: "pending",
  };
  await withStore("readwrite", (store) => store.add(record));
}

export async function listQueue(): Promise<QueuedDiagnosis[]> {
  try {
    const items = await withStore<QueuedDiagnosis[]>("readonly", (store) => store.getAll());
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

async function removeFromQueue(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

async function updateQueueItem(item: QueuedDiagnosis): Promise<void> {
  await withStore("readwrite", (store) => store.put(item));
}

export interface SyncResult {
  succeeded: number;
  failed: number;
  remaining: number;
}

// Tries to submit every pending item in the queue. Called on page load,
// whenever the browser fires an 'online' event, and from a manual "Sync
// now" button. Items that fail because we're still offline are left as
// "pending" so the next trigger retries them; items that fail for a real
// reason (e.g. the server rejects the image) are marked "failed" so the
// farmer can see something needs their attention rather than silently
// retrying forever.
export async function syncQueue(): Promise<SyncResult> {
  const items = await listQueue();
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    if (item.status === "syncing") continue;
    try {
      await updateQueueItem({ ...item, status: "syncing" });
      const file = new File([item.imageBlob], item.fileName, { type: item.fileType });

      if (item.diagnosisType === "plant_id") {
        await api.diagnoses.identifyPlant(file, item.coords);
      } else if (item.diagnosisType === "disease") {
        await api.diagnoses.detectDisease(file, item.fieldId, item.progressGroupId, item.coords);
      } else {
        await api.diagnoses.detectPest(file, item.fieldId, item.coords);
      }

      await removeFromQueue(item.id);
      succeeded += 1;
    } catch (err) {
      // typeof navigator check: if we're offline again mid-sync, stop the
      // whole run rather than burning through retries — no point marking
      // items "failed" just because connectivity dropped again.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await updateQueueItem({ ...item, status: "pending" });
        break;
      }
      await updateQueueItem({
        ...item,
        status: "failed",
        lastError: err instanceof Error ? err.message : "Upload failed",
      });
      failed += 1;
    }
  }

  const remaining = (await listQueue()).length;
  return { succeeded, failed, remaining };
}

export async function retryFailedItem(id: string): Promise<void> {
  const items = await listQueue();
  const item = items.find((i) => i.id === id);
  if (item) await updateQueueItem({ ...item, status: "pending", lastError: undefined });
}

export async function discardQueuedItem(id: string): Promise<void> {
  await removeFromQueue(id);
}