

# Ana Fi France - Implementation Plan

## Overview
A professional bilingual (French/Arabic) Progressive Web App serving the Arabic-speaking community in France with live Egyptian radio and an AI-powered administrative assistant.

---

## 🎨 Design System

**Visual Identity:**
- Primary: Navy Blue (#1a365d)
- Accent: Gold (#d4af37)
- Background: Clean white with subtle gray tones
- Typography: "Cairo" font for Arabic, system fonts for French
- Style: Rounded corners (xl), smooth transitions, professional "Legal Tech" aesthetic

**Bilingual Features:**
- Global language toggle (FR/AR)
- Full RTL support for Arabic sections
- Seamless font switching between languages

---

## 📱 App Structure (4 Main Sections)

### 1. Dashboard (Home)
- Welcome message (personalized if logged in)
- Quick access cards to Radio and Assistant
- Recent activity summary
- Language toggle prominently displayed

### 2. Radio Player
- Clean, modern audio player interface
- 4 preset Egyptian radio stations with logos:
  - Coran Karim
  - Nogoum FM
  - Radio Masr
  - Radio Orient
- Play/pause controls, volume slider
- Station selection cards
- "Now Playing" indicator

### 3. AI Administrative Assistant (Core Feature)
**Multi-Modal Input Section:**
- 🎤 Voice recording button (speech-to-text)
- 📷 Document photo upload (OCR processing)
- 📝 Large text area for explanations (accepts Arabic or French)

**AI Processing (via Lovable AI):**
- Automatic legal context detection (Housing, Immigration, Family, Work)
- French law article citations (Code de la Sécurité Sociale, CESEDA, etc.)
- Understands Arabic input perfectly

**Triple Output Display:**
| Section | Language | Content |
|---------|----------|---------|
| **Formal Letter** | French | Professional administrative letter with user's profile data in header, proper formatting, legal citations |
| **Legal Note** | French | Brief technical explanation of applicable laws |
| **Action Plan** | Arabic | Step-by-step guide explaining what the letter says and next steps |

**Output Tools:**
- Copy to clipboard button
- Download as professional PDF

### 4. User Profile (Mon Profil)
- Full name input
- Complete address
- Phone number
- Optional ID fields:
  - CAF number
  - Numéro Étranger
  - Sécurité Sociale number
- Data saved to Supabase
- Auto-injected into letter headers

---

## 💳 Monetization (Stripe Integration)

**Payment Flow:**
1. User fills in their request (voice/photo/text)
2. Clicks "Analyze" button
3. Payment overlay appears (3€ or 5€ options)
4. AI results remain blurred/hidden
5. After successful payment → results revealed
6. User can copy or download their documents

---

## 🔧 Backend Requirements

**Supabase Integration:**
- User authentication (email/password)
- Profile data storage
- Request history (optional, for future use)

**Lovable AI (Edge Function):**
- Process multi-modal input
- Generate legal documents
- Translate and explain in Arabic

**Stripe:**
- Secure payment processing
- Payment confirmation webhook

---

## 📋 Implementation Phases

**Phase 1: Foundation**
- Set up bilingual UI framework with RTL support
- Create navigation with 4 tabs
- Implement design system (colors, typography)
- Build responsive mobile-first layout

**Phase 2: Radio Module**
- Audio player component
- Station cards with logos
- Streaming functionality (placeholder URLs)

**Phase 3: User Profile**
- Enable Supabase authentication
- Profile form with all required fields
- Data persistence

**Phase 4: AI Assistant**
- Multi-modal input form (text, voice recording, image upload)
- Edge function for AI processing with Lovable AI
- Triple output display with proper formatting
- Copy and PDF download features

**Phase 5: Monetization**
- Stripe integration
- Payment wall implementation
- Result reveal after payment

---

## 📱 Mobile-First & PWA Ready
- Responsive design optimized for mobile devices
- Touch-friendly controls
- Fast loading and smooth animations
- Modular code structure for future features (Legal FAQ, Find a Translator, etc.)

