// app/screens/tasks/CreateTaskScreen.tsx
// =============================================================================
// CREATE TASK SCREEN
// =============================================================================
//
// WHAT YOU SEE ON SCREEN:
//   A white navigation bar at the top with "Cancel" on the left and "Save"
//   on the right. Below that, a scrollable form with three sections:
//     1. TASK NAME   — a text box where you type what needs to be done
//     2. DUE DATE    — three quick-pick buttons (Today / Tomorrow / Pick Date)
//                      plus a small readout showing the currently selected date
//     3. CATEGORY    — a row of colour-coded category pills to group the task
//
//   The keyboard opens automatically when this screen appears, placing the
//   cursor inside the Task Name field so you can start typing immediately.
//
// WHAT YOU CAN DO:
//   - Type a task name (required — you cannot save without it)
//   - Quickly set the due date to Today or Tomorrow with one tap, or open the
//     phone's built-in calendar picker to choose any future date
//   - Optionally assign the task to a category
//   - Tap "Save" to create the task (validated first — name must not be empty)
//   - Tap "Cancel" to go back without creating anything
//
// WHERE DATA GOES WHEN YOU SAVE:
//   The form data (title, dueDate, categoryId) is packaged into a
//   CreateTaskFormData object and handed to the onSave callback. The parent
//   screen/navigator (TasksStack) receives it and passes it to
//   taskActions.createTask() which saves it to local storage.
//
// DATE PICKER BEHAVIOUR BY PLATFORM:
//   iOS     — A scrollable spinner appears inline below the "Pick Date" button
//             and stays visible until you navigate away.
//   Android — A native modal calendar dialog pops up and closes automatically
//             once you confirm a date.
//
// PATTERNS:
//   - Date picker logic reuses the same approach as UsePermanentTaskScreen
//   - Style conventions match CreatePermanentTaskScreen and UsePermanentTaskScreen
//   - TASK_TYPE_OPTIONS array is a placeholder; replace with dynamic list later
//
// TODO:
//   - Replace hardcoded TASK_TYPE_OPTIONS with user-created task types from storage
//   - Wire onSave to taskActions.createTask() in TasksStack
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCategories, Category } from '../../features/categories';
import { CategorySelector } from '../../components/categories/CategorySelector';

// =============================================================================
// DATE HELPERS
// =============================================================================

// Tracks which quick-select button the user tapped, or 'custom' if they
// opened the full date picker
type QuickDateOption = 'today' | 'tomorrow' | 'custom';

/**
 * Returns a Date set to end-of-day (23:59:59.999) for the given quick option.
 * 'today' = today's end-of-day, 'tomorrow' = tomorrow's end-of-day.
 * End-of-day is used so a task due "Today" doesn't become overdue mid-afternoon.
 */
const getQuickDate = (option: 'today' | 'tomorrow'): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999); // Snap to end of day
  if (option === 'tomorrow') {
    date.setDate(date.getDate() + 1); // Advance by one day
  }
  return date;
};

/**
 * Formats a Date into a human-readable label for the "Selected:" display.
 * Shows "Today" / "Tomorrow" for those cases, otherwise a short date string
 * like "Mon, Feb 3".
 */
const formatDateDisplay = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if the date matches today or tomorrow by comparing date strings
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  // Fallback: short formatted date (e.g. "Mon, Feb 3")
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data shape emitted by onSave.
 * The parent (TasksStack) receives this and can pass it to taskActions.
 */
export interface CreateTaskFormData {
  title: string;       // Task name entered by user
  dueDate: Date;       // Selected due date
  categoryId?: string; // Selected category ID (foreign key to categories table)
}

/**
 * Props for CreateTaskScreen.
 * - onSave: called with form data when user taps Save
 * - onCancel: called when user taps Cancel (parent navigates back)
 */
export interface CreateTaskScreenProps {
  onSave?: (data: CreateTaskFormData) => void;
  onCancel?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CreateTaskScreen: React.FC<CreateTaskScreenProps> = ({
  onSave,
  onCancel,
}) => {
  // =========================================================================
  // HOOKS
  // =========================================================================

  // Load categories from storage so the CategorySelector can display them.
  // categoriesLoading is true while they are being fetched.
  const { categories, loading: categoriesLoading } = useCategories();

  // =========================================================================
  // STATE
  // =========================================================================

  // The task name the user types — empty at first, required before saving
  const [title, setTitle] = useState('');

  // Currently selected due date — defaults to today at end of day
  const [dueDate, setDueDate] = useState<Date>(getQuickDate('today'));

  // Which quick-date button is highlighted: 'today', 'tomorrow', or 'custom'
  // Starts as 'today' because the default date is today
  const [selectedQuickOption, setSelectedQuickOption] = useState<QuickDateOption>('today');

  // Controls whether the native DateTimePicker is visible on screen
  // (iOS spinner or Android dialog)
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Currently selected category — null means no category chosen yet
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Called when user taps "Today" or "Tomorrow" quick-select button.
   * Sets the due date to end-of-day for that option, highlights that button,
   * and hides the custom date picker if it was open.
   */
  const handleQuickDateSelect = (option: 'today' | 'tomorrow') => {
    setSelectedQuickOption(option);
    setDueDate(getQuickDate(option));
    setShowDatePicker(false); // Close custom picker if it was open
  };

  /**
   * Called when user taps "Pick Date" button.
   * Highlights the custom option and opens the native DateTimePicker.
   * On iOS the spinner appears inline; on Android a modal dialog opens.
   */
  const handleCustomDatePress = () => {
    setSelectedQuickOption('custom');
    setShowDatePicker(true);
  };

  /**
   * Callback from the native DateTimePicker when the user picks a date.
   * On Android the picker auto-dismisses after selection (we close it manually
   * to be safe). On iOS it stays open as an inline spinner.
   * Only updates the date if the user confirmed (event.type === 'set') rather
   * than cancelled.
   */
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Android: picker closes itself after user picks or cancels
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    // 'set' means user confirmed a date (not cancelled)
    if (event.type === 'set' && selectedDate) {
      setDueDate(selectedDate);
      setSelectedQuickOption('custom'); // Deselect Today/Tomorrow buttons
    }
  };

  /**
   * Called when user taps "Save" in the header.
   * Checks that a task name was entered, then packages the form data and
   * hands it to the parent via onSave. The parent decides what to do next
   * (usually calls taskActions.createTask and navigates back).
   */
  const handleSave = () => {
    // Title is the only required field — show an alert if it's blank
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a task name.');
      return;
    }

    // Pass collected form data to parent — parent decides what to do with it
    onSave?.({
      title: title.trim(),
      dueDate,
      categoryId: selectedCategory?.id,
    });
  };

  /**
   * Called when user taps "Cancel" in the header.
   * Parent handles navigation (typically goBack), nothing is saved.
   */
  const handleCancel = () => {
    onCancel?.();
  };

  // =========================================================================
  // RENDER — what gets drawn on screen
  // =========================================================================

  return (
    // SafeAreaView ensures content stays within the safe zone (avoids notch/home bar)
    <SafeAreaView style={styles.container}>

      {/* =================================================================
          HEADER BAR
          A white bar spanning the full width of the screen. Contains:
            - "Cancel" button on the far left (blue, regular weight)
            - "Create Task" title text centred between them
            - "Save" button on the far right (blue, bold — stands out)
          A hairline grey border sits at the bottom edge.
          Tapping "Cancel" calls handleCancel (navigates back, no save).
          Tapping "Save" calls handleSave (validates then saves).
          Matches the header pattern used in CreatePermanentTaskScreen and
          UsePermanentTaskScreen for visual consistency across all create flows.
          ================================================================= */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Task</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.saveButtonText]}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* ScrollView wraps all form sections so the screen can scroll when
          the keyboard is open or the iOS date spinner is visible, preventing
          content from being hidden behind the keyboard.
          keyboardShouldPersistTaps="handled" means tapping a button while the
          keyboard is open fires the button's action instead of just closing
          the keyboard. */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {/* ===============================================================
            SECTION 1: TASK NAME (required)
            A white card containing:
              - Small grey uppercase label "TASK NAME *"
              - Rounded text input box (keyboard opens automatically on mount)
              - Grey placeholder text "What needs to be done?"
            As the user types, title state updates live.
            If you tap Save with this empty, an alert pops up.
            =============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TASK NAME *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="What needs to be done?"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            autoFocus // Opens keyboard immediately when screen mounts
          />
        </View>

        {/* ===============================================================
            SECTION 2: DUE DATE
            A white card containing:
              - Small grey uppercase label "DUE DATE"
              - A row of three equal-width buttons: [Today] [Tomorrow] [Pick Date]
                The active/selected button turns solid blue with white text.
                Inactive buttons are light grey with dark text.
              - A grey rounded readout below the buttons showing the currently
                selected date, e.g. "Selected:  Today" or "Selected:  Mon, Feb 3"
              - If "Pick Date" was tapped:
                  iOS     — a scrollable date spinner appears inline below
                  Android — a native calendar dialog opens as a popup
            Picking a date via the calendar auto-selects the 'custom' button
            and deselects Today/Tomorrow.
            Same pattern as UsePermanentTaskScreen for consistency.
            =============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DUE DATE</Text>

          {/* Row of three quick-select buttons: Today | Tomorrow | Pick Date.
              Each button checks if it matches selectedQuickOption to decide
              whether to apply the blue "selected" style or remain grey. */}
          <View style={styles.quickDateContainer}>

            {/* TODAY button — tapping sets the due date to end of today */}
            <TouchableOpacity
              style={[
                styles.quickDateButton,
                selectedQuickOption === 'today' && styles.quickDateButtonSelected,
              ]}
              onPress={() => handleQuickDateSelect('today')}
            >
              <Text
                style={[
                  styles.quickDateButtonText,
                  selectedQuickOption === 'today' && styles.quickDateButtonTextSelected,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>

            {/* TOMORROW button — tapping sets the due date to end of tomorrow */}
            <TouchableOpacity
              style={[
                styles.quickDateButton,
                selectedQuickOption === 'tomorrow' && styles.quickDateButtonSelected,
              ]}
              onPress={() => handleQuickDateSelect('tomorrow')}
            >
              <Text
                style={[
                  styles.quickDateButtonText,
                  selectedQuickOption === 'tomorrow' && styles.quickDateButtonTextSelected,
                ]}
              >
                Tomorrow
              </Text>
            </TouchableOpacity>

            {/* PICK DATE button — tapping opens the phone's built-in date picker
                so the user can choose any future date from a calendar or spinner */}
            <TouchableOpacity
              style={[
                styles.quickDateButton,
                selectedQuickOption === 'custom' && styles.quickDateButtonSelected,
              ]}
              onPress={handleCustomDatePress}
            >
              <Text
                style={[
                  styles.quickDateButtonText,
                  selectedQuickOption === 'custom' && styles.quickDateButtonTextSelected,
                ]}
              >
                Pick Date
              </Text>
            </TouchableOpacity>
          </View>

          {/* Readout bar below the buttons: displays "Selected: Today" (or the
              formatted date). The label is grey and the value is black and bold.
              This always reflects the current dueDate state. */}
          <View style={styles.selectedDateDisplay}>
            <Text style={styles.selectedDateLabel}>Selected:</Text>
            <Text style={styles.selectedDateValue}>{formatDateDisplay(dueDate)}</Text>
          </View>

          {/* iOS date picker — appears as an inline scroll-wheel spinner below
              the readout bar, only when the user has tapped "Pick Date".
              Stays visible until the user taps away or selects Today/Tomorrow.
              minimumDate prevents picking dates in the past. */}
          {Platform.OS === 'ios' && showDatePicker && (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              minimumDate={new Date()} // Can't pick dates in the past
              style={styles.iosDatePicker}
            />
          )}

          {/* Android date picker — appears as a native modal dialog (calendar sheet)
              that overlays the screen. Auto-dismisses after the user taps a date
              or taps Cancel on the dialog. */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()} // Can't pick dates in the past
            />
          )}
        </View>

        {/* ===============================================================
            SECTION 3: CATEGORY SELECTOR
            A reusable component that shows the user's categories as a
            horizontally scrollable row of colour-coded pills. Tapping a pill
            selects it (it becomes highlighted in the category's colour) and
            tapping again deselects it.
            If no categories exist yet, it will show an empty or loading state.
            The same CategorySelector component is used in
            CreatePermanentTaskScreen, so the visual style is identical.
            =============================================================== */}
        <CategorySelector
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={categories}
          loading={categoriesLoading}
        />

        {/* Invisible spacer below all sections. Prevents the last card from
            being flush against the bottom edge or hidden behind the keyboard
            when the user scrolls to the bottom. */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// Visual appearance definitions — each comment describes what you see on screen.
// Matches the style conventions from CreatePermanentTaskScreen and
// UsePermanentTaskScreen: white section cards on grey background,
// blue (#007AFF) accent for selected states and header buttons.
// =============================================================================

const styles = StyleSheet.create({
  // Root container — grey background (#f5f5f5) is visible between white cards
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // ----- Header -----
  // Horizontal white bar: [Cancel]  Create Task  [Save]
  // The hairline border at the bottom is the thinnest line the screen can render
  header: {
    flexDirection: 'row',            // items laid out left-to-right
    justifyContent: 'space-between', // Cancel to left, Save to right
    alignItems: 'center',            // vertically centred
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  // "Create Task" — medium weight, centred automatically by space-between
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  // Tap-target wrapper around "Cancel" and "Save" — padded for easier tapping
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  // Blue text used for both "Cancel" and "Save"
  headerButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  // Applied in addition to headerButtonText — makes "Save" bold
  saveButtonText: {
    fontWeight: '600',
  },

  // ----- Scrollable content area -----
  // Takes up all vertical space below the header
  content: {
    flex: 1,
  },

  // ----- White section card -----
  // Each form section (name, date, category) is a white card with a top margin
  // that reveals the grey background behind it, creating a visual separation
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,     // gap above each card shows the grey background
  },
  // Uppercase grey label at the top of each section, e.g. "TASK NAME *"
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    letterSpacing: 0.5,  // subtle spacing makes uppercase text more readable
  },

  // ----- Text input (task name field) -----
  // Rounded box with a very light grey fill and a thin border
  textInput: {
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },

  // ----- Quick date buttons row -----
  // Three buttons side by side: Today | Tomorrow | Pick Date
  // gap: 10 puts a small space between each button
  quickDateContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,  // space between the buttons and the date readout below
  },
  // Individual date button — flex:1 makes all three share the row width equally.
  // Grey background with rounded corners in unselected state.
  // The transparent 2px border in the unselected state reserves space so the
  // layout doesn't shift when the selected border (also 2px) appears.
  quickDateButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',  // invisible border keeps layout stable
  },
  // Selected state — solid blue background and matching blue border
  quickDateButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  // Button text — dark grey in unselected state
  quickDateButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  // White text on the blue selected button
  quickDateButtonTextSelected: {
    color: '#fff',
  },

  // ----- Selected date readout -----
  // A rounded grey pill showing "Selected:  Today" or "Selected:  Mon, Feb 3"
  // flexDirection: 'row' puts the label and value side by side on one line
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  // "Selected:" — grey label on the left
  selectedDateLabel: {
    fontSize: 15,
    color: '#666',
    marginRight: 8,
  },
  // The actual date value — black and bold, e.g. "Today" or "Mon, Feb 3"
  selectedDateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  // ----- iOS date picker spinner -----
  // Fixed height so the spinner doesn't collapse or overflow when shown inline
  iosDatePicker: {
    height: 150,
    marginTop: 8,
  },

  // ----- Bottom spacer -----
  // Invisible padding at the very end of the scroll area.
  // Prevents the last form section from touching the keyboard edge when scrolled down.
  bottomSpacer: {
    height: 40,
  },
});
