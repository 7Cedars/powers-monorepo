

# enterhere.io - Blockchain-Integrated Website Mockup

A minimalist, terminal-aesthetic proof-of-concept website for **4.0 PRODUCTIONS LTD** with a hacker/vintage computer feel.

---

## 🎨 Design System

**Color Palette:** Black (#000), White (#FFF), Grey tones  
**Typography:** Monospace terminal font (e.g., "Fira Code" or "JetBrains Mono")  
**Visual Effects:** Subtle CRT scanlines, gentle flicker on text, slight text glow  

---

## 📄 Page 1: Landing Page (Construction)

A stark, minimal entrance page with the "under construction" vibe:

- **Center of screen:** Animated text reading `> live construction site in progress_` with a blinking cursor
- **Below text:** Two terminal-style buttons:
  - `[CONNECT WALLET]` - Primary action, triggers fake MetaMask modal
  - `[ANONYMOUS VIEW ONLY]` - Secondary action, enters as read-only user
- **Subtle background:** Faint scanline overlay for CRT monitor effect
- **Footer:** Minimal `© 4.0 PRODUCTIONS LTD` with subtle social/contact links

---

## 📄 Page 2: Fake MetaMask Modal

When user clicks "CONNECT WALLET":

- Dark overlay with styled modal mimicking a wallet connection prompt
- Shows mock wallet address to "connect"
- "Confirm" button to simulate SIWE (Sign-In With Ethereum)
- Upon confirm → redirect to PrimaryDAO landing page as authenticated user

---

## 📄 Page 3: PrimaryDAO Landing Page (Chat)

The main hub after entry:

**Header Navigation:**
- Logo/branding
- Connected wallet address display (e.g., `0x1234...abcd` or mock ENS like `user.eth`)
- Disconnect button

**Chat Interface:**
- Full-width chat area with scrollable message history
- Pre-populated demo messages from various mock wallet addresses/ENS names
- Messages styled like terminal output
- **If connected:** Active chat input at bottom for composing messages (mock send functionality)
- **If anonymous:** Greyed-out input with text like `> connect wallet to participate...`

**Footer:** Same minimal footer with 4.0 PRODUCTIONS LTD branding and links

---

## 🔄 User Flows

1. **Connected User:** Landing → Connect Wallet Modal → Confirm → Chat (full access)
2. **Anonymous User:** Landing → Anonymous View → Chat (read-only, greyed input)

---

## 💻 Tech Notes

- React with TypeScript, Tailwind CSS
- Mock wallet state management (no real blockchain integration)
- Terminal-style animations and effects via CSS
- Responsive design for desktop focus

