const BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '') + '/api';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

// Override request to always include credentials (cookies)
async function authRequest(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const api = {
  // Auth & Admin
  loginWithGoogle: (credential) => authRequest('POST', '/auth/google', { credential }),
  logout: () => authRequest('POST', '/auth/logout'),
  getMe: () => authRequest('GET', '/auth/me'),
  getUsers: () => authRequest('GET', '/admin/users'),
  updateUserRole: (email, role) => authRequest('PUT', `/admin/users/${email}/role`, { role }),

  // Academic Terms / Semesters
  getAcademicTerms: () => request('GET', '/academic-terms'),
  createAcademicTerm: (data) => request('POST', '/academic-terms', data),
  setActiveAcademicTerm: (code) => request('PUT', `/academic-terms/${code}/active`),
  getClassSemesters: (term) => request('GET', `/academic-terms/class-semesters${term ? '?academic_term=' + term : ''}`),
  updateClassSemester: (data) => request('PUT', '/academic-terms/class-semesters', data),
  rolloverAcademicTerm: (data) => request('POST', '/academic-terms/rollover', data),

  // Departments
  getDepartments: () => request('GET', '/departments'),

  // Teachers
  getTeachers: () => request('GET', '/teachers'),
  getTeacher: (id) => request('GET', `/teachers/${id}`),
  createTeacher: (data) => request('POST', '/teachers', data),
  updateTeacher: (id, data) => request('PUT', `/teachers/${id}`, data),
  deleteTeacher: (id) => request('DELETE', `/teachers/${id}`),
  updateAvailability: (id, availability) => request('PUT', `/teachers/${id}/availability`, { availability }),
  getWorkload: (id) => request('GET', `/teachers/${id}/workload`),

  // Scholars (TAs / PhD Scholars)
  getScholars: (filters = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return request('GET', `/scholars${qs ? '?' + qs : ''}`);
  },
  getScholar: (id) => request('GET', `/scholars/${id}`),
  createScholar: (data) => request('POST', '/scholars', data),
  updateScholar: (id, data) => request('PUT', `/scholars/${id}`, data),
  deleteScholar: (id) => request('DELETE', `/scholars/${id}`),

  // Rooms
  getRooms: () => request('GET', '/rooms'),
  createRoom: (data) => request('POST', '/rooms', data),
  updateRoom: (id, data) => request('PUT', `/rooms/${id}`, data),
  deleteRoom: (id) => request('DELETE', `/rooms/${id}`),

  // Classes
  getClasses: () => request('GET', '/classes'),
  getClass: (id) => request('GET', `/classes/${id}`),
  createClass: (data) => request('POST', '/classes', data),
  updateClass: (id, data) => request('PUT', `/classes/${id}`, data),
  deleteClass: (id) => request('DELETE', `/classes/${id}`),
  createGroup: (classId, data) => request('POST', `/classes/${classId}/groups`, data),
  updateGroup: (classId, groupId, data) => request('PUT', `/classes/${classId}/groups/${groupId}`, data),
  deleteGroup: (classId, groupId) => request('DELETE', `/classes/${classId}/groups/${groupId}`),

  // Students
  getStudents: (classId) => request('GET', `/classes/${classId}/students`),
  addStudent: (classId, data) => request('POST', `/classes/${classId}/students`, data),
  bulkAddStudents: (classId, data) => request('POST', `/classes/${classId}/students/bulk`, data),
  deleteStudent: (classId, studentId) => request('DELETE', `/classes/${classId}/students/${studentId}`),

  // Group membership
  getGroupMembers: (classId, groupId) => request('GET', `/classes/${classId}/groups/${groupId}/members`),
  addGroupMembers: (classId, groupId, data) => request('POST', `/classes/${classId}/groups/${groupId}/members`, data),
  removeGroupMember: (classId, groupId, studentId) => request('DELETE', `/classes/${classId}/groups/${groupId}/members/${studentId}`),
  setGroupMembers: (classId, groupId, data) => request('PUT', `/classes/${classId}/groups/${groupId}/members/bulk`, data),
  setAllGroupMembers: (classId, data) => request('PUT', `/classes/${classId}/groups/members/bulk`, data),

  // Master Course Catalog
  getCourses: (filters = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return request('GET', `/courses${qs ? '?' + qs : ''}`);
  },
  getCourse: (id) => request('GET', `/courses/${id}`),
  createCourse: (data) => request('POST', '/courses', data),
  updateCourse: (id, data) => request('PUT', `/courses/${id}`, data),
  deleteCourse: (id) => request('DELETE', `/courses/${id}`),
  createComponent: (courseId, data) => request('POST', `/courses/${courseId}/components`, data),
  deleteComponent: (courseId, compId) => request('DELETE', `/courses/${courseId}/components/${compId}`),

  // Course Offerings (Term-Scoped Batch Course Assignments)
  getCourseOfferings: (filters = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return request('GET', `/courses/offerings${qs ? '?' + qs : ''}`);
  },
  createCourseOffering: (data) => request('POST', '/courses/offerings', data),
  deleteCourseOffering: (id) => request('DELETE', `/courses/offerings/${id}`),

  // Assignments
  getAssignments: (filters = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return request('GET', `/assignments${qs ? '?' + qs : ''}`);
  },
  getAssignmentsByClass: (classId, term) => {
    const qs = term ? `?academic_term=${term}` : '';
    return request('GET', `/assignments/by-class/${classId}${qs}`);
  },
  createAssignment: (data) => request('POST', '/assignments', data),
  assignTeacher: (data) => request('POST', '/assignments/assign', data),
  deleteAssignment: (id) => request('DELETE', `/assignments/${id}`),

  // Timetable
  getTimetable: (filters = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return request('GET', `/timetable${qs ? '?' + qs : ''}`);
  },
  createEntry: (data) => request('POST', '/timetable', data),
  updateEntry: (id, data) => request('PUT', `/timetable/${id}`, data),
  deleteEntry: (id) => request('DELETE', `/timetable/${id}`),
  getStats: (term) => request('GET', `/timetable/stats/summary${term ? '?academic_term=' + term : ''}`),
  getScheduleStatus: (classId, term) => {
    const params = new URLSearchParams();
    if (classId) params.append('class_id', classId);
    if (term) params.append('academic_term', term);
    const qs = params.toString();
    return request('GET', `/timetable/status/schedule${qs ? '?' + qs : ''}`);
  },

  // Time Slots
  getTimeSlots: () => request('GET', '/timeslots'),

  // Bookings
  getBookings: () => request('GET', '/bookings'),
  createBooking: (data) => request('POST', '/bookings', data),
  deleteBooking: (id) => request('DELETE', `/bookings/${id}`),

  // Holidays
  getHolidays: () => request('GET', '/holidays'),
  createHoliday: (data) => request('POST', '/holidays', data),
  deleteHoliday: (id) => request('DELETE', `/holidays/${id}`),

  // Backup & Data Sync
  exportBackup: () => request('GET', '/backup/export'),
  importBackup: (data) => request('POST', '/backup/import', { data }),
};
