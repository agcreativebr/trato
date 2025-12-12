'use client';

import '@/styles/globals.css';
import React from 'react';
import { Inter } from 'next/font/google';
import { Topbar } from '@/components/Topbar';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			<body className={`${inter.className} h-screen overflow-hidden flex flex-col antialiased bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-50 via-white to-neutral-100`}>
				<Topbar />
				<div className="flex-1 min-h-0 overflow-hidden">
					{children}
				</div>
			</body>
		</html>
	);
}

