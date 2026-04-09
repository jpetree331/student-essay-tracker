import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getStudentById, getStudents } from '../api/client';

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState(null);

  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [activePeriodFilter, setActivePeriodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('roster');

  /** When set with a student id, StudentRecordHeader opens edit mode once that student is shown. */
  const [pendingStudentEditId, setPendingStudentEditId] = useState(null);

  const clearPendingStudentEdit = useCallback(() => {
    setPendingStudentEditId(null);
  }, []);

  const openStudentForEdit = useCallback((id) => {
    setSelectedStudentId(id);
    setPendingStudentEditId(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStudentsLoading(true);
      setStudentsError(null);
      try {
        const data = await getStudents();
        if (!cancelled) setStudents(data);
      } catch (e) {
        if (!cancelled) setStudentsError(e.message || 'Failed to load students');
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedStudentId == null) {
      setSelectedStudentDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const data = await getStudentById(selectedStudentId);
        if (!cancelled) setSelectedStudentDetail(data);
      } catch (e) {
        if (!cancelled) {
          setDetailError(e.message || 'Failed to load student');
          setSelectedStudentDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId]);

  const selectStudent = useCallback((id) => {
    setSelectedStudentId((prev) => (prev === id ? null : id));
  }, []);

  const refreshSelectedStudent = useCallback(async () => {
    if (selectedStudentId == null) return;
    try {
      const data = await getStudentById(selectedStudentId);
      setSelectedStudentDetail(data);
    } catch {
      /* keep existing detail; callers may show toast */
    }
  }, [selectedStudentId]);

  const refreshStudents = useCallback(async () => {
    try {
      const data = await getStudents();
      setStudents(data);
    } catch {
      /* ignore sidebar refresh failures */
    }
  }, []);

  const periodNumbers = useMemo(() => {
    const set = new Set(students.map((s) => s.period));
    return [...set].sort((a, b) => a - b);
  }, [students]);

  const value = useMemo(
    () => ({
      students,
      studentsLoading,
      studentsError,
      selectedStudentId,
      selectedStudentDetail,
      detailLoading,
      detailError,
      selectStudent,
      openStudentForEdit,
      pendingStudentEditId,
      clearPendingStudentEdit,
      refreshSelectedStudent,
      refreshStudents,
      activePeriodFilter,
      setActivePeriodFilter,
      searchQuery,
      setSearchQuery,
      activeTab,
      setActiveTab,
      periodNumbers,
    }),
    [
      students,
      studentsLoading,
      studentsError,
      selectedStudentId,
      selectedStudentDetail,
      detailLoading,
      detailError,
      selectStudent,
      openStudentForEdit,
      pendingStudentEditId,
      clearPendingStudentEdit,
      refreshSelectedStudent,
      refreshStudents,
      activePeriodFilter,
      searchQuery,
      activeTab,
      periodNumbers,
    ]
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
