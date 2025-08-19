// Minimal stub for generated Supabase Database types.
// Replace this file by running:
//   npx supabase gen types typescript --project-id <your-project-ref> > src/types/supabase.ts

export type Database = {
  public: {
    Tables: {
      deck_imports: {
        Row: {
          id: number;
          user_id: string;
          deck_id: number;
          file_hash: string;
          source: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          deck_id: number;
          file_hash: string;
          source?: string | null;
        };
        Update: {
          user_id?: string;
          deck_id?: number;
          file_hash?: string;
          source?: string | null;
        };
      };
    };
  };
};
