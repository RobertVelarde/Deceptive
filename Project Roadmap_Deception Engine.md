# **Deception Project: Detailed Roadmap & User Stories**

A professional framework for serverless, deterministic "multiplayer" social deduction games built with React.

## **📂 Proposed Production File Structure**

The project will follow this structure to ensure scalability and professional organization:

* src/engine/: Core deterministic logic (PRNG, Seed navigation, LZ-String).  
* src/games/: Folder for game modules.  
* src/games/insider/: Logic, styles, and components specific to Insider.  
* src/components/shared/: Professional UI primitives (Buttons, Modals, Reveal-shields).  
* src/styles/: Global theme variables and professional design tokens.

## **Phase 1: Core Engine & Architecture**

*Goal: Build the underlying "Deterministic Protocol" and modular registry.*

### **Story 1.1: The Deterministic Core**

**As a** developer,  
**I want** to implement a centralized engine that uses a 4-character seed to generate PRNG values,  
**so that** all players see the exact same game state without a backend.

* **AC 1:** Implement createPRNG(seedString) using a robust algorithm (e.g., mulberry32).  
* **AC 2:** Implement getNextSeed and getPrevSeed to traverse the round history.  
* **AC 3:** Ensure the engine is a standalone utility that does not import any UI components.

### **Story 1.2: The State "Envelope"**

**As a** host,  
**I want** the entire lobby configuration to be compressed into a URL-safe string,  
**so that** I can share the game state via a simple link or QR code.

* **AC 1:** Use lz-string to compress the JSON state (players, gameType, baseSettings).  
* **AC 2:** The app must automatically update window.location.hash whenever the lobby state changes.  
* **AC 3:** On mount, the app must check the hash and reconstruct the state perfectly.

## **Phase 2: Professional UI Shell**

*Goal: Create a visual design that impresses professionals and feels like a premium app.*

### **Story 2.1: Modern Visual Design System**

**As a** player,  
**I want** a sleek, dark-themed interface with glassmorphism and smooth transitions,  
**so that** the experience feels like a high-end digital board game.

* **AC 1:** Implement a design system using Tailwind CSS with a neutral-dark palette (zinc/slate).  
* **AC 2:** Use consistent spacing, rounded corners (2xl/3xl), and professional typography.  
* **AC 3:** All interactive elements must have hover/active states and subtle transitions.

### **Story 2.2: Seamless Identity Management**

**As a** joining player,  
**I want** the app to automatically recognize me based on my previous sessions,  
**so that** I don't have to select my name every time we start a new round.

* **AC 1:** Save lastSelectedName to localStorage.  
* **AC 2:** If the stored name exists in the current lobby's player list, auto-assign that identity.  
* **AC 3:** Provide a "Change Identity" button in the settings if someone else is using the device.

## **Phase 3: The "Insider" Game Module**

*Goal: Implement the first game module with its specific branding and rules.*

### **Story 3.1: Insider Thematic Branding**

**As a** player,  
**I want** the Insider game screens to use the board game's signature red and cream colors,  
**so that** the game feels immersive and authentic.

* **AC 1:** The Insider folder must contain its own style constants (e.g., primary: \#D32F2F).  
* **AC 2:** When the gameType is 'insider', the UI shell dynamically adapts its accent colors.

### **Story 3.2: Information Asymmetry & Privacy**

**As a** player,  
**I want** my secret information (Role/Word) to be hidden behind a "Reveal" interaction,  
**so that** nearby players cannot peek at my screen.

* **AC 1:** Implement a "Hold to Reveal" or "Click to Toggle" component for the Secret Word.  
* **AC 2:** Ensure the "Master" and "Insider" see the secret word, while "Commons" see instructions only.  
* **AC 3:** Include a local 5-minute timer component specifically for the Master view.

## **Phase 4: Scalability & Late-Game Logic**

### **Story 4.1: The "New Game" Readiness (Chameleon)**

**As a** developer,  
**I want** the game module structure to be identical for all games,  
**so that** I can duplicate the games/insider folder to create games/chameleon with minimal friction.

* **AC 1:** Define a standard interface for game modules (e.g., getSetup, RoleUI).  
* **AC 2:** The main App component should use a "Registry" to load the correct module based on the state.

### **Story 4.2: Hot-Swap Lobby Editing**

**As a** host,  
**I want** to add a new player mid-session and generate a new checksum/QR code,  
**so that** late-comers can join without resetting the entire group's progress.

* **AC 1:** Changing the player list must force a recalculation of the lobbyChecksum.  
* **AC 2:** Display a "Lobby Updated" notification to players whose local checksum doesn't match the new URL data.