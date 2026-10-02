import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getReportBreakdown, getReportOutstanding, listPropertyChoices, type ReportFilters, type ReportGroup } from '../../services/reportService'

export const useReportBreakdown = (group: ReportGroup, f: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report-breakdown', group, f], queryFn: () => getReportBreakdown(group, f), placeholderData: keepPreviousData, staleTime: 0, enabled })

export const useReportOutstanding = (f: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report-outstanding', f], queryFn: () => getReportOutstanding(f), placeholderData: keepPreviousData, staleTime: 0, enabled })

export const usePropertyChoices = () => useQuery({ queryKey: ['property-choices'], queryFn: listPropertyChoices })
