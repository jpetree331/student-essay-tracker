import { HeaderBar } from './components/HeaderBar';
import { Sidebar } from './components/sidebar/Sidebar';
import { TabBar } from './components/main/TabBar';
import { MainContent } from './components/main/MainContent';

export default function App() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <HeaderBar />
      <div className="flex min-h-0 w-full flex-1">
        <Sidebar />
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-950">
          <TabBar />
          <MainContent />
        </section>
      </div>
    </div>
  );
}
