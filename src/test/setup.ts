import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
// jsdom에는 scrollTo가 없다
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });
