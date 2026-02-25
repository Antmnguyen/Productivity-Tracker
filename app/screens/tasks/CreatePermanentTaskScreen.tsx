// app/screens/tasks/CreatePermanentTaskScreen.tsx
// =============================================================================
// CREATE PERMANENT TASK SCREEN
// =============================================================================
//
// WHAT IS A "PERMANENT TASK TEMPLATE"?
//   A permanent task template is a reusable blueprint for a task you do
//   repeatedly — like "Morning Workout" or "Weekly Review". You create the
//   template once here, and then every time you want to do that task you use
//   UsePermanentTaskScreen to stamp out a new instance from the blueprint,
//   choosing a due date each time. Think of it like a recipe card you can
//   cook from over and over.
//
// WHAT YOU SEE ON SCREEN:
//   A form with a white navigation bar at the top containing "Cancel" on the
//   left and "Save" on the right. Below that, a scrollable area with:
//     1. A required text input for the template name (auto-focused on open)
//     2. A category selector (shared component)
//     3. An expandable "Location" row — tap to reveal a text input
//     4. An expandable "Auto-Repeat" row — tap to reveal a toggle + frequency
//        buttons (Daily / Weekly / Monthly)
//
// WHAT EACH FIELD DOES:
//   Template Title (required)
//     The name you will see when browsing templates later. E.g. "Gym Session".
//     You cannot save without filling this in — tapping Save while it's blank
//     shows an error alert.
//
//   Category (optional)
//     Lets you group the template under a colour-coded category label. Uses
//     the same CategorySelector component as CreateTaskScreen.
//
//   Location (optional — hidden until tapped)
//     A plain text field like "Gym" or "Home". Stored as a location name
//     alongside the template; shown on task cards and in the template list.
//
//   Auto-Repeat (optional — hidden until tapped)
//     A toggle that enables automatic instance creation. When on, a row of
//     three pill buttons appears: Daily | Weekly | Monthly. Tapping one
//     selects the repeat cadence. The selected button turns blue.
//
// WHAT HAPPENS WHEN YOU TAP SAVE:
//   1. Validates that Template Title is not empty.
//   2. Builds a data object from all filled-in fields.
//   3. Calls createTask() (from taskActions) with type='permanent', which
//      creates and persists the template to local storage.
//   4. If a parent onSave callback was provided, calls it (navigation away).
//      Otherwise shows a success alert.
//   5. If saving fails, shows an error alert with the reason.
//
// WHAT HAPPENS WHEN YOU TAP CANCEL:
//   Calls onCancel (provided by the parent navigator), which navigates back
//   without saving anything.
//
// TEMPLATE FIELDS STORED (from permanentTask.ts):
//   templateTitle (required) — the name you typed
//   location      (optional) — plain text location name
//   autoRepeat    (optional) — { enabled, frequency }
//   categoryId    (optional) — foreign key to chosen category
//
// AUTO-GENERATED FIELDS (the app fills these in automatically):
//   id, permanentId, isTemplate, createdAt, instanceCount
//
// DESIGN DECISIONS:
//   1. Form state lives here in this screen (not in a shared hook) because
//      it is temporary UI state that only matters while this screen is open.
//   2. handleSave calls taskActions.createTask(), which internally routes to
//      permanentTaskActions to handle the permanent-task-specific logic.
//   3. Every optional field is hidden behind a tap-to-expand row, keeping
//      the screen uncluttered for users who just need the title.
//
// TODO:
//   - Add taskType to PermanentTask type and storage (requires restructuring)
//   - Add navigation back to previous screen after save
//   - Add loading state during save
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
  Switch,
  Alert,
} from 'react-native';
import { createTask } from '../../core/domain/taskActions';
import { useCategories, Category } from '../../features/categories';
import { CategorySelector } from '../../components/categories/CategorySelector';

// =============================================================================
// TYPES
// =============================================================================

// The shape of the data this form collects.
// Mirrors the fields on the PermanentTask template type.
// This object is what gets handed to createTask() when saving.
export interface PermanentTaskFormData {
  templateTitle: string;
  categoryId?: string;
  location?: string;
  autoRepeat?: {
    enabled: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
    // Expandable: add more auto-repeat options here later
  };
}

// Props this screen accepts from its parent navigator.
export interface CreatePermanentTaskScreenProps {
  // Called when user saves the form - will connect to backend later
  onSave?: (data: PermanentTaskFormData) => void;
  // Called when user cancels/goes back
  onCancel?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CreatePermanentTaskScreen: React.FC<CreatePermanentTaskScreenProps> = ({
  onSave,
  onCancel,
}) => {
  // =========================================================================
  // HOOKS
  // =========================================================================

  // Load categories from storage so the CategorySelector can display them.
  // categoriesLoading is true while they are being fetched from storage.
  const { categories, loading: categoriesLoading } = useCategories();

  // =========================================================================
  // FORM STATE
  // Each piece of state below corresponds to one input on the form.
  // =========================================================================

  // The template name — required, starts blank, keyboard auto-opens here
  const [templateTitle, setTemplateTitle] = useState('');

  // The category the user picked from the category selector (null = none selected)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // The location text field — optional, empty by default
  const [location, setLocation] = useState('');

  // Whether auto-repeat is switched on
  const [autoRepeatEnabled, setAutoRepeatEnabled] = useState(false);

  // Which frequency pill is selected: 'daily', 'weekly', or 'monthly'
  // Only relevant if autoRepeatEnabled is true
  const [autoRepeatFrequency, setAutoRepeatFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Controls whether the Location text input is visible.
  // Starts hidden — the user must tap the "Location (Optional)" row to reveal it.
  const [showLocationInput, setShowLocationInput] = useState(false);

  // Controls whether the Auto-Repeat toggle + frequency buttons are visible.
  // Starts hidden — the user must tap the "Auto-Repeat (Optional)" row to reveal it.
  const [showAutoRepeatOptions, setShowAutoRepeatOptions] = useState(false);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  // Runs when the user taps "Save" in the header bar.
  // Validates the form, builds the data object, and calls createTask().
  const handleSave = async () => {
    // If the title field is empty or contains only spaces, stop and warn user
    if (!templateTitle.trim()) {
      Alert.alert('Required Field', 'Please enter a template title');
      return;
    }

    // Start with the required field, plus category if one was chosen
    const formData: PermanentTaskFormData = {
      templateTitle: templateTitle.trim(),
      categoryId: selectedCategory?.id,
    };

    // Only include location if the user actually typed something
    if (location.trim()) {
      formData.location = location.trim();
    }

    // Only include auto-repeat data if the toggle is switched on
    if (autoRepeatEnabled) {
      formData.autoRepeat = {
        enabled: true,
        frequency: autoRepeatFrequency,
      };
    }

    try {
      // Hand the data off to taskActions which routes it to permanentTaskActions.
      // This creates and saves the template in local storage.
      const newTemplate = await createTask(
        formData.templateTitle,
        'permanent',
        {
          //templateTitle: formData.templateTitle,
          location: formData.location ? { lat: 0, lng: 0, name: formData.location } : undefined,
          recurring: formData.autoRepeat,
          categoryId: formData.categoryId,
        }
      );

      console.log('Permanent Task Template Created:', newTemplate);

      // Let the parent navigator know saving succeeded, so it can navigate away
      if (onSave) {
        onSave(formData);
      } else {
        Alert.alert('Success', `Template "${formData.templateTitle}" created!`);
      }
    } catch (error) {
      console.error('Failed to create permanent task template:', error);
      Alert.alert(
        'Error',
        `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  // Runs when the user taps "Cancel" in the header bar.
  // Calls the parent navigator's onCancel, which navigates back without saving.
  const handleCancel = () => {
    console.log('CreatePermanentTaskScreen: Cancel pressed, onCancel:', !!onCancel);
    onCancel?.();
  };

  // =========================================================================
  // RENDER — what gets drawn on screen
  // =========================================================================

  return (
    // SafeAreaView keeps all content within the safe zone (away from notch/home bar)
    <SafeAreaView style={styles.container}>

      {/* ===================================================================
          HEADER BAR
          A white bar stretching across the top of the screen with:
            - "Cancel" button on the left (blue text, navigates back)
            - "New Permanent Task" title text in the centre
            - "Save" button on the right (blue bold text, triggers save logic)
          A thin grey line at the bottom separates it from the form below.
          =================================================================== */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Permanent Task</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.saveButton]}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* ScrollView allows the form to scroll if it overflows the screen height,
          e.g. when the keyboard is visible or the date picker is expanded.
          keyboardShouldPersistTaps="handled" means tapping a button while the
          keyboard is open fires the button action instead of just closing the
          keyboard. */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {/* =================================================================
            SECTION 1: TEMPLATE TITLE (required)
            A white card containing:
              - A small grey uppercase label "TEMPLATE TITLE *"
              - A rounded text input box (keyboard opens automatically)
              - Placeholder text "e.g., Morning Workout, Weekly Review"
              - A small grey helper note explaining what the field is for
            This is the only required field — Save will be blocked if empty.
            ================================================================= */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Template Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Morning Workout, Weekly Review"
            placeholderTextColor="#999"
            value={templateTitle}
            onChangeText={setTemplateTitle}
            autoFocus
          />
          <Text style={styles.helperText}>
            This is the name you'll see when selecting this template
          </Text>
        </View>

        {/* =================================================================
            SECTION 2: CATEGORY SELECTOR
            A reusable component that shows a horizontally scrollable row of
            colour-coded category pills. Tapping one selects it (highlighted
            in its category colour) and tapping again deselects it.
            Loads categories from storage via the useCategories hook above.
            The same component is used in CreateTaskScreen.
            ================================================================= */}
        <CategorySelector
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={categories}
          loading={categoriesLoading}
        />

        {/* =================================================================
            SECTION 3: LOCATION (optional, collapsible)
            A tappable row that reads "Location (Optional)" with a "+" icon
            on the right. Tapping it toggles the location text input open or
            closed. When open, the "+" becomes "−".
            The location input accepts plain text like "Home", "Gym", "Office".
            ================================================================= */}
        <TouchableOpacity
          style={styles.optionalHeader}
          onPress={() => setShowLocationInput(!showLocationInput)}
        >
          <Text style={styles.optionalHeaderText}>Location (Optional)</Text>
          <Text style={styles.expandIcon}>{showLocationInput ? '−' : '+'}</Text>
        </TouchableOpacity>

        {/* The location text input — only rendered when showLocationInput is true */}
        {showLocationInput && (
          <View style={styles.section}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Home, Gym, Office"
              placeholderTextColor="#999"
              value={location}
              onChangeText={setLocation}
            />
            <Text style={styles.helperText}>
              Associate this task with a specific location
            </Text>
          </View>
        )}

        {/* =================================================================
            SECTION 4: AUTO-REPEAT (optional, collapsible)
            A tappable row that reads "Auto-Repeat (Optional)" with a "+" icon.
            Tapping it reveals:
              - An "Enable Auto-Repeat" label with an iOS-style toggle switch
              - If the toggle is ON, three pill buttons appear:
                  [Daily]  [Weekly]  [Monthly]
                The active pill turns blue; the others stay grey. Tapping
                a pill switches the selection.
            A helper note explains what auto-repeat does.
            ================================================================= */}
        <TouchableOpacity
          style={styles.optionalHeader}
          onPress={() => setShowAutoRepeatOptions(!showAutoRepeatOptions)}
        >
          <Text style={styles.optionalHeaderText}>Auto-Repeat (Optional)</Text>
          <Text style={styles.expandIcon}>{showAutoRepeatOptions ? '−' : '+'}</Text>
        </TouchableOpacity>

        {/* The auto-repeat options — only rendered when showAutoRepeatOptions is true */}
        {showAutoRepeatOptions && (
          <View style={styles.section}>

            {/* Enable/Disable Toggle row:
                Left side: "Enable Auto-Repeat" label
                Right side: iOS-style toggle switch (grey when off, blue when on) */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enable Auto-Repeat</Text>
              <Switch
                value={autoRepeatEnabled}
                onValueChange={setAutoRepeatEnabled}
                trackColor={{ false: '#ddd', true: '#007AFF' }}
                thumbColor="#fff"
              />
            </View>

            {/* Frequency pill buttons — only shown after the toggle is switched ON.
                Three equal-width buttons in a row: Daily | Weekly | Monthly.
                The selected one has a blue background; unselected ones are grey.
                Tapping any pill immediately updates the selection. */}
            {autoRepeatEnabled && (
              <View style={styles.frequencyContainer}>
                <Text style={styles.frequencyLabel}>Repeat Frequency:</Text>
                <View style={styles.frequencyOptions}>
                  {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.frequencyOption,
                        autoRepeatFrequency === freq && styles.frequencyOptionSelected,
                      ]}
                      onPress={() => setAutoRepeatFrequency(freq)}
                    >
                      <Text
                        style={[
                          styles.frequencyOptionText,
                          autoRepeatFrequency === freq && styles.frequencyOptionTextSelected,
                        ]}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.helperText}>
              Auto-repeat will automatically create new instances of this task
            </Text>
          </View>
        )}

        {/* =================================================================
            FUTURE EXPANSION AREA
            New optional sections (e.g. Priority, Subtasks, Reminders) should
            be added here following the same collapsible-row pattern above.
            ================================================================= */}

        {/* Empty space at the very bottom so the last section isn't flush
            against the keyboard or the screen edge when scrolled down */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// Visual appearance definitions for each element in the render above.
// =============================================================================

const styles = StyleSheet.create({
  // Root wrapper — light grey background peeks between white section cards
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Header styles
  // White bar across the top; hairline grey border separates it from the form
  header: {
    flexDirection: 'row',       // Cancel | Title | Save laid out left-to-right
    justifyContent: 'space-between', // pushes Cancel to far left, Save to far right
    alignItems: 'center',       // vertically centres all three items
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, // hairline = thinnest possible line
    borderBottomColor: '#ddd',
  },
  // "New Permanent Task" — medium weight, centred by the space-between layout
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  // Tap target wrapper around Cancel and Save text — extra padding for easy tapping
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  // Blue text for both Cancel and Save
  headerButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  // "Save" is bold to visually distinguish it from "Cancel"
  saveButton: {
    fontWeight: '600',
  },

  // Content area — fills remaining space below the header, allows scrolling
  content: {
    flex: 1,
  },

  // White card used for each input group (title field, location field, etc.)
  // 1px bottom margin creates a visible gap between stacked sections on grey bg
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 1,
  },
  // Uppercase label above each input, like "TEMPLATE TITLE *"
  // Small, grey, spaced-out letters — looks like a standard iOS form label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Rounded text input box — light grey fill, thin border, comfortable padding
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
  // Small grey instructional text shown below an input field
  helperText: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },

  // Tappable row for collapsible optional sections (Location, Auto-Repeat).
  // Full-width white row with a thin top and bottom border; margin above
  // creates visual spacing between it and the previous section.
  optionalHeader: {
    flexDirection: 'row',            // label on left, +/− icon on right
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,                   // gap above each optional section
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  // "Location (Optional)" / "Auto-Repeat (Optional)" label text
  optionalHeaderText: {
    fontSize: 16,
    color: '#333',
  },
  // Blue "+" or "−" icon on the right of each collapsible row header
  expandIcon: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '300',
  },

  // Row containing the "Enable Auto-Repeat" label and the toggle switch side by side
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  // "Enable Auto-Repeat" text label
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },

  // Container for the "Repeat Frequency" label and the three pill buttons below it
  frequencyContainer: {
    marginTop: 16,
  },
  // "Repeat Frequency:" label above the pill buttons
  frequencyLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  // Horizontal row holding the three equal-width pill buttons
  frequencyOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  // Individual frequency pill — flex:1 makes all three the same width
  // Grey background and rounded corners by default (unselected state)
  frequencyOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  // Selected pill — overrides background to blue
  frequencyOptionSelected: {
    backgroundColor: '#007AFF',
  },
  // Text inside an unselected frequency pill — dark grey
  frequencyOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  // Text inside the selected frequency pill — white (readable on blue background)
  frequencyOptionTextSelected: {
    color: '#fff',
  },

  // Invisible spacer at the bottom of the scroll view — prevents the last
  // section from touching the screen edge when fully scrolled down
  bottomSpacer: {
    height: 40,
  },
});
