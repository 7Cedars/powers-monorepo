import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXPLORER_DAOS, type PortalDAO } from '@/data/explorerData';
import { X, Eye, EyeOff, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const VISITED_KEY = 'powers-protocol-visited';
const HIDDEN_KEY = 'powers-protocol-hidden';

function getVisited(): string[] {
  try {
    return JSON.parse(localStorage.getItem(VISITED_KEY) || '[]');
  } catch {
    return [];
  }
}

function getHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function Explorer() {
  const navigate = useNavigate();
  const [visited, setVisited] = useState<string[]>(getVisited);
  const [hidden, setHidden] = useState<string[]>(getHidden);
  const [hiddenAlertDao, setHiddenAlertDao] = useState<PortalDAO | null>(null);

  useEffect(() => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
  }, [hidden]);

  const handleEnterPortal = (dao: PortalDAO) => {
    // Mark as visited
    const updatedVisited = Array.from(new Set([...visited, dao.id]));
    setVisited(updatedVisited);
    localStorage.setItem(VISITED_KEY, JSON.stringify(updatedVisited));

    if (dao.isInternal) {
      navigate(dao.route);
    }
  };

  const handleHide = (dao: PortalDAO) => {
    setHidden((prev) => [...prev, dao.id]);
    setHiddenAlertDao(dao);
  };

  const handleUnhide = (daoId: string) => {
    setHidden((prev) => prev.filter((id) => id !== daoId));
  };

  const visibleDaos = EXPLORER_DAOS.filter((d) => !hidden.includes(d.id));
  const hiddenDaos = EXPLORER_DAOS.filter((d) => hidden.includes(d.id));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'hsl(30, 100%, 50%)' }}>
      {/* Header */}
      <header className="px-6 py-8 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-mono font-bold tracking-wider uppercase"
          style={{ color: 'hsl(0, 0%, 0%)' }}
        >
          Powers Protocol
        </h1>
        <p
          className="mt-2 text-sm sm:text-base font-mono tracking-wide"
          style={{ color: 'hsl(0, 0%, 15%)' }}
        >
          Explorer Page
        </p>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 sm:px-6 pb-12 max-w-4xl mx-auto w-full">
        {/* Explore Section */}
        <div className="mb-8">
          <h2
            className="text-lg font-mono font-semibold mb-1 tracking-wider uppercase"
            style={{ color: 'hsl(0, 0%, 0%)' }}
          >
            &gt; Explore Portals
          </h2>
          <p className="text-xs font-mono mb-6" style={{ color: 'hsl(0, 0%, 20%)' }}>
            Browse DAOs in the Powers Protocol ecosystem. Click to enter a portal.
          </p>

          <div className="space-y-3">
            {visibleDaos.map((dao) => {
              const isVisited = visited.includes(dao.id);
              return (
                <div
                  key={dao.id}
                  className="border-2 rounded-none p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-200 group"
                  style={{
                    borderColor: 'hsl(0, 0%, 0%)',
                    backgroundColor: 'hsl(0, 0%, 100%)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-mono font-semibold text-sm sm:text-base"
                        style={{ color: 'hsl(0, 0%, 0%)' }}
                      >
                        {dao.name}
                      </span>
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 border rounded-none uppercase"
                        style={{
                          borderColor: 'hsl(0, 0%, 0%)',
                          color: 'hsl(0, 0%, 0%)',
                        }}
                      >
                        {dao.category}
                      </span>
                      {isVisited && (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-none"
                          style={{
                            backgroundColor: 'hsl(0, 0%, 0%)',
                            color: 'hsl(30, 100%, 50%)',
                          }}
                        >
                          VISITED
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs font-mono mt-1 leading-relaxed"
                      style={{ color: 'hsl(0, 0%, 15%)' }}
                    >
                      {dao.description}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Users size={11} style={{ color: 'hsl(0, 0%, 25%)' }} />
                      <span className="text-[10px] font-mono" style={{ color: 'hsl(0, 0%, 25%)' }}>
                        {dao.memberCount} members
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleHide(dao)}
                      className="p-2 border transition-all duration-200 hover:scale-105"
                      style={{
                        borderColor: 'hsl(0, 0%, 0%)',
                        color: 'hsl(0, 0%, 0%)',
                      }}
                      title="Hide this DAO"
                    >
                      <EyeOff size={14} />
                    </button>
                    <button
                      onClick={() => handleEnterPortal(dao)}
                      className="px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-200 hover:scale-105"
                      style={{
                        backgroundColor: 'hsl(0, 0%, 0%)',
                        color: 'hsl(30, 100%, 50%)',
                        border: '2px solid hsl(0, 0%, 0%)',
                      }}
                    >
                      [ Enter ]
                    </button>
                  </div>
                </div>
              );
            })}

            {visibleDaos.length === 0 && (
              <p className="text-center font-mono text-sm py-8" style={{ color: 'hsl(0, 0%, 20%)' }}>
                No portals visible. Unhide DAOs below to see them here.
              </p>
            )}
          </div>
        </div>

        {/* Hidden DAOs */}
        {hiddenDaos.length > 0 && (
          <div className="mt-10 border-t-2 pt-6" style={{ borderColor: 'hsl(0, 0%, 0%, 0.3)' }}>
            <h3
              className="text-xs font-mono font-semibold mb-3 tracking-wider uppercase"
              style={{ color: 'hsl(0, 0%, 20%)' }}
            >
              &gt; Hidden Portals ({hiddenDaos.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {hiddenDaos.map((dao) => (
                <button
                  key={dao.id}
                  onClick={() => handleUnhide(dao.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border transition-all duration-200 hover:scale-105"
                  style={{
                    borderColor: 'hsl(0, 0%, 0%, 0.5)',
                    color: 'hsl(0, 0%, 0%)',
                    backgroundColor: 'hsl(30, 100%, 60%)',
                  }}
                >
                  <Eye size={12} />
                  {dao.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>




      {/* Hidden DAO Alert */}
      <AlertDialog open={!!hiddenAlertDao} onOpenChange={() => setHiddenAlertDao(null)}>
        <AlertDialogContent
          className="border-2 rounded-none font-mono max-w-md"
          style={{
            backgroundColor: 'hsl(30, 100%, 50%)',
            borderColor: 'hsl(0, 0%, 0%)',
            color: 'hsl(0, 0%, 0%)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm uppercase tracking-wider">
              Portal Hidden
            </AlertDialogTitle>
            <AlertDialogDescription
              className="font-mono text-xs leading-relaxed"
              style={{ color: 'hsl(0, 0%, 15%)' }}
            >
              <strong>{hiddenAlertDao?.name}</strong> has been hidden from your explorer view. To view this
              DAO's activity, navigate to its unique blockchain ID:
              <br />
              <code
                className="block mt-2 px-3 py-2 text-[10px] break-all"
                style={{
                  backgroundColor: 'hsl(0, 0%, 0%)',
                  color: 'hsl(30, 100%, 50%)',
                }}
              >
                powers://dao/{hiddenAlertDao?.id}
              </code>
              <br />
              You can unhide this portal at any time from the Hidden Portals section below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="font-mono text-xs uppercase tracking-wider rounded-none border-2"
              style={{
                backgroundColor: 'hsl(0, 0%, 0%)',
                color: 'hsl(30, 100%, 50%)',
                borderColor: 'hsl(0, 0%, 0%)',
              }}
            >
              [ Understood ]
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
