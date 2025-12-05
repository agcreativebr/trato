import Link from 'next/link';

export function Topbar() {
	return (
		<div className="sticky top-0 z-40 bg-white/70 backdrop-blur border-b">
			<div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-600 to-fuchsia-500" />
					<Link href="/dashboard" className="font-semibold">
						KanbanPro
					</Link>
				</div>
				<nav className="text-sm text-neutral-600">
					<Link className="hover:text-neutral-900" href="/dashboard">
						Dashboard
					</Link>
				</nav>
			</div>
		</div>
	);
}


