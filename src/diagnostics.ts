import { existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { monitorEventLoopDelay } from 'perf_hooks';
import { getHeapStatistics } from 'v8';
import { Express } from 'express';

const INTERVAL = 30e3;
const SLOW_HEALTH_CHECK = 1e3;

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

function ms(nanoseconds: number): string {
  return (nanoseconds / 1e6).toFixed();
}

function format(fields: Record<string, string | number>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
}

function readLimit(file: string): number {
  return existsSync(file) ? Number(readFileSync(file, 'utf8')) : NaN;
}

function cgroupMemoryLimit(): string {
  const limits = [readLimit('/sys/fs/cgroup/memory/memory.limit_in_bytes')];
  const own = existsSync('/proc/self/cgroup')
    ? readFileSync('/proc/self/cgroup', 'utf8').match(/^0::(.*)$/m)
    : null;
  let path = own?.[1];
  while (path) {
    limits.push(readLimit(`/sys/fs/cgroup${path}/memory.max`));
    path = path === '/' ? '' : dirname(path);
  }
  const limit = Math.min(...limits.filter(n => !isNaN(n)));
  return isFinite(limit) ? mb(limit) : 'none';
}

export function memoryLine(): string {
  const { rss, heapUsed, heapTotal, external } = process.memoryUsage();
  return format({
    uptime_s: process.uptime().toFixed(),
    rss_mb: mb(rss),
    heap_used_mb: mb(heapUsed),
    heap_total_mb: mb(heapTotal),
    external_mb: mb(external)
  });
}

function logSlowHealthCheck(req, res, next) {
  if (req.method !== 'GET' || req.path !== '/') return next();

  const start = Date.now();
  res.on('close', () => {
    const duration = Date.now() - start;
    if (res.writableFinished && duration < SLOW_HEALTH_CHECK) return;
    const status = res.writableFinished ? res.statusCode : 'aborted';
    console.log(
      '[diag] slow health check',
      format({ duration_ms: duration, status })
    );
  });
  next();
}

export default function initDiagnostics(app: Express) {
  console.log(
    '[diag] start',
    format({
      node: process.version,
      pid: process.pid,
      heap_limit_mb: mb(getHeapStatistics().heap_size_limit),
      cgroup_limit_mb: cgroupMemoryLimit()
    }),
    memoryLine()
  );

  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  setInterval(() => {
    console.log(
      '[diag]',
      memoryLine(),
      format({
        loop_max_ms: ms(loop.max),
        loop_p99_ms: ms(loop.percentile(99))
      })
    );
    loop.reset();
  }, INTERVAL).unref();

  app.use(logSlowHealthCheck);
}
