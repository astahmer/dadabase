export interface DbConnection {
	id: string;
	name: string;
	url: string;
	dialect: string;
	created_at: number;
	updated_at: number;
}
