# Sprint 3 Plan: Core Task Features

**Status:** In Progress (one task remaining)
**Goal:** Complete core task management features (editing, categories, permanent tasks)

---

## Overview

Finish the foundational task management features before moving to statistics and polish.

---

## Tasks

### 3.1 Edit Task (Name + Due Date)
**Priority:** High
**Status:** [x] Complete

Allow users to edit task name and due date via popup modal.

**Requirements:**
- [x] Tap task body to open edit modal
- [x] Edit task name
- [x] Date picker to change due date
- [x] Save changes to database via reassignTask

**Files:**
- [x] Created `EditTaskModal.tsx` - popup modal with title input + date picker
- [x] Updated `TaskItem.tsx` - added onEdit callback, tappable body, due date display
- [x] Updated `TaskList.tsx` - passes onEdit to TaskItem
- [x] Updated `useTasks.ts` - added editTask() calling reassignTask
- [x] Updated `AllTasksScreen.tsx` - wired edit modal
- [x] Updated `TodayScreen.tsx` - wired edit modal

**See:** `SPRINT_3_1_COMPLETE.md` for implementation details

---

### 3.2 Category Persistence
**Priority:** High
**Status:** [x] Complete

Categories have their own table with CRUD operations and stats queries.

**Requirements:**
- [x] Categories table with id, name, color, icon, is_default, created_at
- [x] category_id column in tasks table
- [x] completed_at column in tasks table (for Sprint 4 stats)
- [x] Storage layer with CRUD + stats queries
- [x] Default categories seeded: Lifestyle, Work, Health

**Files:**
- [x] `app/core/services/storage/schema/categories.ts` - table schema + seeding
- [x] `app/core/services/storage/schema/core.ts` - added category_id, completed_at columns
- [x] `app/core/services/storage/categoryStorage.ts` - CRUD + stats queries
- [x] `app/core/services/storage/taskStorage.ts` - reads/writes categoryId, completedAt

**See:** `SPRINT_3_2_3_COMPLETE.md` for implementation details

---

### 3.3 User-Created Categories
**Priority:** Medium
**Status:** [x] Complete

Category feature module with types, actions, and hooks.

**Requirements:**
- [x] Category types with factory
- [x] Business logic in categoryActions.ts
- [x] useCategories hook for UI
- [x] CreateTaskScreen wired to real categories
- [x] Categories display with color indicators

**Files:**
- [x] `app/features/categories/types/category.ts` - Category, CategoryStats, CategoryFactory
- [x] `app/features/categories/utils/categoryActions.ts` - business logic
- [x] `app/features/categories/hooks/useCategories.ts` - React hook
- [x] `app/features/categories/index.ts` - public API
- [x] `app/screens/tasks/CreateTaskScreen.tsx` - wired to useCategories

---

### 3.4 Category Selector Component
**Priority:** Medium
**Status:** [x] Complete

Reusable CategorySelector component for both one-off and permanent tasks.

**Requirements:**
- [x] Extract category UI into reusable component
- [x] CategorySelector used in CreateTaskScreen
- [x] CategorySelector used in CreatePermanentTaskScreen

**Files:**
- [x] `app/components/categories/CategorySelector.tsx` - reusable component
- [x] `app/screens/tasks/CreateTaskScreen.tsx` - uses CategorySelector
- [x] `app/screens/tasks/CreatePermanentTaskScreen.tsx` - uses CategorySelector

---

### 3.5 Permanent Task Category Backend
**Priority:** High
**Status:** [x] Complete

Wire categoryId to permanent task storage and ensure completion updates stats.

**Requirements:**
- [x] Add categoryId to permanent_templates table
- [x] Add categoryId to permanent_instances table
- [x] Update permanentTaskStorage to save/read categoryId
- [x] Update handlePermanentCompletion to set completedAt
- [x] Ensure permanent task completion counts toward category stats

**Files:**
- [x] `app/core/services/storage/schema/permanentTask.ts`
- [x] `app/core/services/storage/permanentTaskStorage.ts`
- [x] `app/features/permanentTask/utils/permanentTaskActions.ts`

---

### 3.6 Manage Categories (Browse Section)
**Priority:** Medium
**Status:** [ ] Not Started

Add category management UI to Browse screen with full CRUD operations.

**Requirements:**
- [ ] Browse screen shows list of feature options (Categories first)
- [ ] Tap "Categories" to open category management view
- [ ] View all categories with color indicators
- [ ] Create new category (name, color picker)
- [ ] Edit existing category (name, color)
- [ ] Delete category (with confirmation)
- [ ] Show task count per category

**UI Flow:**
```
BrowseScreen
  └── Feature List
        ├── "Categories" → CategoryManagementScreen
        ├── "Templates" → (future)
        └── "Settings" → (future)

CategoryManagementScreen
  ├── Header: "Manage Categories" + "Add" button
  ├── List of categories (color dot + name + task count)
  │     └── Tap → Edit modal
  │     └── Swipe/Delete button → Confirm delete
  └── Add Category Modal (name input + color picker)
```

**Files:**
- [ ] `app/screens/browse/BrowseScreen.tsx` - update with feature list
- [ ] `app/screens/browse/CategoryManagementScreen.tsx` - new screen
- [ ] `app/components/categories/CategoryListItem.tsx` - list item with edit/delete
- [ ] `app/components/categories/AddCategoryModal.tsx` - create/edit modal

---

### 3.7 Edit Permanent Task Templates
**Status:** Moved to Sprint 5

### 3.8 Delete Permanent Task Templates
**Status:** Moved to Sprint 5

### 3.5 Delete Permanent Task Templates
**Status:** Moved to Sprint 5

---

## Task Checklist Summary

### High Priority
- [x] 3.1 Edit task (name + due date)
- [x] 3.2 Category persistence (table + storage)
- [x] 3.5 Permanent task category backend

### Medium Priority
- [x] 3.3 User-created categories (feature module)
- [x] 3.4 CategorySelector component (reusable UI)
- [ ] 3.6 Manage Categories (Browse section CRUD)
- [→] 3.7 Edit permanent task templates (moved to Sprint 5)
- [→] 3.8 Delete permanent task templates (moved to Sprint 5)

---

## Schema Changes

### Completed
```sql
-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  is_default INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Tasks table additions
ALTER TABLE tasks ADD COLUMN category_id TEXT;
ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
```

### Remaining (3.5)
```sql
-- Permanent templates table
ALTER TABLE permanent_templates ADD COLUMN category_id TEXT;

-- Permanent instances table
ALTER TABLE permanent_instances ADD COLUMN category_id TEXT;
```

---

## Success Criteria

- [x] Users can edit task name and due dates
- [x] Categories persist after app restart
- [x] Users can select categories when creating one-off tasks
- [x] Users can select categories when creating permanent task templates
- [x] Default categories (Lifestyle, Work, Health) seeded on first launch
- [x] CategorySelector is reusable across screens
- [x] Permanent task categoryId saved to database
- [x] Permanent task completion updates category stats
- [ ] Users can create new categories from Browse
- [ ] Users can edit category name/color from Browse
- [ ] Users can delete categories from Browse
- [ ] No data loss or corruption

---

## Dependencies

- None — builds on existing Sprint 2 foundation

---

## Notes

- Keep UI minimal for now (Sprint 5 handles polish)
- Focus on functionality over aesthetics
- Test all database operations thoroughly
