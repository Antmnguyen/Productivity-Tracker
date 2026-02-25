// app/screens/browse/BrowseScreen.tsx
// =============================================================================
// BROWSE SCREEN
// =============================================================================
//
// WHAT YOU SEE ON SCREEN:
//   A purple header at the top that says "Browse" with a subtitle "Manage your
//   app features". Below it is a scrollable list of cards — each card
//   represents one section of the app you can manage (currently just
//   "Categories"). Tapping a card navigates into that section.
//
// WHAT YOU CAN DO ON THIS SCREEN:
//   - Tap "Categories" to open the Category Management screen, where you can
//     create, rename, recolor, or delete task categories.
//   - (More sections will appear here as the app grows — see HOW TO ADD A NEW
//     SECTION below.)
//
// HOW NAVIGATION WORKS HERE (no-code explanation):
//   This screen does NOT use the app's main tab navigator to switch between
//   sub-screens. Instead it works like a light switch: a single variable called
//   `subScreen` tracks which section is open. When it equals 'none', the Browse
//   list is shown. When it equals 'categories' (or any future value), the
//   matching sub-screen fills the whole screen in its place. Tapping the back
//   arrow in that sub-screen flips `subScreen` back to 'none'.
//
// =============================================================================
//
// HOW TO ADD A NEW SECTION (e.g. "Templates", "Settings", "Notifications")
// =============================================================================
//
// There are exactly FOUR places you need to touch:
//
//  STEP 1 — Add the key to the SubScreen type  (line ~32)
//  ─────────────────────────────────────────────────────
//  The SubScreen type is the list of all possible values `subScreen` can hold.
//  Add your new section's key to the union, e.g.:
//
//    type SubScreen = 'none' | 'categories' | 'templates';
//                                              ^^^^^^^^^^^  ← add this
//
//  The key should be lowercase with no spaces. It is only used internally.
//
//
//  STEP 2 — Add a row to the FEATURES array  (line ~45)
//  ─────────────────────────────────────────────────────
//  Each object in this array becomes one tappable card in the list. Copy an
//  existing entry and change the four visible fields:
//
//    {
//      key:         'templates',          // must match the SubScreen key above
//      title:       'Templates',          // big text on the card
//      description: 'Manage your recurring task templates',  // small text
//      icon:        '📋',                 // emoji shown in the colour badge
//      color:       '#FF9500',            // badge background colour (any hex)
//    },
//
//  The card appears in the list in the same order as its position in this array.
//
//
//  STEP 3 — Add a sub-screen routing branch  (line ~65)
//  ─────────────────────────────────────────────────────
//  Inside the component, right where the 'categories' branch is, add yours:
//
//    if (subScreen === 'templates') {
//      return (
//        <TemplateManagementScreen onBack={() => setSubScreen('none')} />
//      );
//    }
//
//  The sub-screen component must accept an `onBack` prop (a function that
//  takes no arguments and returns nothing). Calling it should close the
//  sub-screen — use `() => setSubScreen('none')` exactly as shown.
//
//
//  STEP 4 — Import the new sub-screen component  (top of file, line ~15)
//  ─────────────────────────────────────────────────────────────────────
//  Add an import for the new screen file alongside the existing one:
//
//    import { TemplateManagementScreen } from './TemplateManagementScreen';
//
//  The file must live in the same folder (app/screens/browse/).
//
//
//  That's it — no changes needed anywhere else. The routing, the card list,
//  and the back-navigation all update automatically from those four edits.
//
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
} from 'react-native';

import { CategoryManagementScreen } from './CategoryManagementScreen';
import { HealthManagementScreen } from './HealthManagementScreen';
import { HistoryManagementScreen } from './HistoryManagementScreen';
import { LocationManagementScreen } from './LocationManagementScreen';

// =============================================================================
// TYPES
// =============================================================================

// SubScreen is the internal name for "which page is currently open inside the
// Browse tab". 'none' means the main Browse list is showing. Any other value
// means the matching sub-screen is open full-screen.
//
// ⚠️  When adding a new section, add its key here first — see STEP 1 above.
type SubScreen = 'none' | 'categories' | 'history' | 'location' | 'Health connect';

// FeatureItem describes one row in the Browse list — the shape (structure) of
// the data that drives each card. Every card needs all five fields.
interface FeatureItem {
  key:         SubScreen;   // Internal identifier — must match a SubScreen value
  title:       string;      // Big text shown on the card
  description: string;      // Small grey text below the title
  icon:        string;      // Emoji displayed inside the coloured badge
  color:       string;      // Background colour of the badge (hex code)
}

// =============================================================================
// FEATURE LIST
// =============================================================================
//
// This array is the single source of truth for what appears in the Browse list.
// One object = one card. They appear in the order listed here.
//
// ⚠️  When adding a new section, add an object here — see STEP 2 above.
const FEATURES: FeatureItem[] = [
  {
    key:         'categories',
    title:       'Categories',
    description: 'Create and manage task categories',
    icon:        '🏷️',
    color:       '#5856D6',  // Purple badge
  },
  {
    key:         'location',
    title:       'Location',
    description: 'Auto Complete tasks at specified locations',
    icon:        '📍',
    color:       '#d32929',  // Purple badge
  },
  {
    key:         'Health connect',
    title:       'Health connect',
    description: 'fitness tracker connection',
    icon:        '💓',
    color:       '#33ace5',  // Purple badge
  },
  {
    key:         'history',
    title:       'History',
    description: 'see previously completed tasks',
    icon:        '📜',
    color:       '#72552a',  // Purple badge
  }
  // ← Add more feature cards here following the same shape
];

// =============================================================================
// COMPONENT
// =============================================================================

export const BrowseScreen: React.FC = () => {
  // ---------------------------------------------------------------------------
  // subScreen tracks which sub-page (if any) is currently open.
  //   'none'       → show the main Browse list (default)
  //   'categories' → show CategoryManagementScreen full-screen instead
  //
  // setSubScreen is the function that changes which page is visible.
  // Calling setSubScreen('categories') opens that section.
  // Calling setSubScreen('none') goes back to the Browse list.
  // ---------------------------------------------------------------------------
  const [subScreen, setSubScreen] = useState<SubScreen>('none');

  // ---------------------------------------------------------------------------
  // Sub-screen routing
  //
  // These if-blocks run before the Browse list renders. If subScreen matches
  // one of these, the entire Browse tab is replaced by that sub-screen. The
  // onBack prop is the function the sub-screen calls when the user taps "back"
  // — it resets subScreen to 'none' so the Browse list reappears.
  //
  // ⚠️  When adding a new section, add a matching branch here — see STEP 3 above.
  // ---------------------------------------------------------------------------
  if (subScreen === 'categories') {
    return (
      <CategoryManagementScreen onBack={() => setSubScreen('none')} />
    );
  }
  if(subScreen === 'location')
  {
    return (
      <LocationManagementScreen onBack={() => setSubScreen('none')} />
    );
  }
  if(subScreen === 'Health connect')
  {
    return (
      <HealthManagementScreen onBack={() => setSubScreen('none')} />
    );
  }
  if(subScreen === 'history')
  {
    return (
      <HistoryManagementScreen onBack={() => setSubScreen('none')} />
    );
  }

  // ---------------------------------------------------------------------------
  // Main list — only rendered when no sub-screen is open (subScreen === 'none')
  // ---------------------------------------------------------------------------
  return (
    // SafeAreaView makes sure content doesn't go under the phone's notch or
    // home indicator at the bottom.
    <SafeAreaView style={styles.container}>

      {/* ── Header ──────────────────────────────────────────────────────────
          Purple bar at the top with the screen title and subtitle.
          Nothing tappable here — it's purely decorative/informational.
      ────────────────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>
        <Text style={styles.subtitle}>Manage your app features</Text>
      </View>

      {/* ── Feature card list ────────────────────────────────────────────────
          FlatList is a high-performance scrollable list. It works through the
          FEATURES array above and renders one card per item using renderItem.

          data             → the array of items to display (FEATURES)
          keyExtractor     → tells React which field uniquely identifies each
                             item (we use `key`, e.g. 'categories') so it can
                             update only changed rows rather than redrawing all
          renderItem       → a function that receives one item and returns the
                             card JSX for that item
          contentContainerStyle → padding/spacing applied to the list itself
      ────────────────────────────────────────────────────────────────────── */}
      <FlatList
        data={FEATURES}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          // ── Single feature card ──────────────────────────────────────────
          // A white rounded rectangle. Tapping it calls setSubScreen with this
          // item's key, which triggers the routing block above and opens the
          // matching sub-screen.
          <TouchableOpacity
            style={styles.featureRow}
            onPress={() => setSubScreen(item.key)}
            activeOpacity={0.7}   // Card dims slightly while held
          >
            {/* Coloured emoji badge on the left.
                The background colour comes from item.color (hex code).
                The emoji comes from item.icon. */}
            <View style={[styles.iconBadge, { backgroundColor: item.color }]}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>

            {/* Title + description text block, takes up remaining width */}
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureDesc}>{item.description}</Text>
            </View>

            {/* › chevron arrow on the right — visual hint that it's tappable */}
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================
//
// All visual styling lives here. Each name corresponds to a `style={styles.X}`
// reference in the JSX above.
//
// Quick guide to the units used:
//   Numbers without units (e.g. padding: 16) are in "density-independent pixels"
//   — React Native scales them automatically across different screen sizes.
//   Hex strings (e.g. '#5856D6') are colours.
//   Decimal opacity (e.g. opacity: 0.8) is 0 = invisible, 1 = fully visible.

const styles = StyleSheet.create({
  // Outer wrapper — fills the full screen, light grey background
  container: {
    flex:            1,
    backgroundColor: '#f5f5f5',
  },

  // Purple top bar
  header: {
    padding:         20,
    paddingTop:      60,     // Extra top padding to clear the status bar
    backgroundColor: '#5856D6',
  },

  // "Browse" — large bold white text
  title: {
    fontSize:   32,
    fontWeight: 'bold',
    color:      '#fff',
  },

  // "Manage your app features" — smaller slightly transparent white text
  subtitle: {
    fontSize: 16,
    color:    '#fff',
    opacity:  0.8,
  },

  // Space around the list of cards
  list: {
    padding: 16,
    gap:     12,   // Gap between consecutive cards
  },

  // Each tappable card — white rounded rectangle with a subtle shadow
  featureRow: {
    flexDirection:  'row',      // Icon, text, and chevron sit side-by-side
    alignItems:     'center',
    backgroundColor: '#fff',
    borderRadius:   14,
    padding:        16,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 1 },
    shadowOpacity:  0.06,
    shadowRadius:   4,
    elevation:      2,          // Android shadow
  },

  // Coloured square badge holding the emoji
  iconBadge: {
    width:          46,
    height:         46,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    14,
  },

  // The emoji itself inside the badge
  iconText: {
    fontSize: 22,
  },

  // Container for title + description — takes remaining row width
  featureInfo: {
    flex: 1,
  },

  // Bold section name (e.g. "Categories")
  featureTitle: {
    fontSize:   16,
    fontWeight: '600',
    color:      '#1a1a1a',
  },

  // Grey description below the title
  featureDesc: {
    fontSize:  13,
    color:     '#888',
    marginTop: 2,
  },

  // › arrow on the right edge of the card
  chevron: {
    fontSize:   24,
    color:      '#ccc',
    fontWeight: '300',
  },
});
