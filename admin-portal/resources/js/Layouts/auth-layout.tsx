import React from 'react';
import AuthLayoutTemplate from '@/layouts/auth/auth-card-layout';
import { motion } from 'motion/react';
import { usePage } from '@inertiajs/react';

export default function AuthLayout({ children, title, description, ...props }: { children: React.ReactNode; title: string; description: string }) {
    const { component } = usePage();
    
    return (
        <AuthLayoutTemplate title={title} description={description} {...props}>
            <motion.div
                key={component}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
            >
                {children}
            </motion.div>
        </AuthLayoutTemplate>
    );
}
