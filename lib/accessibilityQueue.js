const MAX_CONCURRENT = Number.parseInt(
  process.env.ACCESSIBILITY_MAX_CONCURRENT || "2",
  10
);
const MAX_QUEUE_LENGTH = Number.parseInt(
  process.env.ACCESSIBILITY_MAX_QUEUE_LENGTH || "50",
  10
);
const MAX_QUEUE_WAIT_MS = Number.parseInt(
  process.env.ACCESSIBILITY_MAX_QUEUE_WAIT_MS || "180000",
  10
);
const STATUS_TTL_MS = 5 * 60 * 1000;

let activeCount = 0;
const activeGroups = new Map();
const queue = [];
const records = new Map();

const now = () => Date.now();

const cleanupRecords = () => {
  const cutoff = now() - STATUS_TTL_MS;
  for (const [id, record] of records.entries()) {
    if (
      ["completed", "failed", "timeout", "rejected"].includes(record.status) &&
      record.updatedAt < cutoff
    ) {
      records.delete(id);
    }
  }
};

const queuedGroupIds = () => [...new Set(queue.map((item) => item.groupId))];

const getPosition = (id) => {
  const item = queue.find((queued) => queued.id === id);
  if (!item) return null;
  return queuedGroupIds().indexOf(item.groupId) + 1;
};

const activeGroupIds = () => [...activeGroups.keys()];

export const getAccessibilityQueueStatus = (id) => {
  cleanupRecords();
  const record = id ? records.get(id) : null;

  return {
    id: id || null,
    status: record?.status || "unknown",
    activeCount,
    queuedCount: queuedGroupIds().length,
    maxConcurrent: MAX_CONCURRENT,
    queuePosition: id ? getPosition(id) : null,
    waitMs: record ? now() - record.enqueuedAt : 0,
    maxQueueWaitMs: MAX_QUEUE_WAIT_MS,
  };
};

const startQueuedItem = (item) => {
  const index = queue.findIndex((queued) => queued.id === item.id);
  if (index !== -1) {
    queue.splice(index, 1);
  }

  activeCount += 1;
  activeGroups.set(item.groupId, (activeGroups.get(item.groupId) || 0) + 1);

  clearTimeout(item.timeout);
  const startedAt = now();

  records.set(item.id, {
    ...records.get(item.id),
    status: "running",
    startedAt,
    updatedAt: startedAt,
  });

  item.resolve({
    id: item.id,
    groupId: item.groupId,
    enqueuedAt: item.enqueuedAt,
    startedAt,
    positionAtEnqueue: item.positionAtEnqueue,
  });
};

const findNextItem = () => {
  const activeItem = queue.find((item) => activeGroups.has(item.groupId));
  if (activeItem) return activeItem;

  const groups = queuedGroupIds();
  const groupId = groups[Math.floor(Math.random() * groups.length)];
  return queue.find((item) => item.groupId === groupId);
};

const startNext = () => {
  cleanupRecords();

  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    startQueuedItem(findNextItem());
  }
};

export const waitForAccessibilityQueueTurn = (id, groupId = id) => {
  cleanupRecords();

  if (activeCount < MAX_CONCURRENT) {
    activeCount += 1;
    const timestamp = now();
    activeGroups.set(groupId, (activeGroups.get(groupId) || 0) + 1);
    records.set(id, {
      id,
      groupId,
      status: "running",
      enqueuedAt: timestamp,
      startedAt: timestamp,
      updatedAt: timestamp,
    });

    return Promise.resolve({
      id,
      groupId,
      enqueuedAt: timestamp,
      startedAt: timestamp,
      positionAtEnqueue: 0,
    });
  }

  if (queue.length >= MAX_QUEUE_LENGTH) {
    const error = new Error("Accessibility queue is full");
    error.code = "ACCESSIBILITY_QUEUE_FULL";
    records.set(id, {
      id,
      groupId,
      status: "rejected",
      enqueuedAt: now(),
      updatedAt: now(),
    });
    return Promise.reject(error);
  }

  const enqueuedAt = now();
  const groups = [...new Set([...activeGroupIds(), ...queuedGroupIds()])];
  const existingGroupIndex = groups.indexOf(groupId);
  const positionAtEnqueue =
    existingGroupIndex === -1 ? groups.length + 1 : existingGroupIndex + 1;

  records.set(id, {
    id,
    groupId,
    status: "queued",
    enqueuedAt,
    updatedAt: enqueuedAt,
  });

  return new Promise((resolve, reject) => {
    const item = {
      id,
      groupId,
      enqueuedAt,
      positionAtEnqueue,
      resolve,
      reject,
      timeout: null,
    };

    item.timeout = setTimeout(() => {
      const index = queue.findIndex((queued) => queued.id === id);
      if (index !== -1) {
        queue.splice(index, 1);
      }

      records.set(id, {
        id,
        groupId,
        status: "timeout",
        enqueuedAt,
        updatedAt: now(),
      });

      const error = new Error("Accessibility queue wait timed out");
      error.code = "ACCESSIBILITY_QUEUE_TIMEOUT";
      reject(error);
    }, MAX_QUEUE_WAIT_MS);

    queue.push(item);
  });
};

export const finishAccessibilityQueueTurn = (id, status = "completed") => {
  const record = records.get(id);
  const groupId = record?.groupId || id;
  const activeGroupCount = activeGroups.get(groupId);

  if (activeGroupCount <= 1) {
    activeGroups.delete(groupId);
    if (activeCount > 0) {
      activeCount -= 1;
    }
  } else {
    activeGroups.set(groupId, activeGroupCount - 1);
  }

  records.set(id, {
    ...record,
    id,
    groupId,
    status,
    completedAt: now(),
    updatedAt: now(),
  });

  startNext();
};
