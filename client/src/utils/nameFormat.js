/**
 * Utilities for formatting person names and managing designations consistently
 * across Timetable and Courses pages.
 */

const HONORIFICS = new Set([
  'dr', 'dr.', 'prof', 'prof.', 'professor',
  'mr', 'mr.', 'ms', 'ms.', 'mrs', 'mrs.',
  'er', 'er.', 'sh', 'sh.', 'shri', 'smt', 'smt.',
  'col', 'col.', 'major', 'capt', 'hon', 'hon.'
]);

/**
 * Extracts the clean first name of a teacher or scholar.
 * Handles names with designations (e.g. "Dr. Anita Sharma", "Sandeep Harit (Associate Professor)",
 * "Anita (AP)", "Prof. Meera Nair", "Er. Rohit Kumar", "Ms. Priya Reddy", "Anita").
 *
 * @param {string} fullName
 * @returns {string} The first name of the person
 */
export function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';

  // 1. Remove parenthetical designations: "Anita (AP)", "Sandeep (Associate Professor)" -> "Anita", "Sandeep"
  let clean = fullName.replace(/\s*\([^)]*\)/g, '').trim();

  // 2. Remove common comma or dash designation suffixes: "Anita Sharma, AP", "Sandeep - Prof" -> "Anita Sharma", "Sandeep"
  clean = clean.split(/[,–-]\s*(?:prof|assoc|asst|ap|dr|phd|m\.?tech|hod|lecturer|faculty|dean)/i)[0].trim();

  // 3. Remove trailing punctuation
  clean = clean.replace(/[,;:]+$/, '').trim();

  // 4. Split into words
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return fullName.trim();

  // 5. Find the first word that is not an honorific prefix
  for (let i = 0; i < words.length; i++) {
    const raw = words[i].trim();
    const normalized = raw.toLowerCase().replace(/[^a-z.]/g, '');
    if (!HONORIFICS.has(normalized) && !HONORIFICS.has(raw.toLowerCase())) {
      const cleanWord = raw.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '');
      if (cleanWord) {
        return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);
      }
    }
  }

  // Fallback if every word was an honorific
  return words[0];
}

/**
 * Checks whether a name string already contains a designation.
 * e.g. "Dr. Sandeep (AP)", "Anita (Associate Professor)", "Harish Kumar, Professor"
 *
 * @param {string} name
 * @returns {boolean}
 */
export function hasEmbeddedDesignation(name) {
  if (!name || typeof name !== 'string') return false;
  return /\([^)]*(?:prof|assoc|asst|ap|lecturer|faculty|hod|dean|dr|phd|m\.?tech)[^)]*\)/i.test(name) ||
         /[,–-]\s*(?:prof|assoc|asst|ap|dr|phd|m\.?tech|hod|lecturer|faculty|dean)/i.test(name);
}

/**
 * Formats a teacher label for dropdowns and selectors without duplicating designations.
 * If the teacher's name already contains a designation, it avoids adding `(designation)` again.
 * If designation is provided and not already in the name, it appends `(designation)`.
 *
 * @param {Object} teacher { name, designation }
 * @returns {string} Formatted label
 */
export function formatTeacherLabel(teacher) {
  if (!teacher) return '';
  const name = (teacher.name || '').trim();
  const desig = (teacher.designation || '').trim();

  if (!desig || hasEmbeddedDesignation(name)) {
    return name;
  }
  return `${name} (${desig})`;
}

/**
 * Formats teacher name with designation for hover tooltips or titles.
 * Avoids duplicating designations if already part of name.
 *
 * @param {string} name
 * @param {string} [designation]
 * @returns {string}
 */
export function formatTeacherWithDesignation(name, designation) {
  if (!name) return '';
  const cleanName = name.trim();
  const cleanDesig = (designation || '').trim();

  if (!cleanDesig || hasEmbeddedDesignation(cleanName)) {
    return cleanName;
  }
  return `${cleanName} (${cleanDesig})`;
}
