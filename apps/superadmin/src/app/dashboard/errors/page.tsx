'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchErrorLogs, firestoreTimestampToDate } from '@/lib/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ErrorLog, ErrorStats } from '@kloqo/shared';
import { format, subDays, isAfter } from 'date-fns';
import { AlertTriangle, Search, Filter, RefreshCw, ChevronDown, ChevronUp, X, Smartphone, Laptop, Stethoscope, ChevronLeft, ChevronRight } from 'lucide-react';

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type AppFilter = 'all' | 'patient-app' | 'nurse-app' | 'clinic-admin';

function getErrorDate(timestamp: any): Date | null {
  return firestoreTimestampToDate(timestamp);
}

export default function ErrorLogsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [appFilter, setAppFilter] = useState<AppFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<'all' | '24h' | '7d' | '30d'>('7d');

  const stats = useMemo<ErrorStats>(() => {
    // Note: Since we are paginating, these stats are only for the current page
    // In a real production app, these would come from the backend meta
    const now = new Date();
    
    return {
      total: totalCount,
      bySeverity: {
        critical: errors.filter((e) => e.severity === 'critical').length,
        high: errors.filter((e) => e.severity === 'high').length,
        medium: errors.filter((e) => e.severity === 'medium').length,
        low: errors.filter((e) => e.severity === 'low').length,
      },
      byApp: {
        'patient-app': errors.filter((e) => e.appName === 'patient-app').length,
        'nurse-app': errors.filter((e) => e.appName === 'nurse-app').length,
        'clinic-admin': errors.filter((e) => e.appName === 'clinic-admin').length,
      },
      today: 0, // Simplified as we don't have full dataset
      last24Hours: 0,
    };
  }, [errors, totalCount]);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const res = await fetchErrorLogs(page, limit);
      if (Array.isArray(res)) {
        setErrors(res);
        setTotalCount(res.length);
      } else {
        setErrors(res.data);
        setTotalCount(res.total);
      }
    } catch (error) {
      console.error('Error fetching errors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadErrors();
    const interval = setInterval(loadErrors, 60000);
    return () => clearInterval(interval);
  }, [page]);

  const totalPages = Math.ceil(totalCount / limit);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  const filteredErrors = useMemo(() => {
    let filtered = errors;

    if (dateRange !== 'all') {
      const cutoffDate = subDays(new Date(), 
        dateRange === '24h' ? 1 : dateRange === '7d' ? 7 : 30
      );
      filtered = filtered.filter((error) => {
        const errorDate = getErrorDate(error.timestamp);
        if (!errorDate) return false;
        try {
          return isAfter(errorDate, cutoffDate);
        } catch (error) {
          return false;
        }
      });
    }

    return filtered.filter((error) => {
      if (severityFilter !== 'all' && error.severity !== severityFilter) return false;
      if (appFilter !== 'all' && error.appName !== appFilter) return false;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          error.error.message.toLowerCase().includes(searchLower) ||
          error.error.name.toLowerCase().includes(searchLower) ||
          error.context.page?.toLowerCase().includes(searchLower) ||
          error.context.userId?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [errors, severityFilter, appFilter, searchTerm, dateRange]);

  const toggleExpanded = (errorId: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(errorId)) {
        next.delete(errorId);
      } else {
        next.add(errorId);
      }
      return next;
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getAppIcon = (appName: string) => {
    switch (appName) {
      case 'patient-app': return <Smartphone className="h-4 w-4" />;
      case 'nurse-app': return <Stethoscope className="h-4 w-4" />;
      case 'clinic-admin': return <Laptop className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Error Logs</h1>
        <p className="text-muted-foreground mt-1">Monitor and debug application errors</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Errors</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.last24Hours} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critical</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.bySeverity.critical}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">High Priority</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today</CardDescription>
            <CardTitle className="text-3xl">{stats.today}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Errors logged today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>By App</CardDescription>
            <CardTitle className="text-sm text-muted-foreground">
              Patient: {stats.byApp['patient-app']} | Nurse: {stats.byApp['nurse-app']} | Admin: {stats.byApp['clinic-admin']}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Error Logs</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showFilters && (
            <div className="space-y-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <Input
                    placeholder="Search errors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Severity</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">App</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={appFilter}
                    onChange={(e) => setAppFilter(e.target.value as AppFilter)}
                  >
                    <option value="all">All Apps</option>
                    <option value="patient-app">Patient App</option>
                    <option value="nurse-app">Nurse App</option>
                    <option value="clinic-admin">Clinic Admin</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <div className="flex gap-2">
                  {(['all', '24h', '7d', '30d'] as const).map((range) => (
                    <Button
                      key={range}
                      variant={dateRange === range ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDateRange(range)}
                    >
                      {range === 'all' ? 'All Time' : range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
              <p className="text-muted-foreground">Loading errors...</p>
            </div>
          ) : filteredErrors.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No errors found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredErrors.map((error) => {
                const errorDate = getErrorDate(error.timestamp);
                const isExpanded = expandedErrors.has(error.id);

                return (
                  <Card key={error.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getSeverityColor(error.severity)}>
                              {error.severity}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getAppIcon(error.appName)}
                              {error.appName}
                            </Badge>
                            {errorDate && (
                              <span className="text-xs text-muted-foreground">
                                {format(errorDate, 'MMM d, yyyy HH:mm')}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-sm">{error.error.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {error.error.message}
                          </p>
                          {error.context.page && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Page: {error.context.page}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(error.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="space-y-2">
                            {error.error.stack && (
                              <div>
                                <p className="text-xs font-semibold mb-1">Stack Trace:</p>
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                                  {error.error.stack}
                                </pre>
                              </div>
                            )}
                            {error.context.userId && (
                              <p className="text-xs">
                                <span className="font-semibold">User ID:</span> {error.context.userId}
                              </p>
                            )}
                            {error.context.url && (
                              <p className="text-xs">
                                <span className="font-semibold">URL:</span> {error.context.url}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="text-xs text-muted-foreground">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} logs
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center px-2 text-xs font-medium">
                Page {page} of {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={page >= totalPages || loading}
                className="h-8 px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

