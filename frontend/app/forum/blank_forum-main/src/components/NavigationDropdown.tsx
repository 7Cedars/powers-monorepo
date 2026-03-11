import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  
  { path: '/profile', label: 'PROFILE', displayName: 'Profile' },
  { path: '/all-daos', label: 'ALL DAOs', displayName: 'ALL DAOs' },
  { path: '/view/primary-dao', label: 'DAO #0', displayName: 'DAO #0' },
  { path: '/view/sub-dao-1', label: 'DAO #1', displayName: 'DAO #1' },
  { path: '/view/sub-dao-2', label: 'DAO #2', displayName: 'DAO #2' },
  { path: '/view/sub-dao-3', label: 'DAO #3', displayName: 'DAO #3' },
];

interface NavigationDropdownProps {
  currentTitle?: string;
}

export function NavigationDropdown({ currentTitle }: NavigationDropdownProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentTitle = () => {
    if (currentTitle) return currentTitle;
    const currentItem = NAV_ITEMS.find((item) => item.path === location.pathname);
    return currentItem?.displayName || 'Navigation';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="font-mono text-base text-foreground tracking-wider flex items-center gap-1 hover:text-foreground/80 transition-colors focus:outline-none">
        &gt; {getCurrentTitle()}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-background border-border z-50">
        {NAV_ITEMS.map((item) => (
          <DropdownMenuItem
            key={item.path}
            onClick={() => navigate(item.path)}
            className="font-mono text-sm cursor-pointer"
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
