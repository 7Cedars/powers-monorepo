import { ChatMessageData } from '@/components/ChatMessage';
import { ChatFilterState } from '@/components/ChatFilter';

export function extractHashtags(messages: ChatMessageData[]): string[] {
  const tags = new Set<string>();
  const extract = (msgs: ChatMessageData[]) => {
    for (const m of msgs) {
      const matches = m.message.match(/#(\w+)/g);
      if (matches) matches.forEach(t => tags.add(t.slice(1)));
      if (m.replies) extract(m.replies);
    }
  };
  extract(messages);
  return Array.from(tags);
}

export function extractRoles(messages: ChatMessageData[]): string[] {
  const roles = new Set<string>();
  const extract = (msgs: ChatMessageData[]) => {
    for (const m of msgs) {
      if (m.role) roles.add(m.role);
      if (m.replies) extract(m.replies);
    }
  };
  extract(messages);
  return Array.from(roles);
}

export function applyFilter(messages: ChatMessageData[], filter: ChatFilterState): ChatMessageData[] {
  if (filter.type === 'none') return messages;

  if (filter.type === 'most-upvotes') {
    return [...messages].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  }

  if (filter.type === 'most-downvotes') {
    return [...messages].sort((a, b) => (a.upvotes - a.downvotes) - (b.upvotes - b.downvotes));
  }

  if (filter.type === 'hashtag' && filter.hashtag) {
    const tag = `#${filter.hashtag}`.toLowerCase();
    return messages.filter(m => m.message.toLowerCase().includes(tag));
  }

  if (filter.type === 'dao-role' && filter.role) {
    const role = filter.role;
    return messages.filter(m => m.role === role);
  }

  if (filter.type === 'wallet-address' && filter.walletAddress) {
    const addr = filter.walletAddress.toLowerCase();
    return messages.filter(m =>
      m.sender.toLowerCase().includes(addr) ||
      m.address.toLowerCase().includes(addr)
    );
  }

  return messages;
}
