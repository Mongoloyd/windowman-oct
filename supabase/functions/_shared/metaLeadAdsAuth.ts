/** Server-to-server gate for cron workers whose gateway JWT check is disabled. */
export function authorizeMetaWorker(
  request: Request,
  workerSecret: string | undefined,
): boolean {
  if (!workerSecret) return false;
  const supplied = request.headers.get("x-meta-worker-secret") ?? "";
  const left = new TextEncoder().encode(supplied);
  const right = new TextEncoder().encode(workerSecret);
  let different = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    different |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return different === 0;
}
