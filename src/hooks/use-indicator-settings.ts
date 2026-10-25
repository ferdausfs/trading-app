/**
 * useIndicatorSettings — ইন্ডিকেটর টগল ও প্যারামিটার, DB-তে সংরক্ষিত।
 * অপটিমিস্টিক আপডেট + ডিবাউন্সড PUT (দ্রুত UI, কম রিকোয়েস্ট)।
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_INDICATOR_CONFIG,
  type IndicatorConfigMap,
  type IndicatorKey,
  type IndicatorSetting,
} from '@/lib/types';

const PERSIST_DEBOUNCE_MS = 600;

export interface IndicatorSettingsState {
  configs: IndicatorConfigMap | null;
  update: (key: IndicatorKey, patch: Partial<IndicatorSetting>) => void;
}

export function useIndicatorSettings(): IndicatorSettingsState {
  const [configs, setConfigs] = useState<IndicatorConfigMap | null>(null);
  const timers = useRef<Partial<Record<IndicatorKey, ReturnType<typeof setTimeout>>>>({});

  // প্রথম লোড
  useEffect(() => {
    let cancelled = false;
    fetch('/api/indicators')
      .then((r) => r.json())
      .then((res: { success: boolean; data?: Record<string, IndicatorSetting> }) => {
        if (cancelled) return;
        if (res.success && res.data) {
          // সার্ভারের ডেটার সাথে ডিফল্ট মার্জ (নতুন ফিল্ড যোগ হলেও কাজ করবে)
          const merged = { ...DEFAULT_INDICATOR_CONFIG };
          for (const key of Object.keys(merged) as IndicatorKey[]) {
            const remote = res.data[key];
            if (remote) {
              merged[key] = {
                key,
                enabled: remote.enabled,
                params: { ...merged[key].params, ...(remote.params as object) },
              };
            }
          }
          setConfigs(merged);
        } else {
          setConfigs(DEFAULT_INDICATOR_CONFIG);
        }
      })
      .catch(() => !cancelled && setConfigs(DEFAULT_INDICATOR_CONFIG));
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((setting: IndicatorSetting) => {
    const t = timers.current[setting.key];
    if (t) clearTimeout(t);
    timers.current[setting.key] = setTimeout(() => {
      fetch('/api/indicators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: setting.key, enabled: setting.enabled, params: setting.params }),
      }).catch(() => {});
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const update = useCallback(
    (key: IndicatorKey, patch: Partial<IndicatorSetting>) => {
      setConfigs((prev) => {
        if (!prev) return prev;
        const nextSetting: IndicatorSetting = {
          ...prev[key],
          ...patch,
          params:
            patch.params !== undefined
              ? ({ ...prev[key].params, ...patch.params } as IndicatorSetting['params'])
              : prev[key].params,
        };
        const next = { ...prev, [key]: nextSetting };
        persist(nextSetting);
        return next;
      });
    },
    [persist]
  );

  return { configs, update };
}
