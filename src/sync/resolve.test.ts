import { expect, it } from 'vitest';
import { syncResolve } from './resolve';

it.each([
  [100, { updated_at: 200, deleted: false }, 'put'],     // 서버가 더 새로움
  [300, { updated_at: 200, deleted: false }, 'skip'],    // 로컬이 더 새로움
  [200, { updated_at: 200, deleted: false }, 'skip'],    // 같으면 그대로
  [0, { updated_at: 50, deleted: true }, 'delete'],      // 서버의 더 새로운 삭제
  [-1, { updated_at: 0, deleted: false }, 'put'],        // 로컬에 없음
] as const)('local %i, remote %o → %s', (local, remote, expected) => {
  expect(syncResolve(local, remote)).toBe(expected);
});
