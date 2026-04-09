import { useState } from 'react';
import { ClassDataView } from './ClassDataView';
import { StudentDataView } from './StudentDataView';

export function DataTab() {
  const [sub, setSub] = useState('class');

  return (
    <div className="w-full">
      <div className="flex w-full shrink-0 border-b border-slate-800 bg-slate-900/80">
        {[
          { id: 'class', label: 'Class View' },
          { id: 'student', label: 'Student View' },
        ].map((t) => {
          const on = sub === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              className={`relative flex-1 px-4 py-2.5 text-sm font-medium transition ${
                on ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {on && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500" aria-hidden />
              )}
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>
      {sub === 'class' && <ClassDataView />}
      {sub === 'student' && <StudentDataView />}
    </div>
  );
}
