'use client';

import { MapPin, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { NotificationHistory } from '@/components/notification-history';
import type { SearchResult } from '@/hooks/use-home-state';
import { Doctor } from '@kloqo/shared';

interface HomeHeaderProps {
    user: any;
    t: any;
    location: string;
    isRefreshingLocation: boolean;
    refreshLocation: () => void;
    searchQuery: string;
    searchResults: SearchResult[];
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onResultClick: (result: SearchResult) => void;
    language: string;
}

export function HomeHeader({
    user, t, location, isRefreshingLocation, refreshLocation,
    searchQuery, searchResults, onSearchChange, onClearSearch, onResultClick, language
}: HomeHeaderProps) {
    return (
        <div className="bg-primary text-primary-foreground p-6 rounded-b-[2rem] pb-24">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold">{t.home.hello}, {user?.name || user?.displayName || t.home.user}</h1>
                    <div
                        className="flex items-center gap-2 text-sm min-h-[20px] cursor-pointer hover:opacity-80 transition-opacity select-none"
                        onClick={!isRefreshingLocation ? refreshLocation : undefined}
                        role="button"
                    >
                        <div className="relative flex items-center justify-center w-5 h-5">
                            <span className="absolute inset-0 rounded-full bg-primary-foreground/40 animate-location-waves"></span>
                            <span className="absolute inset-0 rounded-full bg-primary-foreground/40 animate-location-waves [animation-delay:0.7s]"></span>
                            <MapPin className={`relative w-4 h-4 z-10 ${isRefreshingLocation ? 'animate-bounce' : ''}`} />
                        </div>
                        <span className="truncate max-w-[200px]">{location}</span>
                    </div>
                </div>
                <NotificationHistory />
            </div>

            <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                    placeholder={t.home.searchPlaceholder}
                    className="pl-10 h-12 bg-primary-foreground/20 placeholder:text-primary-foreground/70 border-0 focus-visible:ring-primary-foreground"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                {searchQuery && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={onClearSearch}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
                
                {searchResults.length > 0 && (
                    <Card className="absolute top-full mt-2 w-full z-10 max-h-60 overflow-y-auto">
                        <CardContent className="p-0">
                            {searchResults.map(result => (
                                <div
                                    key={`${result.type}-${result.id}`}
                                    className="flex items-center gap-4 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted"
                                    onClick={() => onResultClick(result)}
                                >
                                    <Avatar className="h-10 w-10">
                                        {result.avatar && <AvatarImage src={result.avatar} alt={result.name} />}
                                        <AvatarFallback>{result.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-grow">
                                        <p className="font-semibold text-card-foreground">{result.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {result.type === 'doctor' ? (result as Doctor).specialty : result.location}
                                        </p>
                                    </div>
                                    {result.type === 'clinic' && <Building2 className="h-5 w-5 text-muted-foreground ml-auto" />}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
