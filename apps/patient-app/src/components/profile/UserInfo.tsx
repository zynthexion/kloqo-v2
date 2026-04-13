'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserInfoProps {
    user: any;
    initials: string;
}

export function UserInfo({ user, initials }: UserInfoProps) {
    return (
        <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                    {initials}
                </AvatarFallback>
            </Avatar>
            <div>
                <h2 className="text-2xl font-bold">{user?.name || user?.displayName || 'User'}</h2>
                <p className="text-muted-foreground">{user?.phoneNumber}</p>
                {user?.place && <p className="text-sm text-muted-foreground">{user.place}</p>}
            </div>
        </div>
    );
}
