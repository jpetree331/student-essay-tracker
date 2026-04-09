import { useAppState } from '../../context/AppStateContext';
import { RosterView } from '../roster/RosterView';
import { AssignmentsView } from '../assignments/AssignmentsView';
import { DataTab } from '../data/DataTab';

export function MainContent() {
  const { activeTab } = useAppState();

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto bg-slate-950">
      {activeTab === 'roster' && <RosterView />}
      {activeTab === 'assignments' && <AssignmentsView />}
      {activeTab === 'data' && <DataTab />}
    </div>
  );
}
