// Shared types for KITT Portal

export interface NavItem {
  to: string
  icon: string
  label: string
}

export type TaskState = 'backlog' | 'todo' | 'in_progress' | 'done' | 'canceled'
export type TaskPriority = 'high' | 'medium' | 'low'
export type TaskType = 'feature' | 'bug' | 'improvement'

export interface Issue {
  id: number
  identifier: string
  title: string
  description?: string
  type: TaskType
  state: TaskState
  priority: TaskPriority
  projectId: number
  cycleId?: number
  estimate?: number
  dueDate?: number
  parentId?: number
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: number
  identifier: string
  name: string
  description?: string
  color: string
  createdAt: number
}

export interface Cycle {
  id: number
  name: string
  startDate: number
  endDate: number
  status: 'upcoming' | 'active' | 'completed'
  createdAt: number
}
