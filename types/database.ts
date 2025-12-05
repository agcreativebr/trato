// Tipos básicos de tabelas usadas no app (simplificado para o MVP)
export type Tables = {
	users: {
		Row: { id: string; email: string | null; created_at: string };
	};
	workspaces: {
		Row: { id: string; name: string; created_at: string };
		Insert: { name: string };
	};
	boards: {
		Row: { id: string; name: string; workspace_id: string; created_at: string };
		Insert: { name: string; workspace_id: string };
	};
	lists: {
		Row: { id: string; name: string; board_id: string; position: number; created_at: string };
		Insert: { name: string; board_id: string; position: number };
		Update: Partial<{ name: string; position: number }>;
	};
	cards: {
		Row: {
			id: string;
			board_id: string;
			list_id: string;
			title: string;
			description: string | null;
			position: number;
			due_date: string | null;
			created_at: string;
			updated_at: string;
		};
		Insert: { board_id: string; list_id: string; title: string; position: number; description?: string | null; due_date?: string | null };
		Update: Partial<{ list_id: string; title: string; description: string | null; position: number; due_date: string | null }>;
	};
};


