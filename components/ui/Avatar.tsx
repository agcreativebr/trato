import * as React from 'react';
import clsx from 'classnames';

export function Avatar({
	size = 24,
	src,
	name
}: {
	size?: number;
	src?: string | null;
	name?: string | null;
}) {
	const initials =
		(name ?? '')
			.split(' ')
			.slice(0, 2)
			.map((s) => s.charAt(0).toUpperCase())
			.join('') || 'U';
	return (
		<div
			style={{ width: size, height: size }}
			className={clsx('rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center overflow-hidden text-[10px]')}
			title={name ?? undefined}
		>
			{src ? <img src={src} alt={name ?? 'avatar'} className="w-full h-full object-cover" /> : initials}
		</div>
	);
}

export function AvatarStack({ users, size = 20 }: { users: Array<{ name?: string | null; avatar_url?: string | null }>; size?: number }) {
	return (
		<div className="flex -space-x-2">
			{users.slice(0, 3).map((u, i) => (
				<div key={i} className="ring-2 ring-white rounded-full">
					<Avatar size={size} name={u.name ?? undefined} src={u.avatar_url ?? undefined} />
				</div>
			))}
			{users.length > 3 && (
				<div className="w-5 h-5 rounded-full bg-neutral-200 text-[10px] flex items-center justify-center ring-2 ring-white">+{users.length - 3}</div>
			)}
		</div>
	);
}


