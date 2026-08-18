export type LocalOfflineSale = {
  clientTxnId: string;
  deviceId: string;
  queuedAt: string;
  fields: Record<string, string>;
  status: "QUEUED" | "SYNCING" | "CONFLICT" | "FAILED";
  message?: string;
};

const QUEUE_KEY = "avenue-offline-pos-queue-v1";
const DEVICE_KEY = "avenue-offline-pos-device-v1";
export const OFFLINE_QUEUE_EVENT = "avenue-offline-pos-queue-change";

export function readOfflineQueue(): LocalOfflineSale[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) || "[]") as LocalOfflineSale[];
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue: LocalOfflineSale[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
}

function deviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function queueOfflineSale(formData: FormData) {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("$ACTION_") && typeof value === "string") fields[key] = value;
  }
  const sale: LocalOfflineSale = {
    clientTxnId: crypto.randomUUID(),
    deviceId: deviceId(),
    queuedAt: new Date().toISOString(),
    fields,
    status: "QUEUED",
  };
  writeOfflineQueue([...readOfflineQueue(), sale]);
  return sale;
}

export async function syncOfflineTransaction(clientTxnId: string) {
  const queue = readOfflineQueue();
  const sale = queue.find((item) => item.clientTxnId === clientTxnId);
  if (!sale) return null;
  writeOfflineQueue(queue.map((item) => item.clientTxnId === clientTxnId ? { ...item, status: "SYNCING", message: undefined } : item));

  try {
    const response = await fetch("/api/offline-pos/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sale, status: undefined, message: undefined }),
    });
    const result = (await response.json()) as { status: string; saleId?: string; invoiceNumber?: string; message?: string };
    if (result.status === "SYNCED") {
      writeOfflineQueue(readOfflineQueue().filter((item) => item.clientTxnId !== clientTxnId));
    } else {
      writeOfflineQueue(readOfflineQueue().map((item) => item.clientTxnId === clientTxnId
        ? { ...item, status: result.status === "CONFLICT" ? "CONFLICT" : "FAILED", message: result.message }
        : item));
    }
    return result;
  } catch {
    writeOfflineQueue(readOfflineQueue().map((item) => item.clientTxnId === clientTxnId
      ? { ...item, status: "QUEUED", message: "Waiting for connection" }
      : item));
    return { status: "QUEUED", message: "Waiting for connection" };
  }
}

export async function syncOfflineQueue() {
  if (!navigator.onLine) return;
  const pending = readOfflineQueue().filter(
    (item) => item.status === "QUEUED" || item.status === "FAILED" || item.status === "CONFLICT",
  );
  for (const item of pending) await syncOfflineTransaction(item.clientTxnId);
}
