'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, MousePointerClick, Users, Clock, ChevronLeft, ChevronRight, Calendar, RefreshCw } from 'lucide-react';
import { fetchMarketingAnalytics, searchPatientJourney } from '@/lib/analytics';
import { CampaignMetrics, MarketingAnalytics } from '@kloqo/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DatePreset = 'all' | 'today' | '7days' | 'month' | 'custom';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function MarketingDashboard() {
    const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [searchPhone, setSearchPhone] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchResults, setSearchResults] = useState<MarketingAnalytics[]>([]);
    const [windowStatus, setWindowStatus] = useState<{ open: boolean; lastMsg: any } | null>(null);
    const [windowStatuses, setWindowStatuses] = useState<Record<string, boolean>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Date range state
    const [preset, setPreset] = useState<DatePreset>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setCampaigns([]);
        setRecentActivity([]);
        setCurrentPage(1);

        try {
            let start: string | undefined;
            let end: string | undefined;

            if (preset !== 'all') {
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

                if (preset === 'today') {
                    start = todayMidnight.toISOString();
                    end = now.toISOString();
                } else if (preset === '7days') {
                    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                    end = now.toISOString();
                } else if (preset === 'month') {
                    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
                    end = now.toISOString();
                } else if (preset === 'custom' && customStart && customEnd) {
                    start = new Date(customStart).toISOString();
                    end = new Date(customEnd + 'T23:59:59').toISOString();
                }
            }

            const data = await fetchMarketingAnalytics(start, end);
            setCampaigns(data.campaigns || []);
            setRecentActivity(data.recentActivity || []);
            setWindowStatuses(data.windowStatuses || {});
        } catch (error) {
            console.error('[Marketing] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }, [preset, customStart, customEnd]);

    useEffect(() => {
        if (preset !== 'custom') {
            loadData();
        }
    }, [preset, loadData]);

    // ------------------------------------------------------------------
    // Patient journey search
    // ------------------------------------------------------------------
    async function handleSearch() {
        if (!searchPhone.trim()) return;
        setLoading(true);
        try {
            const data = await searchPatientJourney(searchPhone);
            setSearchResults(data.searchResults || []);
            setWindowStatus(data.windowStatus || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }


    // ------------------------------------------------------------------
    // Derived totals
    // ------------------------------------------------------------------
    const totalClicks = campaigns.reduce((s, c) => s + c.totalClicks, 0);
    const totalSent = campaigns.reduce((s, c) => s + c.totalLinksSent, 0);
    const totalActions = campaigns.reduce((s, c) => s + c.totalActions, 0);
    const overallCTR = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : '0';
    const overallConversion = totalClicks > 0 ? ((totalActions / totalClicks) * 100).toFixed(1) : '0';
    const avgDuration = campaigns.length > 0
        ? (campaigns.reduce((s, c) => s + c.avgSessionDuration, 0) / campaigns.length).toFixed(0)
        : '0';

    const totalPages = Math.ceil(recentActivity.length / itemsPerPage);
    const paginatedActivity = recentActivity.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // ------------------------------------------------------------------
    // Preset labels
    // ------------------------------------------------------------------
    const presets: { key: DatePreset; label: string }[] = [
        { key: 'all', label: 'All Time' },
        { key: 'today', label: 'Today' },
        { key: '7days', label: 'Last 7 Days' },
        { key: 'month', label: 'This Month' },
        { key: 'custom', label: 'Custom' },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Marketing Analytics</h1>
                <p className="text-muted-foreground">Track WhatsApp campaign performance and patient engagement</p>
            </div>

            {/* Date Range Selector */}
            <Card>
                <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex flex-wrap gap-2">
                            {presets.map(p => (
                                <Button
                                    key={p.key}
                                    variant={preset === p.key ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPreset(p.key)}
                                >
                                    {p.label}
                                </Button>
                            ))}
                        </div>

                        {preset === 'custom' && (
                            <div className="flex items-center gap-2 ml-2">
                                <Input
                                    type="date"
                                    className="w-36 h-8 text-sm"
                                    value={customStart}
                                    onChange={e => setCustomStart(e.target.value)}
                                />
                                <span className="text-muted-foreground text-sm">to</span>
                                <Input
                                    type="date"
                                    className="w-36 h-8 text-sm"
                                    value={customEnd}
                                    onChange={e => setCustomEnd(e.target.value)}
                                />
                                <Button size="sm" onClick={loadData} disabled={!customStart || !customEnd}>
                                    Apply
                                </Button>
                            </div>
                        )}

                        <Button variant="ghost" size="sm" className="ml-auto" onClick={loadData} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                        <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">From {totalSent.toLocaleString()} sent</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overallCTR}%</div>
                        <p className="text-xs text-muted-foreground">Target: 20%+</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overallConversion}%</div>
                        <p className="text-xs text-muted-foreground">{totalActions} actions taken</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgDuration}s</div>
                        <p className="text-xs text-muted-foreground">Target: 180s+ (3 min)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Campaign Performance Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Campaign Performance</CardTitle>
                    <CardDescription>Compare performance across all WhatsApp campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No campaign data for this date range.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign</TableHead>
                                    <TableHead>Medium</TableHead>
                                    <TableHead className="text-right">Sent</TableHead>
                                    <TableHead className="text-right">Clicks</TableHead>
                                    <TableHead className="text-right">CTR</TableHead>
                                    <TableHead className="text-right">Sessions</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                    <TableHead className="text-right">Conv Rate</TableHead>
                                    <TableHead className="text-right">Avg Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.map((campaign) => (
                                    <TableRow key={campaign.ref}>
                                        <TableCell className="font-medium">{campaign.campaign}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700">
                                                {campaign.medium}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">{campaign.totalLinksSent.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{campaign.totalClicks.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={campaign.ctr >= 20 ? 'text-green-600 font-semibold' : ''}>
                                                {campaign.ctr.toFixed(1)}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">{campaign.totalSessions.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{campaign.totalActions.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={campaign.conversionRate >= 30 ? 'text-green-600 font-semibold' : ''}>
                                                {campaign.conversionRate.toFixed(1)}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">{Math.round(campaign.avgSessionDuration)}s</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Recent Activity Feed */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Messages &amp; Activity</CardTitle>
                    <CardDescription>Live feed of sent messages, link clicks, and button replies</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading activity...</div>
                    ) : recentActivity.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No recent activity found.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Activity</TableHead>
                                    <TableHead>Campaign</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedActivity.map((act: any) => {
                                    const time = act.sentAt || act.sessionStart || act.timestamp;
                                    const date = time ? new Date(time) : null;
                                    const normalized = act.phone || null;
                                    const isWindowOpen = normalized ? windowStatuses[normalized] : false;

                                    return (
                                        <TableRow key={act.id}>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {date ? date.toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                }) : 'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {act.patientName && act.patientName !== 'Sinsha' ? act.patientName : (
                                                        act.phone ? act.phone : (
                                                            <div className="flex flex-col">
                                                                <span className="text-sm">Visitor</span>
                                                                <span className="text-muted-foreground text-[10px] font-mono">
                                                                    {(act.visitorId || act.sessionId)?.split('_')[1]?.substring(0, 8) || (act.visitorId || act.sessionId)?.substring(0, 8) || 'unknown'}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                                {act.patientName && <div className="text-xs text-muted-foreground">{act.phone}</div>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {act.type === 'send' && (
                                                        <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium bg-gray-100 text-gray-700 w-fit">Sent</span>
                                                    )}
                                                    {act.type === 'click' && (
                                                        <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium bg-blue-100 text-blue-700 w-fit">Clicked Link</span>
                                                    )}
                                                    {act.type === 'button' && (
                                                        <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium bg-green-100 text-green-700 w-fit">Replied</span>
                                                    )}
                                                    {isWindowOpen && (
                                                        <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold bg-emerald-500 text-white w-fit animate-pulse">24h OPEN</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate">
                                                {act.type === 'send' && 'WhatsApp Message Out'}
                                                {act.type === 'click' && `Visited ${act.pageCount} pages (${act.sessionDuration}s)`}
                                                {act.type === 'button' && `Button: "${act.buttonText}"`}
                                            </TableCell>
                                            <TableCell className="text-xs">{act.campaign || act.ref || '--'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}

                    {!loading && recentActivity.length > itemsPerPage && (
                        <div className="flex items-center justify-between mt-4 border-t pt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, recentActivity.length)} of {recentActivity.length} events
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Individual Patient Search */}
            <Card>
                <CardHeader>
                    <CardTitle>Patient Journey Tracking</CardTitle>
                    <CardDescription>Search by phone number to see complete engagement history</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Enter phone number (e.g., +919074297611)"
                            value={searchPhone}
                            onChange={e => setSearchPhone(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch}>
                            <Search className="h-4 w-4 mr-2" /> Search
                        </Button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Found {searchResults.length} sessions</h3>
                                {windowStatus && (
                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${windowStatus.open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        <Clock className="h-3 w-3" />
                                        24h Window: {windowStatus.open ? 'OPEN' : 'CLOSED'}
                                        <span className="text-[10px] opacity-70 ml-1">
                                            (Last msg: {new Date(windowStatus.lastMsg).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})
                                        </span>
                                    </div>
                                )}
                            </div>
                            {searchResults.map((session, idx) => (
                                <Card key={idx}>
                                    <CardContent className="pt-6">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div><p className="text-muted-foreground">Campaign</p><p className="font-medium">{session.campaign}</p></div>
                                            <div><p className="text-muted-foreground">Duration</p><p className="font-medium">{session.sessionDuration}s</p></div>
                                            <div><p className="text-muted-foreground">Pages Visited</p><p className="font-medium">{session.pageCount} pages</p></div>
                                            <div><p className="text-muted-foreground">Device</p><p className="font-medium capitalize">{session.deviceType}</p></div>
                                            <div className="col-span-2"><p className="text-muted-foreground">Page Flow</p><p className="font-medium text-xs">{session.pageFlow || 'N/A'}</p></div>
                                            {session.actions && session.actions.length > 0 && (
                                                <div className="col-span-2">
                                                    <p className="text-muted-foreground">Actions</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {session.actions.map((action, i) => (
                                                            <span key={i} className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700">{action}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {!loading && searchResults.length === 0 && searchPhone && (
                        <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
                            No journey data found for "{searchPhone}".
                            <br /><span className="text-xs opacity-60">(Try a phone number that has clicked a marketing link)</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
