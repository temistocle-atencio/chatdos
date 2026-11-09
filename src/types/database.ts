export interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_path: string | null;
  public_key: Record<string, unknown> | null;
  last_seen: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ChatItem {
  chat_id: string;
  partner: Profile;
}
