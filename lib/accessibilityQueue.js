const MAX_CONCURRENT = Number.parseInt(
  process.env.ACCESSIBILITY_MAX_CONCURRENT || "1",
  10
);
const MAX_QUEUE_LENGTH = Number.parseInt(
  process.env.ACCESSIBILITY_MAX_QUEUE_LENGTH || "50",
  10
);
const MAX_QUEUE_WAIT_MS = Number.parseInt(
  process.env.ACCESSIBILITY_MAX_QUEUE_WAIT_MS || "210000",
  10
);
const STATUS_TTL_MS = 5 * 60 * 1000;

let activeGroupCount = 0;
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

const createActiveGroup = (groupId, expectedSize) => {
  activeGroupCount += 1;
  activeGroups.set(groupId, {
    running: 0,
    completed: 0,
    expected: Math.max(1, expectedSize),
  });
};

export const getAccessibilityQueueStatus = (id) => {
  cleanupRecords();
  const record = id ? records.get(id) : null;

  return {
    id: id || null,
    status: record?.status || "unknown",
    activeCount: activeGroupCount,
    queuedCount: queuedGroupIds().length,
    maxConcurrent: MAX_CONCURRENT,
    queuePosition: id ? getPosition(id) : null,
    waitMs: record ? now() - record.enqueuedAt : 0,
    maxQueueWaitMs: MAX_QUEUE_WAIT_MS,
  };
};

const startItem = (item) => {
  const index = queue.findIndex((queued) => queued.id === item.id);
  if (index !== -1) {
    queue.splice(index, 1);
  }

  const group = activeGroups.get(item.groupId);
  group.running += 1;
  group.expected = Math.max(group.expected, item.expectedSize);

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

const startGroup = (groupId) => {
  const items = queue.filter((item) => item.groupId === groupId);
  createActiveGroup(
    groupId,
    Math.max(...items.map((item) => item.expectedSize), 1)
  );
  for (const item of items) {
    startItem(item);
  }
};

const startNext = () => {
  cleanupRecords();

  while (activeGroupCount < MAX_CONCURRENT && queue.length > 0) {
    startGroup(queuedGroupIds()[0]);
  }
};

export const waitForAccessibilityQueueTurn = (
  id,
  groupId = id,
  expectedSize = 1
) => {
  cleanupRecords();
  const normalizedExpectedSize = Math.max(1, Number.parseInt(expectedSize, 10) || 1);

  if (activeGroups.has(groupId)) {
    const timestamp = now();
    const group = activeGroups.get(groupId);
    group.running += 1;
    group.expected = Math.max(group.expected, normalizedExpectedSize);

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

  if (activeGroupCount < MAX_CONCURRENT) {
    const timestamp = now();
    createActiveGroup(groupId, normalizedExpectedSize);
    activeGroups.get(groupId).running += 1;

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
  const groups = queuedGroupIds();
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
      expectedSize: normalizedExpectedSize,
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
  const group = activeGroups.get(groupId);

  if (group) {
    group.running = Math.max(0, group.running - 1);
    group.completed += 1;

    if (group.completed >= group.expected) {
      activeGroups.delete(groupId);
      if (activeGroupCount > 0) {
        activeGroupCount -= 1;
      }
    }
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
