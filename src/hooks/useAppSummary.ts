import {useCallback, useEffect, useState} from 'react';
import {getDashboardSummary} from '../db/database';
import type {DashboardSummary} from '../types/cricket';

const INITIAL_SUMMARY: DashboardSummary = {
  teamsCount: 0,
  playersCount: 0,
  matchesCount: 0,
  liveMatches: [],
  completedMatchesCount: 0,
  tournamentsCount: 0,
  totalRecords: 0,
  storageReady: false,
};

export function useAppSummary() {
  const [summary, setSummary] = useState<DashboardSummary>(INITIAL_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await getDashboardSummary();
    setSummary(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {summary, isLoading, refresh};
}
