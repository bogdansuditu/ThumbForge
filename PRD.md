# Product Requirements Document (Revised)

**Product Name:** ThumbForge (working name)
**Version:** v1.1
**Scope:** MVP – Local-first, Auth-ready
**Status:** Approved for implementation

---

## 1. Purpose & Vision

### Purpose

Create a **web-based graphic design application** focused on **thumbnails and memes**, using a **Canva/Photoshop-like interface**, optimized for speed, creativity, and ease of use.

### Vision

A **local-first design tool** that:

* Works without accounts
* Stores projects locally
* Feels powerful and familiar
* Can later evolve into an authenticated, cloud-enabled product **without architectural rewrites**

---

## 2. Core Product Philosophy

1. **Local-First**

   * The application works fully offline
   * No mandatory backend dependencies

2. **Auth-Ready, Not Auth-Required**

   * No authentication in MVP
   * All data models and APIs assume a future “owner” concept

3. **Non-Destructive Editing**

   * All operations are reversible and parameter-based

4. **Familiar Mental Model**

   * Layers
   * Canvas
   * Properties panel
   * Toolbar

---

## 3. Target Users

### Primary

* Content creators (YouTube, TikTok, Instagram)
* Meme creators
* Streamers

### Secondary

* Hobby designers
* Educators
* Small businesses

### User Expectations

* “I already know how this works”
* No onboarding friction
* Immediate creative feedback

---

## 4. Core Use Case

> “Create a visually striking thumbnail or meme by combining images, text, and shapes with advanced styling and effects — without needing an account.”

---

## 5. Functional Requirements (MVP)

---

### 5.1 Canvas & Workspace

#### Canvas

* Preset sizes:

  * YouTube Thumbnail (1280×720)
  * Square (1:1)
  * Custom size
* Zoom & pan
* Optional grid & snapping

#### Workspace Layout

* **Center:** Canvas
* **Left:** Tools
* **Right:** Context-aware properties
* **Top:** Global actions (undo, redo, export)

---

### 5.2 Project Lifecycle (Local-Only)

#### Project Creation

* New blank project
* New project from preset

#### Project Persistence

* Projects saved locally in the browser
* Automatic saving
* Manual “Save As” (local)

#### Project Identity

Each project has:

* `projectId` (UUID)
* `ownerId` (nullable, reserved for future auth)

> `ownerId` MUST exist in the data model but is `null` in MVP.

---

### 5.3 Layers System

* Layer panel
* Reorder layers
* Lock / hide
* Group / ungroup
* Layer naming
* Duplicate layers

---

### 5.4 Image Handling (Primary Feature)

#### Image Input

* Upload from local device
* Drag & drop
* Paste

#### Transformations

* Move
* Scale (free + constrained)
* Rotate
* Flip
* Crop (basic)

#### Image Effects (Non-Destructive)

* Brightness
* Contrast
* Saturation
* Blur
* Opacity
* Drop shadow
* Color overlay

Effects:

* Stackable
* Reorderable
* Toggleable

---

### 5.5 Text System (High Priority)

#### Text Creation

* Add text block
* Inline canvas editing

#### Text Properties

* Font family
* Size
* Line height
* Letter spacing
* Alignment
* Fill color / gradient

#### Text Effects

* Stroke (outline)
* Shadow (multi-layer)
* Glow
* Background highlight
* Skew / simple warp

#### Presets

* Headline
* Meme styles
* Clickbait styles

---

### 5.6 Shapes & Graphics

* Rectangle
* Circle
* Line
* Arrow
* Triangle
* Rounded Rectangle

Customizations:

* Fill
* Stroke
* Corner radius
* Opacity
* Shadow

---

### 5.7 Object Interaction

* Select / multi-select
* Align to canvas
* Distribute evenly
* Snap to guides

---

### 5.8 Undo / Redo

* Unlimited undo / redo
* Keyboard shortcuts
* State-based (document snapshots or diffs)

---

### 5.9 Exporting

#### Formats

* PNG
* JPG
* WebP

#### Export Options

* Resolution scaling
* Background transparency
* Quality control

---

## 6. Data Model Requirements (Critical)

### Document Model

* Stored as JSON
* Versioned schema
* Serializable / portable

#### Required Fields

* `projectId`
* `ownerId` (nullable)
* `createdAt`
* `updatedAt`
* `schemaVersion`

> **Even without auth, ownership is modeled.**

This enables:

* Seamless future login
* Cloud sync later
* Collaboration later

---

## 7. Non-Functional Requirements

### Performance

* Canvas interactions < 16ms
* Smooth drag & transform
* No blocking UI operations

### Browser Support

* Chrome
* Firefox
* Safari
* Edge

### Reliability

* Auto-save
* Crash-safe local persistence

---

## 8. Deployment Requirements

### MVP Deployment

* Single Docker container
* Static frontend served via NGINX

### No Required Services

❌ No database
❌ No object storage
❌ No backend API

---

## 9. Explicitly Out of Scope (MVP)

❌ Authentication
❌ User accounts
❌ Cloud storage
❌ Collaboration
❌ Templates marketplace
❌ AI features
❌ Video / animation

---

## 10. Future-Ready Requirements (Not Implemented)

These must be **architecturally supported but disabled**:

* Authentication provider
* User ownership enforcement
* Cloud project sync
* Shared links
* Permissions

---

## 11. Success Metrics

* User can export a thumbnail in under 5 minutes
* Zero required onboarding
* High reuse of text/image presets
* No data loss during normal use

---

## 12. Summary

This product is:

* **Not a SaaS (yet)**
* **Not Photoshop**
* **Not Canva**

It is a **local-first, powerful, familiar design tool** that:

* Feels instantly usable
* Scales technically
* Avoids premature complexity
