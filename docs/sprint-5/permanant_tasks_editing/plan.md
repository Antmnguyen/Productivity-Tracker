# Permanent Task Template Editing — Sprint 5 Implementation Plan

**Goal:** Let users edit and delete permanent task templates from inside
`UsePermanentTaskScreen`. No new tab or screen needed — the template list
already exists; we just add a ⋮ menu to each row and wire up an edit screen.

---

## Architecture Overview (read this first)

```
MainNavigator (overlayScreen state)
    │
    ├── UsePermanentTaskScreen   ← lists templates, has ⋮ menu (ADD MENU HERE)
    │       │
    │       ├── tap row          → opens "Add Task" modal (existing)
    │       ├── tap ⋮ → Edit    → sets overlayScreen = 'EditPermanentTask'
    │       └── tap ⋮ → Delete  → Alert confirm → deletePermanentTask() → reload list
    │
    └── EditPermanentTaskScreen  ← NEW SCREEN (mirrors CreatePermanentTaskScreen)
            │
            └── on Save → savePermanentTemplate() → back to template list
```

### Key files

| File | Role | Status |
|------|------|--------|
| `app/screens/tasks/UsePermanentTaskScreen.tsx` | Template list UI | exists — needs ⋮ menu |
| `app/screens/tasks/EditPermanentTaskScreen.tsx` | Edit form | **NEEDS CREATING** |
| `app/screens/tasks/CreatePermanentTaskScreen.tsx` | Reference — copy this layout | exists |
| `app/navigation/MainNavigator.tsx` | Overlay routing | needs `EditPermanentTask` case |
| `app/features/permanentTask/utils/permanentTaskActions.ts` | Business logic | exists — `deletePermanentTask`, `reassignPermanentTask` already implemented |
| `app/core/services/storage/permanentTaskStorage.ts` | DB layer | exists — `savePermanentTemplate` (INSERT OR REPLACE) handles updates |
| `app/features/permanentTask/types/permanentTask.ts` | Type definitions | exists |

### What already works (don't rewrite these)

- `deletePermanentTask(task: Task)` in `permanentTaskActions.ts` — cascades template → instances → stats via DB foreign keys. Call this for delete.
- `savePermanentTemplate(template: PermanentTask)` in `permanentTaskStorage.ts` — uses `INSERT OR REPLACE` so passing an updated object with the same `permanentId` overwrites the record. This is the update mechanism.
- `getAllPermanentTemplates()` in `permanentTaskActions.ts` — already used by `UsePermanentTaskScreen` to populate the list.

### Data flow for an edit save

```
EditPermanentTaskScreen.handleSave()
    │
    │  build updated PermanentTask object:
    │    { ...originalTemplate, templateTitle, location, autoRepeat, categoryId }
    │
    ▼
permanentTaskStorage.savePermanentTemplate(updatedTemplate)
    │   (INSERT OR REPLACE — overwrites same permanentId row)
    ▼
SQLite templates table updated
    │
    ▼
MainNavigator.handleEditSave() → setOverlayScreen('none') → UsePermanentTaskScreen reloads
```

### Data flow for a delete

```
UsePermanentTaskScreen — user taps ⋮ → Delete → Alert confirm
    │
    ▼
permanentTaskActions.deletePermanentTask(task)
    │   (task.metadata.isTemplate = true, so calls deletePermanentTemplateDB)
    │
    ▼
permanentTaskStorage.deletePermanentTemplate(permanentId)
    │   DELETE FROM template_instances WHERE templateId = ?
    │   DELETE FROM templates WHERE permanentId = ?
    │   DELETE FROM template_stats WHERE templateId = ?
    ▼
UsePermanentTaskScreen removes the row from local state (setTemplates(prev => prev.filter(...)))
```

---

## ⚠️ CATEGORY CHANGE SAFETY — READ THIS BEFORE IMPLEMENTING

Changing a template's `categoryId` is the most dangerous part of this feature.
If done naively (just updating the `templates` row), it **silently orphans existing
instance data** and causes category stats to split across two categories with no
warning to the user. Read this section completely before writing any save code.

---

### How the category stats system works (the parts that matter here)

There are four places a category ID lives for a permanent task:

```
templates.category_id              ← the template's current default category
template_instances.category_id     ← per-instance copy (set at creation time, from template)
tasks.category_id                  ← synced copy in the main tasks table (set at creation time)
completion_log.category_id         ← IMMUTABLE SNAPSHOT taken at the moment of completion
```

The `completion_log` is an **append-only event ledger**. Every time a task
instance is completed, one row is written with a snapshot of `category_id`
at that moment — and that row is **never updated or deleted**, even if the
task or template is later edited. This is intentional: it preserves accurate
historical stats.

Stats queries for a category (e.g. `getTopCategories`, `getCompletionsByDayByCategory`,
`getCategoryDetail`) all filter `completion_log WHERE category_id = ?`. They do not
re-join against the current template or task rows. So what's in `completion_log`
is what the stats screen shows — full stop.

---

### What breaks if you only update `templates.category_id`

Say a template was created under category A and has 30 completed instances.
The user opens the edit screen and changes it to category B.

If you only call `savePermanentTemplate(updated)` (which only updates the
`templates` row):

| Table | After naive save | Problem |
|-------|-----------------|---------|
| `templates.category_id` | `cat_B` ✓ | Updated correctly |
| `template_instances.category_id` (30 old rows) | Still `cat_A` ✗ | Orphaned — future instance creation may read stale category from these rows |
| `tasks.category_id` (30 old rows) | Still `cat_A` ✗ | Orphaned — existing pending instances appear under wrong category in task list |
| `completion_log.category_id` (30 rows) | Still `cat_A` — intentional | Historical completions stay in their original category. **Do NOT change these.** |

The result: the template now appears in category B's task count, but its 30
historical completions are still counted in category A stats, and all existing
pending instances still display under category A in the task list. This will
cause real confusion in the stats and browse screens.

---

### What the correct save MUST do when category changes

When `selectedCategoryId !== originalCategoryId` at save time, you must run
**two additional UPDATE statements** after saving the template row:

```sql
-- 1. Update all existing instances in the junction table
UPDATE template_instances
   SET category_id = <newCategoryId>
 WHERE templateId = <permanentId>;

-- 2. Update all corresponding task rows in the main tasks table
UPDATE tasks
   SET category_id = <newCategoryId>
 WHERE id IN (
   SELECT instanceId FROM template_instances WHERE templateId = <permanentId>
 );
```

These two updates keep pending and future instances consistent with the
template's new category. They do NOT touch `completion_log` — that stays
immutable, which is correct.

---

### What is intentionally NOT updated (and why)

`completion_log.category_id` **must not be changed** when the template's
category changes. This is the correct behaviour:

- Past completions belong to the category they happened under.
- If the user ran "Morning Workout" under "Health" for 6 months, those 180
  completions should still count toward Health's historical stats even after
  the template is moved to a different category.
- The stats screens (CategoryDetailScreen) are designed for this split — they
  show what happened in a category over time, not what the category's current
  membership is.

The user-visible consequence: after changing category, old completions will
still appear in the old category's stats, and the new category starts from 0.
This is expected and correct. No warning to the user is needed for this
specific behaviour, but it is worth noting in code comments.

---

### Required new storage function

Add this to `app/core/services/storage/permanentTaskStorage.ts`. It **must**
be called as part of every category change — do not inline the SQL in the
screen or action layer.

```ts
/**
 * Cascade a template category change to all its existing instances.
 *
 * MUST be called whenever templates.category_id changes.
 * Updates template_instances and tasks tables so pending instances
 * stay consistent with the template's new category.
 *
 * Does NOT touch completion_log — historical completions are immutable
 * and intentionally remain under the category they were completed in.
 *
 * @param permanentId  - The template's permanentId
 * @param newCategoryId - The new category ID (null to clear category)
 */
export function updateTemplateCategoryInInstances(
  permanentId: string,
  newCategoryId: string | null
): void {
  // Update the junction table
  db.runSync(
    `UPDATE template_instances SET category_id = ? WHERE templateId = ?`,
    [newCategoryId, permanentId]
  );

  // Keep the tasks table in sync
  db.runSync(
    `UPDATE tasks SET category_id = ?
      WHERE id IN (SELECT instanceId FROM template_instances WHERE templateId = ?)`,
    [newCategoryId, permanentId]
  );
}
```

Note: This function is synchronous (`runSync`) like all other storage functions
in this file. Do not make it async.

---

### ⛔ Do NOT use `reassignPermanentTask` for the edit screen save

`reassignPermanentTask` in `permanentTaskActions.ts` exists for single-instance
updates (title, dueDate, location). It does **not** handle category cascading to
instances. Using it for template edits would silently skip the cascade above.
The edit screen should call the storage layer directly (see Step 2 below).

---

### Updated data flow for an edit save (category-aware)

```
EditPermanentTaskScreen.handleSave()
    │
    │  detect if category changed:
    │    const categoryChanged = selectedCategoryId !== originalCategoryId
    │
    ▼
permanentTaskStorage.savePermanentTemplate(updatedTemplate)
    │   UPDATE templates row (INSERT OR REPLACE)
    │
    ├── if (categoryChanged):
    │     permanentTaskStorage.updateTemplateCategoryInInstances(permanentId, newCategoryId)
    │       UPDATE template_instances SET category_id = newCategoryId WHERE templateId = permanentId
    │       UPDATE tasks SET category_id = newCategoryId WHERE id IN (SELECT instanceId ...)
    │
    │   completion_log: NOT TOUCHED — historical snapshots stay immutable
    │
    ▼
MainNavigator.handleEditSave() → setRefreshKey → goBack()
```

---

## Step-by-Step Implementation

---

### Step 1 — Add ⋮ menu to template rows in `UsePermanentTaskScreen`

**File:** `app/screens/tasks/UsePermanentTaskScreen.tsx`

#### 1a. Add props for edit/delete callbacks

```tsx
export interface UsePermanentTaskScreenProps {
  onInstanceCreated?: (task: Task) => void;
  onCancel?: () => void;
  onEditTemplate?: (template: Task) => void;   // ADD — opens EditPermanentTaskScreen
}
```

#### 1b. Add import for Alert (already imported) and `deletePermanentTask`

```tsx
import { deletePermanentTask, getAllPermanentTemplates } from '../../features/permanentTask/utils/permanentTaskActions';
```

#### 1c. Add delete handler inside the component

```tsx
const handleDeleteTemplate = (template: Task) => {
  Alert.alert(
    'Delete Template',
    `Delete "${template.title}"? This will also delete all instances created from it. This cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePermanentTask(template);
            setTemplates(prev => prev.filter(t => t.id !== template.id));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete template.');
          }
        },
      },
    ]
  );
};
```

#### 1d. Add ⋮ button to `renderTemplateItem`

In the `renderTemplateItem` function, add a ⋮ `TouchableOpacity` button to
the right side of each row (left of the `›` arrow, or replace it):

```tsx
{/* ⋮ options menu button */}
<TouchableOpacity
  onPress={() =>
    Alert.alert(template.title, 'Choose an action', [
      { text: 'Edit Template',   onPress: () => onEditTemplate?.(item) },
      { text: 'Delete Template', style: 'destructive', onPress: () => handleDeleteTemplate(item) },
      { text: 'Cancel',          style: 'cancel' },
    ])
  }
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  style={styles.menuButton}
>
  <Text style={styles.menuButtonText}>⋮</Text>
</TouchableOpacity>
```

Add to `StyleSheet`:

```tsx
menuButton: {
  paddingHorizontal: 8,
  paddingVertical: 4,
},
menuButtonText: {
  fontSize: 20,
  color: '#8e8e93',
},
```

---

### Step 2 — Create `EditPermanentTaskScreen.tsx`

**File:** `app/screens/tasks/EditPermanentTaskScreen.tsx`

Copy `CreatePermanentTaskScreen.tsx` as the starting point. Key differences:

1. **Props** — receives the template to edit:
   ```tsx
   export interface EditPermanentTaskScreenProps {
     template: Task;                     // pre-populated data
     onSave: () => void;                 // parent dismisses overlay + reloads
     onCancel: () => void;
   }
   ```

2. **Initial state** — populate from `template` instead of empty strings:
   ```tsx
   const meta = template.metadata as any;

   const [templateTitle, setTemplateTitle] = useState(template.title);
   const [selectedCategoryId, setSelectedCategoryId] = useState(template.categoryId ?? null);
   const [location, setLocation] = useState(
     typeof template.location === 'object' ? (template.location as any).name : template.location ?? ''
   );
   const [autoRepeatEnabled, setAutoRepeatEnabled] = useState(!!meta?.autoRepeat?.enabled);
   const [repeatFrequency, setRepeatFrequency] = useState<'daily'|'weekly'|'monthly'>(
     meta?.autoRepeat?.frequency ?? 'weekly'
   );
   ```

3. **handleSave** — calls storage layer directly. Must detect category change and cascade:

   > ⚠️ See **"Category Change Safety"** section above before modifying this.
   > Do NOT simplify this to just `savePermanentTemplate` — the cascade is required.

   ```tsx
   import {
     savePermanentTemplate,
     updateTemplateCategoryInInstances,   // ADD — must be created in Step 4
   } from '../../core/services/storage/permanentTaskStorage';
   import { PermanentTask } from '../../features/permanentTask/types/permanentTask';

   const handleSave = async () => {
     if (!templateTitle.trim()) {
       Alert.alert('Required', 'Template title cannot be empty.');
       return;
     }
     setIsSaving(true);
     try {
       const meta = template.metadata as any;
       const permanentId      = meta.permanentId as string;
       const originalCategory = template.categoryId ?? null;
       const newCategory      = selectedCategoryId ?? null;
       const categoryChanged  = newCategory !== originalCategory;

       const updated: PermanentTask = {
         id:            template.id,
         permanentId:   permanentId,
         templateTitle: templateTitle.trim(),
         isTemplate:    true,
         createdAt:     template.createdAt.getTime(),
         instanceCount: meta.instanceCount ?? 0,
         location:      location.trim() || undefined,
         autoRepeat:    autoRepeatEnabled ? { enabled: true, frequency: repeatFrequency } : undefined,
         categoryId:    newCategory ?? undefined,
         completed:     false,
       };

       // 1. Update the template row
       await savePermanentTemplate(updated);

       // 2. If category changed, cascade to all existing instances.
       //    This updates template_instances and tasks tables so pending
       //    instances appear under the correct category.
       //    completion_log is NOT touched — historical completions are
       //    immutable and stay under the category they were completed in.
       if (categoryChanged) {
         updateTemplateCategoryInInstances(permanentId, newCategory);
       }

       onSave();
     } catch (err) {
       Alert.alert('Error', 'Failed to save template.');
     } finally {
       setIsSaving(false);
     }
   };
   ```

4. **Header title** — change `"Create Template"` to `"Edit Template"`.

5. **Save button** — change `"Save"` to `"Update"` / `"Saving..."` to `"Updating..."`.

---

### Step 3 — Wire into `MainNavigator`

**File:** `app/navigation/MainNavigator.tsx`

#### 3a. Extend `OverlayScreen` type

```tsx
type OverlayScreen =
  | 'none'
  | 'CreateTask'
  | 'CreatePermanentTask'
  | 'UsePermanentTask'
  | 'EditPermanentTask'    // ADD
  | 'StatDetail';
```

#### 3b. Add state for the template being edited

```tsx
const [editingTemplate, setEditingTemplate] = useState<Task | null>(null);
```

#### 3c. Add handler for opening edit screen

```tsx
const handleEditTemplate = (template: Task) => {
  setEditingTemplate(template);
  setOverlayScreen('EditPermanentTask');
};
```

#### 3d. Clear editing template in `goBack`

```tsx
const goBack = () => {
  setOverlayScreen('none');
  setStatDetailParams(null);
  setEditingTemplate(null);   // ADD
};
```

#### 3e. Pass `onEditTemplate` to `UsePermanentTaskScreen`

```tsx
case 'UsePermanentTask':
  return (
    <UsePermanentTaskScreen
      onInstanceCreated={handleInstanceCreated}
      onCancel={goBack}
      onEditTemplate={handleEditTemplate}   // ADD
    />
  );
```

#### 3f. Add `EditPermanentTask` case to `renderOverlayScreen`

```tsx
import { EditPermanentTaskScreen } from '../screens/tasks/EditPermanentTaskScreen';

// inside renderOverlayScreen switch:
case 'EditPermanentTask':
  if (!editingTemplate) return null;
  return (
    <EditPermanentTaskScreen
      template={editingTemplate}
      onSave={() => {
        setRefreshKey(prev => prev + 1);
        goBack();
      }}
      onCancel={goBack}
    />
  );
```

---

### Step 4 — Storage: add `updateTemplateCategoryInInstances` (REQUIRED)

**File:** `app/core/services/storage/permanentTaskStorage.ts`

This function is **not optional**. The edit screen's `handleSave` imports and
calls it whenever the category changes. Without it, existing instance rows in
`template_instances` and `tasks` are orphaned under the old category.

Add this function to `permanentTaskStorage.ts` (full code also shown in the
"Category Change Safety" section above):

```ts
/**
 * Cascade a template category change to all its existing instances.
 *
 * MUST be called whenever templates.category_id changes.
 * Updates template_instances and tasks tables so pending instances
 * stay consistent with the template's new category.
 *
 * Does NOT touch completion_log — historical completions are immutable
 * and intentionally remain under the category they were completed in.
 */
export function updateTemplateCategoryInInstances(
  permanentId: string,
  newCategoryId: string | null
): void {
  db.runSync(
    `UPDATE template_instances SET category_id = ? WHERE templateId = ?`,
    [newCategoryId, permanentId]
  );
  db.runSync(
    `UPDATE tasks SET category_id = ?
      WHERE id IN (SELECT instanceId FROM template_instances WHERE templateId = ?)`,
    [newCategoryId, permanentId]
  );
}
```

Note: synchronous (`runSync`) to match all other functions in this file.

---

## File Checklist

| File | Change | Required? |
|------|--------|-----------|
| `app/screens/tasks/UsePermanentTaskScreen.tsx` | Add `onEditTemplate` prop, ⋮ menu button per row, `handleDeleteTemplate` | YES |
| `app/screens/tasks/EditPermanentTaskScreen.tsx` | **CREATE** — copy of Create screen, pre-populated, category-aware save | YES |
| `app/navigation/MainNavigator.tsx` | Add `EditPermanentTask` overlay type, `editingTemplate` state, `handleEditTemplate` | YES |
| `app/core/services/storage/permanentTaskStorage.ts` | Add `updateTemplateCategoryInInstances` function | YES — required for safe category changes |

---

## What NOT to change

- `permanentTaskActions.ts` — `deletePermanentTask` already works correctly. Do NOT use `reassignPermanentTask` for template edits — it does not handle category cascading.
- `permanentTaskFactory.ts` — not involved in editing
- `PermanentTask` type — no new fields needed
- `completion_log` — never update this table as part of a category change. Historical completions are immutable by design.
- `PermanentDetailScreen` — not part of this feature
- Stats screens — not affected

---

## Edge Cases to Handle

| Case | Handling |
|------|----------|
| User edits title to empty string | Validate in `handleSave`, show Alert, do not save |
| User deletes template that has instances | `deletePermanentTemplate` cascades to `template_instances` and `template_stats` via DB deletes — no extra code needed |
| User taps ⋮ on the template they are currently adding an instance of | The "Add Task" modal is closed by the ⋮ press — both flows are separate, no collision |
| `editingTemplate` is null when `EditPermanentTask` overlay is shown | Guard `if (!editingTemplate) return null` in `renderOverlayScreen` prevents crash |
| Category field on edit | `CategorySelector` component is already used in `CreatePermanentTaskScreen` — reuse it with `initialValue={template.categoryId}` |
| User changes category | Run `updateTemplateCategoryInInstances` after saving the template row. This is REQUIRED — see "Category Change Safety" section. |
| User clears category (removes it entirely) | Pass `null` to `updateTemplateCategoryInInstances`. Both SQL updates handle null correctly. |
| User changes category — old completion_log entries | Do nothing. Old completions stay under the original category in stats — this is correct and intentional. |
| Template has no existing instances (instanceCount = 0) | `updateTemplateCategoryInInstances` runs harmlessly — the WHERE clause matches zero rows. Safe to always call. |
| Two rapid saves (double-tap Update button) | Disable the Update button while `isSaving` is true (same pattern as CreatePermanentTaskScreen). |
