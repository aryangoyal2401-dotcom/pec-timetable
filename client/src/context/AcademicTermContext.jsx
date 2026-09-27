import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AcademicTermContext = createContext();

export function AcademicTermProvider({ children }) {
  const [terms, setTerms] = useState([]);
  const [activeTerm, setActiveTermState] = useState(() => {
    return localStorage.getItem('timetable_active_academic_term') || '2026-27-1';
  });
  const [loading, setLoading] = useState(true);

  const loadTerms = async () => {
    try {
      const list = await api.getAcademicTerms();
      setTerms(list);
      // If activeTerm is not in the list, default to the one marked is_active === 1 or list[0]
      const currentExists = list.some(t => t.code === activeTerm);
      if (!currentExists && list.length > 0) {
        const defaultActive = list.find(t => t.is_active === 1) || list[0];
        setActiveTermState(defaultActive.code);
        localStorage.setItem('timetable_active_academic_term', defaultActive.code);
      }
    } catch (err) {
      console.error('Failed to load academic terms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  const setActiveTerm = (code) => {
    setActiveTermState(code);
    localStorage.setItem('timetable_active_academic_term', code);
  };

  const createTerm = async (data) => {
    const created = await api.createAcademicTerm(data);
    await loadTerms();
    if (data.is_active || data.switch_to) {
      setActiveTerm(created.code);
    }
    return created;
  };

  const rollover = async (fromTerm, toTerm, incrementSemester = true) => {
    const res = await api.rolloverAcademicTerm({ from_term: fromTerm, to_term: toTerm, increment_semester: incrementSemester });
    await loadTerms();
    setActiveTerm(toTerm);
    return res;
  };

  const activeTermObj = terms.find(t => t.code === activeTerm) || {
    code: activeTerm,
    name: `Academic Semester ${activeTerm}`
  };

  return (
    <AcademicTermContext.Provider
      value={{
        terms,
        activeTerm,
        activeTermObj,
        setActiveTerm,
        createTerm,
        rollover,
        refreshTerms: loadTerms,
        loading
      }}
    >
      {children}
    </AcademicTermContext.Provider>
  );
}

export function useAcademicTerm() {
  const context = useContext(AcademicTermContext);
  if (!context) {
    throw new Error('useAcademicTerm must be used within an AcademicTermProvider');
  }
  return context;
}
