import AppLogoIcon from '@/components/app-logo-icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@inertiajs/react';
import { type PropsWithChildren } from 'react';

export default function AuthCardLayout({
    children,
    title,
    description,
}: PropsWithChildren<{
    name?: string;
    title?: string;
    description?: string;
}>) {
    return (
        <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-4 p-6 md:p-8">
            <div className="flex w-full max-w-md flex-col gap-4">
                <Link href={route('home')} className="flex items-center gap-2 self-center font-medium">
                    <div className="">
                        <AppLogoIcon className="size-9 fill-current text-black dark:text-white" />
                    </div>
                </Link>

                <div className="flex flex-col gap-4">
                    <Card className="rounded-xl">
                        <CardHeader className="px-8 pt-6 pb-0 text-center">
                            <CardTitle className="mb-2 text-2xl sm:text-3xl font-bold text-gray-900">{title}</CardTitle>
                            <CardDescription className="text-gray-600 text-sm sm:text-base">{description}</CardDescription>
                        </CardHeader>
                        <CardContent className="px-8">{children}</CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
