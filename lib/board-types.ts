export type Priority = "low" | "medium" | "high";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type BoardColumn = {
  id: string;
  workspace_id: string;
  title: string;
  position: number;
};

export type Task = {
  id: string;
  workspace_id: string;
  column_id: string;
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
  position: number;
  created_by: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Member = {
  workspace_id: string;
  user_id: string;
  role: "owner" | "member";
  profiles: Profile;
};

export type Activity = {
  id: number;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: { title?: string; name?: string; email?: string };
  created_at: string;
};

