import { useAppState } from '../../context/AppStateContext';
import { StudentRecordView } from '../studentRecord/StudentRecordView';
import { ClassSummaryDashboard } from './ClassSummaryDashboard';

export function RosterView() {
  const { selectedStudentId } = useAppState();

  if (selectedStudentId != null) {
    return <StudentRecordView />;
  }

  return <ClassSummaryDashboard />;
}
